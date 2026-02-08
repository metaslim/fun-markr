# Markr

A data ingestion microservice for exam results with a React dashboard.

<img width="1080" height="515" alt="image" src="https://github.com/user-attachments/assets/57064285-07ee-457d-ae0d-f87efe9b9598" />

<img width="1512" height="780" alt="image" src="https://github.com/user-attachments/assets/be85e8c8-8bd0-43d8-90ea-81943c3e4845" />



## Quick Start

### Docker (Recommended)

```bash
# Start backend services
docker-compose up --build --force-recreate

# In another terminal, start frontend
cd frontend && npm install && npm run dev
```

**Dev mode** (default): Local code is mounted into containers via `docker-compose.override.yml`.
Code changes apply after restart:
```bash
docker-compose restart app worker
```

**Production mode**: Use only base file (code baked into image):
```bash
docker-compose -f docker-compose.yml up -d
```

Services:
- **Backend API**: http://localhost:4567
- **Frontend**: http://localhost:5173
- **Worker**: Sidekiq (background jobs)
- **Database**: PostgreSQL
- **Cache**: Redis

### Verify It Works

```bash
./scripts/demo.sh
```

### Stop

```bash
docker-compose down
# Add -v to also remove database volumes
```

---

## System Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Frontend (React)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │  Dashboard  │  │  Test View  │  │  Students   │  │   Import   │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘  │
│         └────────────────┴────────────────┴───────────────┘         │
│                              │ API Calls                            │
│                    ┌─────────┴─────────┐                            │
│                    │  AI Assistant     │ ← WebLLM (Qwen 2.5 7B)     │
│                    │  (Tool Calling)   │   Runs locally in browser  │
│                    └───────────────────┘                            │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTP (Basic Auth)
┌───────────────────────────────┴─────────────────────────────────────┐
│                        Backend (Sinatra API)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │   Routes    │  │ Validators  │  │   Services  │                  │
│  │  /import    │  │  XML Parse  │  │  Aggregate  │                  │
│  │  /tests     │  │  Schema     │  │  Calculator │                  │
│  │  /students  │  └─────────────┘  └─────────────┘                  │
│  └──────┬──────┘                                                    │
│         │                                                           │
│  ┌──────┴──────┐                                                    │
│  │ Repositories│ ← Data Access Layer                                │
│  │  Student    │                                                    │
│  │  TestResult │                                                    │
│  │  Aggregate  │                                                    │
│  └──────┬──────┘                                                    │
└─────────┼───────────────────────────────────────────────────────────┘
          │
┌─────────┴───────────────────────────────────────────────────────────┐
│                         Infrastructure                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │ PostgreSQL  │  │    Redis    │  │   Sidekiq   │                  │
│  │  students   │  │  Job Queue  │  │   Worker    │                  │
│  │  results    │  │  Sessions   │  │  ImportJob  │                  │
│  │  aggregates │  └─────────────┘  └─────────────┘                  │
│  └─────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

**Import Flow (Async)**
```
Client                  API                    Redis              Worker              DB
  │                      │                       │                   │                 │
  │──POST /import───────>│                       │                   │                 │
  │                      │──Validate XML────────>│                   │                 │
  │                      │<─────OK───────────────│                   │                 │
  │                      │──Queue Job───────────>│                   │                 │
  │<──202 {job_id}───────│                       │                   │                 │
  │                      │                       │──Pop Job─────────>│                 │
  │                      │                       │                   │──Save Results──>│
  │                      │                       │                   │──Calc Aggs─────>│
  │──GET /jobs/:id──────>│                       │                   │                 │
  │<──{status: done}─────│                       │                   │                 │
```

**Query Flow (Sync)**
```
Client                  API                    DB
  │                      │                      │
  │──GET /tests─────────>│                      │
  │                      │──SELECT aggregates──>│
  │                      │<─────Results─────────│
  │<──200 {tests:[...]}──│                      │
```

### Database Schema

```
students
├── id (PK)
├── student_number (unique)
├── name
└── timestamps

test_results
├── id (PK)
├── student_id (FK → students)
├── test_id
├── marks_available
├── marks_obtained
├── scanned_on
└── timestamps
└── UNIQUE(student_id, test_id)

test_aggregates
├── test_id (unique)
└── data (JSON blob: mean, p25, p50, p75, min, max, count)
```

---

## Code Design

### Backend Structure

```
lib/markr/
├── model/                    # Domain models (POROs)
│   ├── test_result.rb        # TestResult value object
│   └── student.rb            # Student value object
├── repository/               # Data access layer
│   ├── base_repository.rb    # Base class with error handling
│   ├── student_repository.rb # Student CRUD
│   ├── test_result_repository.rb  # Results + dedup logic
│   └── aggregate_repository.rb    # Pre-computed stats
├── aggregator/               # Stats calculators (Strategy)
│   ├── aggregatable.rb       # Base class
│   ├── mean.rb, min.rb, max.rb, count.rb, stddev.rb, percentile.rb
│   └── registry.rb           # Aggregator configuration
├── loader/                   # Data parsers (Factory)
│   ├── loadable.rb           # Base class
│   ├── xml_loader.rb         # XML parser
│   ├── csv_loader.rb         # CSV parser
│   └── loader_factory.rb     # Factory
├── middleware/               # Cross-cutting concerns
│   ├── auth.rb               # Basic auth
│   └── cors.rb               # CORS headers
├── worker/                   # Background jobs
│   └── import_worker.rb      # Sidekiq job
└── markr.rb                  # Module loader
```

**Design Patterns:**
- **Repository** - Database access abstraction
- **Factory** - Loader selection by content type
- **Strategy** - Pluggable aggregator calculations
- **Registry** - Aggregator configuration without code changes
- **Middleware** - Cross-cutting concerns (Auth, CORS)
- **Worker** - Async job processing

### Frontend Structure

```
frontend/src/
├── components/               # Reusable UI components
│   ├── Layout.tsx            # App shell, nav, Jobs icon, AI button
│   ├── AssistantPanel.tsx    # AI chat interface
│   ├── Breadcrumb.tsx        # Navigation breadcrumbs
│   ├── Tooltip.tsx           # Tooltip component
│   └── charts/               # Visualization components
│       ├── BoxPlot.tsx       # Score distribution
│       └── ScoreDistribution.tsx
├── lib/
│   └── tools/                # AI Assistant tools (SOLID)
│       ├── index.ts          # Tool registry
│       ├── types.ts          # Tool interface
│       ├── listTests.ts      # Each tool in own file
│       ├── getTest.ts
│       ├── getTopStudents.ts
│       ├── getStrugglingStudents.ts
│       ├── getPassingStudents.ts
│       ├── listStudents.ts
│       ├── getStudent.ts
│       ├── searchStudent.ts
│       ├── getTestStats.ts
│       ├── getClassOverview.ts
│       ├── findAtRiskStudents.ts
│       ├── getHardestTest.ts
│       ├── getEasiestTest.ts
│       └── compareStudentToClass.ts
├── pages/                    # Route components
│   ├── Home.tsx              # Dashboard with test grid
│   ├── TestList.tsx          # All tests table
│   ├── TestDetail.tsx        # Single test stats
│   ├── StudentList.tsx       # All students
│   ├── StudentDetail.tsx     # Student's results
│   └── Import.tsx            # XML upload + job status
├── services/
│   └── api.ts                # API client (fetch wrapper)
├── stores/
│   ├── assistantStore.ts     # Zustand store for AI state
│   ├── contextStore.ts       # AI context (current page, test)
│   └── jobStore.ts           # Zustand store for import jobs
├── types/
│   └── index.ts              # TypeScript interfaces
└── App.tsx                   # Router setup
```

### AI Assistant Architecture

```
┌────────────────────────────────────────────────────────┐
│                  AssistantPanel.tsx                    │
├────────────────────────────────────────────────────────┤
│  WebLLM Engine (Qwen 2.5 7B)                           │
│  ├── Loads model on first open                         │
│  ├── Runs entirely in browser (WebGPU)                 │
│  └── No data sent to external servers                  │
├────────────────────────────────────────────────────────┤
│  Tool System (src/lib/tools/)                          │
│  ├── Each tool in separate file (SOLID)                │
│  ├── Auto-registered via index.ts                      │
│  └── Tools:                                            │
│      ├── listTests         → all tests                 │
│      ├── getTest:ID        → test details              │
│      ├── getTopStudents:ID → top 5 performers          │
│      ├── getStrugglingStudents:ID → bottom 5           │
│      ├── getPassingStudents:ID → students >= 50%       │
│      ├── listStudents      → all students              │
│      ├── getStudent:NUM    → student by number         │
│      ├── searchStudent:NAME → search by name           │
│      ├── getTestStats:ID   → detailed statistics       │
│      ├── getClassOverview  → overall summary           │
│      ├── findAtRiskStudents → failing 2+ tests         │
│      ├── getHardestTest    → lowest avg test           │
│      ├── getEasiestTest    → highest avg test          │
│      └── compareStudentToClass:NUM → vs average        │
├────────────────────────────────────────────────────────┤
│  State Management (Zustand)                            │
│  ├── isOpen: panel visibility                          │
│  ├── messages: chat history                            │
│  ├── isLoading: model loading state                    │
│  └── engine: WebLLM instance                           │
└────────────────────────────────────────────────────────┘
```

**Tool Calling Flow:**
1. User asks question (e.g., "Show struggling students")
2. LLM responds with `[ACTION:getStrugglingStudents:9863]`
3. Regex parser extracts action name and argument
4. Tool executes: fetches data, navigates to page
5. Returns markdown message + follow-up suggestions

**WebLLM Limitations:**
- **Requires WebGPU** - Only works in Chrome 113+, Edge 113+, or other WebGPU-enabled browsers
- **First load is slow** - Model (~4GB) downloads on first use, cached in browser afterward
- **Hardware requirements** - Needs GPU with 6GB+ VRAM for smooth performance
- **No real function calling** - Uses prompt-based action tags (not native tool calling)
- **Context window** - Limited conversation history due to model constraints
- **Accuracy** - May occasionally misinterpret queries or call wrong action

---

## API Reference

### Import

```bash
# Import XML results
curl -u markr:secret -X POST http://localhost:4567/import \
  -H "Content-Type: text/xml+markr" \
  -d @data/sample_results.xml

# Import CSV results
curl -u markr:secret -X POST http://localhost:4567/import \
  -H "Content-Type: text/csv+markr" \
  -d @data/sample_results.csv

# Returns: { "job_id": "abc123", "status": "queued" }

# Poll job status (uses sidekiq-status gem)
curl -u markr:secret http://localhost:4567/jobs/:job_id
# Statuses: queued, processing, completed, failed, unknown
```

### Tests

```bash
# List all tests
curl -u markr:secret http://localhost:4567/tests

# Get test aggregate stats
curl -u markr:secret http://localhost:4567/results/:test_id/aggregate

# List students in a test
curl -u markr:secret http://localhost:4567/tests/:test_id/students
```

### Students

```bash
# List all students
curl -u markr:secret http://localhost:4567/students

# Get student's all results
curl -u markr:secret http://localhost:4567/students/:student_number

# Get specific result
curl -u markr:secret http://localhost:4567/students/:student_number/tests/:test_id
```

### Health

```bash
curl http://localhost:4567/health  # No auth required
```

---

## Key Assumptions

Based on the [original spec](https://gist.github.com/nick96/fda49ece0de8e64f58d45b03dda9b0c6):

### Duplicate Handling
- **Same student + same test** across single or multiple requests → **UPSERT** (not replace)
- Keep **highest** `marks_obtained` (paper may be folded, some answers covered)
- Keep **highest** `marks_available` (same reason)
- Duplicates may come in same request or different requests - handled identically

### Document Validation
- **Atomic acceptance/rejection** - entire document rejected if any required field missing
- Required fields: `student-number`, `test-id`, `summary-marks` (with `available` and `obtained` attributes)
- Invalid XML syntax → HTTP 400
- Unsupported content-type → HTTP 415
- Validation happens BEFORE queuing to avoid partial imports

### Data Processing
- **Trust `<summary-marks>`** over individual `<answer>` elements
- **Ignore extra/unknown fields** in XML (legacy machines may add "gunk")
- Content-type must be `text/xml+markr` to distinguish from other XML types
- **Async processing** via Sidekiq for large batch handling (returns 202 with job_id)

### Statistics
- All stats expressed as **percentages** (0-100) of available marks
- **Pre-computed on import**, stored as JSON for fast queries
- Includes: mean, stddev, min, max, count, p25, p50, p75

### Persistence
- PostgreSQL for durable storage (survives restarts)
- Redis for job queue only (ephemeral)

---

## Frontend Features

- **Dashboard**: Overview of all tests with stats
- **Test Details**: Aggregate statistics, box plots, score distribution
- **Student List**: All students with search
- **Student Profile**: Individual student's test history
- **Import**: XML/CSV file upload with background processing
- **Jobs Panel**: Track import jobs from any page (persists in localStorage)
- **AI Assistant**: Local LLM (Qwen 2.5 7B) with 14 tools for data exploration
  - Natural language queries: "show struggling students", "class overview", "find at-risk students"
  - Auto-navigation to relevant pages
  - Follow-up suggestions for guided exploration

---

## Development

### Ruby Version (rbenv)

This project requires Ruby 3.4. Use rbenv (like nvm for Node):

```bash
# Install rbenv
brew install rbenv
echo 'eval "$(rbenv init -)"' >> ~/.zshrc
source ~/.zshrc

# Install Ruby 3.4
rbenv install 3.4.1
rbenv local 3.4.1    # Creates .ruby-version file

# Verify
ruby --version       # Should show 3.4.x

# Install bundler
gem install bundler
```

### Backend

```bash
bundle install
bundle exec ruby app.rb              # Start server
bundle exec sidekiq -r ./lib/markr.rb -q imports  # Start worker
bundle exec rspec                    # Run tests
```

### Frontend

```bash
cd frontend
npm install
npm run dev      # Development
npm run build    # Production build
```

---

## Tech Stack

**Backend**: Ruby 3.4, Sinatra, Sidekiq (with sidekiq-status), PostgreSQL, Redis, RSpec
**Frontend**: React 18, TypeScript, Vite, Tailwind CSS, WebLLM (Qwen 2.5), Zustand
