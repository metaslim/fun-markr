# Markr

A data ingestion microservice for exam results.

## Build & Run Instructions

### Docker (Recommended)

```bash
# Start everything
docker-compose up --build

# Or use the all-in-one script
./scripts/run-all.sh
```

This starts:
- **app** on port 4567
- **worker** (Sidekiq)
- **db** (PostgreSQL)
- **redis**

### Verify It Works

```bash
./scripts/demo.sh
```

### Stop

```bash
docker-compose down
```

### Local Development (Without Docker)

```bash
# Install dependencies
bundle install

# Terminal 1: Start the app
bundle exec ruby app.rb

# Terminal 2: Start Sidekiq worker
bundle exec sidekiq -r ./lib/markr.rb -q imports

# Terminal 3: Run tests
bundle exec rspec
```

Requires: Ruby 3.4, PostgreSQL, Redis

---

## Key Assumptions

1. **Duplicate Handling**: When a student submits the same test twice, we keep the **highest score**. Rationale: students may re-scan to improve scores.

2. **Document Rejection**: If ANY required field is missing (`student-number`, `test-id`, `summary-marks`), the **entire document is rejected** with HTTP 400. This matches the requirement that rejected documents get printed for manual entry.

3. **Answer Elements Ignored**: We only use `<summary-marks>` for scoring. Individual `<answer>` elements are ignored per the spec.

4. **Percentages**: All aggregation values (except count) are percentages: `(obtained / available) * 100`.

5. **Async Everything**: All imports are processed asynchronously via Sidekiq. This handles large batch imports without timeouts.

6. **Pre-computed Aggregates**: Aggregates are computed during import and stored as JSON. This makes dashboard queries instant and allows adding new stats without schema changes.

---

## Approach

### Architecture

```
POST /import → Validates XML → Queues to Redis → Returns 202 with job_id
                                                          ↓
                                              Poll GET /jobs/:job_id
                                                          ↓
Sidekiq Worker → Parses XML → Saves test_results → Computes & saves aggregates (JSON)
                                                          ↓
                                              Status: completed
                                                          ↓
GET /aggregate → Reads pre-computed JSON from test_aggregates
```

### Design Decisions

- **Sinatra**: Lightweight, perfect for a microservice
- **Sidekiq + Redis**: Battle-tested async job processing
- **PostgreSQL**: Reliable, good for production
- **JSON blob for aggregates**: Extensible without migrations

### Patterns Used

- **Factory**: `LoaderFactory` dispatches by content-type (easy to add JSON/CSV later)
- **Strategy**: Each aggregator is a single class (Mean, StdDev, Percentile)
- **Repository**: Abstracts database operations
- **Composition**: `AggregateReport` uses fluent interface to compose stats

---

## Things to Note

### Pre-computed Aggregates

Aggregates are computed by the Sidekiq worker during import and stored as JSON in `test_aggregates`. This means:
- Dashboard queries are instant (no calculation on read)
- Adding new stats = update worker code, no schema change
- Each import recomputes aggregates for affected tests

### Test Coverage

106 automated tests covering unit tests, integration tests, and edge cases.

```bash
bundle exec rspec
```

### Authentication

All endpoints (except `/health`) require HTTP Basic Auth.

Default: `markr:secret`

---

## API Reference

### POST /import

Import test results. Returns job_id for polling.

```bash
curl -u markr:secret -X POST http://localhost:4567/import \
  -H "Content-Type: text/xml+markr" \
  -d @data/sample_results.xml
```

**Response:** `202 Accepted`
```json
{ "job_id": "abc123", "status": "queued" }
```

### GET /jobs/:job_id

Poll job status. **Must wait for `completed` before fetching aggregate.**

```bash
curl -u markr:secret http://localhost:4567/jobs/abc123
```

**Response:**
```json
{ "job_id": "abc123", "status": "completed" }
```

Statuses: `queued`, `processing`, `completed`, `failed`, `dead`

### GET /results/:test_id/aggregate

Get pre-computed statistics. **Only available after job completes.**

```bash
curl -u markr:secret http://localhost:4567/results/9863/aggregate
```

```json
{
  "mean": 50.8,
  "count": 81,
  "min": 30.0,
  "max": 75.0,
  "stddev": 9.92,
  "p25": 45.0,
  "p50": 50.0,
  "p75": 55.0
}
```

### GET /health

Health check (no auth required).

---

## Error Handling

| Scenario | HTTP Status |
|----------|-------------|
| Import queued | 202 |
| Malformed XML | 400 |
| Missing required fields | 400 |
| Wrong content-type | 415 |
| Unauthorized | 401 |
| Test not found | 404 |

---

## Tech Stack

Ruby 3.4, Sinatra, Sidekiq, PostgreSQL, Redis, RSpec, Docker
