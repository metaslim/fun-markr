# Markr

A data ingestion microservice for exam results, built for the Markr coding challenge.

## Quick Start

```bash
# Start everything with Docker
docker-compose up

# Run the demo script
./scripts/demo.sh

# Or test manually
curl http://localhost:4567/health
```

## Build & Run Instructions

### With Docker (Recommended)

```bash
# Build and start all services (first time)
docker-compose up --build

# Force rebuild after code changes
docker-compose build --no-cache && docker-compose up

# Or run in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

This starts:
- **app** - Sinatra API server on port 4567
- **worker** - Sidekiq background job processor
- **db** - PostgreSQL database
- **redis** - Redis for job queue

### Local Development

```bash
# Install dependencies
bundle install

# Start PostgreSQL and Redis (or use SQLite for quick testing)
# Run the app
bundle exec ruby app.rb

# In another terminal, start Sidekiq worker
bundle exec sidekiq -r ./lib/markr.rb -q imports

# Run tests
bundle exec rspec
```

## Authentication

All endpoints (except `/health`) require HTTP Basic Auth.

**Default credentials:**
- Username: `markr`
- Password: `secret`

Configure via environment variables:
- `AUTH_USERNAME`
- `AUTH_PASSWORD`

**Example:**
```bash
curl -u markr:secret http://localhost:4567/results/9863/aggregate
```

## API Endpoints

### POST /import (Synchronous)

Import test results immediately. Best for small imports.

```bash
curl -u markr:secret -X POST http://localhost:4567/import \
  -H "Content-Type: text/xml+markr" \
  -d '<mcq-test-results>
        <mcq-test-result>
          <student-number>002299</student-number>
          <test-id>9863</test-id>
          <summary-marks available="20" obtained="13" />
        </mcq-test-result>
      </mcq-test-results>'
```

**Response:** `201 Created`
```json
{ "imported": 1 }
```

### POST /import/async (Asynchronous)

Queue import for background processing. Best for large batch imports.

```bash
curl -u markr:secret -X POST http://localhost:4567/import/async \
  -H "Content-Type: text/xml+markr" \
  -d @large_import.xml
```

**Response:** `202 Accepted`
```json
{ "job_id": "abc123", "status": "queued" }
```

### GET /jobs/:job_id

Check async job status.

```bash
curl -u markr:secret http://localhost:4567/jobs/abc123
```

**Response:**
```json
{ "job_id": "abc123", "status": "completed" }
```

Possible statuses: `queued`, `processing`, `completed`, `failed`, `dead`

### GET /results/:test_id/aggregate

Get statistical aggregation for a test.

```bash
curl -u markr:secret http://localhost:4567/results/9863/aggregate
```

**Response:**
```json
{
  "mean": 75.0,
  "stddev": 10.0,
  "min": 65.0,
  "max": 85.0,
  "count": 2,
  "p25": 67.5,
  "p50": 75.0,
  "p75": 82.5
}
```

All values (except `count`) are percentages (0-100) of available marks.

## Key Assumptions

1. **Duplicate Handling**: When a student's submission appears twice, we keep the **highest score**. This also applies to `available` marks - we keep the `marks_available` from the submission with the higher `marks_obtained`.

2. **Document Rejection**: If any required field is missing (`student-number`, `test-id`, `summary-marks`), the **entire document is rejected** with HTTP 400. This matches the challenge requirement that rejected documents get printed for manual entry.

3. **Answer Elements Ignored**: We only use `<summary-marks>` for scoring. Individual `<answer>` elements are ignored as specified.

4. **Percentages**: All aggregation values (except count) are percentages calculated as `(obtained / available) * 100`.

5. **Async for Scale**: The `/import/async` endpoint is designed for large batch imports that might timeout. Basic XML validation happens synchronously, but business logic runs in background workers.

6. **Database Choice**: PostgreSQL for production (reliable, good for stats queries). SQLite fallback for local development.

## Approach

### Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   POST /import  │────▶│    Sync Flow    │────▶ DB
└─────────────────┘     └─────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ POST /import/   │────▶│     Redis       │────▶│  Sidekiq Worker │────▶ DB
│      async      │     │     Queue       │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Design Patterns

- **Template Method**: `Loadable` interface for extensible format support (XML now, JSON/CSV later)
- **Factory**: `LoaderFactory` dispatches to correct parser by content-type
- **Strategy**: Each `Aggregator` implements one calculation (mean, stddev, percentile, etc.)
- **Composition**: `AggregateReport` composes aggregators with fluent interface
- **Repository**: `TestResultRepository` abstracts database operations

### Code Organization

```
lib/markr/
├── loader/           # XML parsing (extensible)
├── aggregator/       # Statistics (mean, stddev, percentiles)
├── model/            # TestResult domain object
├── repository/       # Database operations
├── report/           # Aggregate composition
└── worker/           # Sidekiq async jobs
```

## Things to Note

### Real-time Dashboard Readiness

The current implementation calculates aggregations on-demand. For future real-time dashboards at City Hall, the architecture supports:

1. **Async processing** is already implemented via Sidekiq
2. **Pre-computed aggregates** - could add a `test_aggregates` table updated on each import
3. **Event-driven updates** - Sidekiq jobs could publish events for WebSocket push

### Test Coverage

111 automated tests covering:
- Unit tests for models, loaders, aggregators
- Integration tests for API endpoints
- Edge cases (duplicates, validation, empty data)

```bash
bundle exec rspec --format documentation
```

### Error Handling

| Scenario | HTTP Status | Notes |
|----------|-------------|-------|
| Valid import | 201 | Sync import succeeded |
| Async queued | 202 | Job queued for processing |
| Malformed XML | 400 | Entire document rejected |
| Missing fields | 400 | Entire document rejected |
| Unsupported content-type | 415 | Only `text/xml+markr` supported |
| Unauthorized | 401 | Missing or invalid credentials |
| Test not found | 404 | No results for that test_id |

## Helper Scripts

Convenience scripts are provided in `scripts/` for common operations:

```bash
# Health check (no auth required)
./scripts/health.sh

# Import data (sync)
./scripts/import.sh data/sample_results.xml

# Import data (async via Sidekiq)
./scripts/import-async.sh data/sample_results.xml

# Check async job status
./scripts/job-status.sh <job_id>

# Get aggregate statistics
./scripts/aggregate.sh 9863

# Run full demo (health + import + aggregate)
./scripts/demo.sh
```

**Environment variables** for scripts:
- `MARKR_URL` - API base URL (default: `http://localhost:4567`)
- `MARKR_USER` - Username (default: `markr`)
- `MARKR_PASS` - Password (default: `secret`)

## Project Structure

```
.
├── app.rb                 # Sinatra application entry point
├── lib/markr/             # Core library code
│   ├── aggregator/        # Statistics (mean, stddev, percentiles)
│   ├── loader/            # XML parsing (extensible)
│   ├── model/             # TestResult domain object
│   ├── repository/        # Database operations
│   ├── report/            # Aggregate composition
│   └── worker/            # Sidekiq async jobs
├── spec/                  # RSpec tests
├── scripts/               # Helper shell scripts
├── data/                  # Sample data files
├── db/migrations/         # Database migrations
├── docs/                  # Documentation
└── docker-compose.yml     # Docker orchestration
```

## Tech Stack

- **Ruby 3.4** - Language
- **Sinatra** - Lightweight web framework
- **Sidekiq** - Background job processing
- **PostgreSQL** - Primary database
- **Redis** - Job queue for Sidekiq
- **RSpec** - Testing framework
- **Docker** - Containerization
