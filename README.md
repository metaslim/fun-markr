# Markr

A data ingestion microservice for exam results with a React dashboard.

## Quick Start

### Docker (Recommended)

```bash
# Start backend services
docker-compose up --build

# In another terminal, start frontend
cd frontend && npm install && npm run dev
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

## Architecture

### Backend Flow

```
POST /import → Validates XML → Queues to Redis → Returns 202 + job_id
                                    ↓
                         Sidekiq Worker processes
                                    ↓
              Saves to students & test_results tables
                                    ↓
              Computes aggregates → Stores as JSON
                                    ↓
                         Status: completed
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

test_aggregates
├── test_id (unique)
└── data (JSON blob)
```

### Frontend Stack

- React 18 + TypeScript + Vite
- Tailwind CSS
- WebLLM (local AI assistant)
- Zustand (state management)

---

## API Reference

### Import

```bash
# Import XML results
curl -u markr:secret -X POST http://localhost:4567/import \
  -H "Content-Type: text/xml+markr" \
  -d @data/sample_results.xml
# Returns: { "job_id": "abc123", "status": "queued" }

# Poll job status
curl -u markr:secret http://localhost:4567/jobs/:job_id
# Statuses: queued, processing, completed, failed, dead
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

1. **Duplicate Handling**: Same student + same test = keep highest score
2. **Document Rejection**: Missing required fields rejects entire document (HTTP 400)
3. **Async Processing**: All imports via Sidekiq for large batch handling
4. **Pre-computed Aggregates**: Stats calculated on import, stored as JSON

---

## Frontend Features

- **Dashboard**: Overview of all tests with stats
- **Test Details**: Aggregate statistics, box plots, score distribution
- **Student List**: All students with search
- **Student Profile**: Individual student's test history
- **Import**: XML file upload with job polling
- **AI Assistant**: Local LLM (Llama 3.2) for help and data queries

---

## Development

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

**Backend**: Ruby 3.4, Sinatra, Sidekiq, PostgreSQL, Redis, RSpec
**Frontend**: React, TypeScript, Vite, Tailwind CSS, WebLLM, Zustand
