# Markr

A data ingestion microservice for exam results. Built as a coding challenge demonstrating clean architecture, SOLID principles, and TDD.

## Features

- **Import test results** via XML (extensible to other formats)
- **Aggregate statistics** (mean, stddev, min, max, percentiles)
- **Duplicate handling** - keeps highest score per student/test
- **PostgreSQL persistence** with Docker deployment

## Quick Start

```bash
# Start with Docker
docker-compose up

# Import test results
curl -X POST http://localhost:4567/import \
  -H "Content-Type: text/xml+markr" \
  -d @sample.xml

# Get aggregated results
curl http://localhost:4567/results/9863/aggregate
```

## API Endpoints

### POST /import

Import test results from XML.

**Content-Type:** `text/xml+markr`

**Request Body:**
```xml
<mcq-test-results>
  <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
    <student-number>002299</student-number>
    <test-id>9863</test-id>
    <summary-marks available="20" obtained="13" />
  </mcq-test-result>
</mcq-test-results>
```

**Response:** `201 Created`
```json
{ "imported": 2 }
```

**Errors:**
- `400` - Malformed XML or missing required fields
- `415` - Unsupported content type

### GET /results/:test_id/aggregate

Get statistical aggregation for a test.

**Response:** `200 OK`
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

All values (except `count`) are percentages (0-100).

**Errors:**
- `404` - Test not found

## Development

### Prerequisites

- Ruby 3.4+
- PostgreSQL (or SQLite for local dev)

### Setup

```bash
bundle install
```

### Run Tests

```bash
bundle exec rspec
```

### Run Locally

```bash
# With SQLite (default)
bundle exec ruby app.rb

# With PostgreSQL
DATABASE_URL=postgres://user:pass@localhost/markr bundle exec ruby app.rb
```

## Architecture

```
lib/markr/
├── loader/           # Data ingestion (XML, extensible)
│   ├── loadable.rb   # Interface
│   ├── xml_loader.rb
│   └── loader_factory.rb
├── aggregator/       # Statistics calculations
│   ├── aggregatable.rb
│   ├── mean.rb, stddev.rb, min.rb, max.rb, count.rb
│   └── percentile.rb
├── model/
│   └── test_result.rb
├── repository/
│   └── test_result_repository.rb
└── report/
    └── aggregate_report.rb
```

### Design Patterns

| Pattern | Where | Purpose |
|---------|-------|---------|
| Template Method | `Loadable`, `Aggregatable` | Define interface for subclasses |
| Factory | `LoaderFactory` | Create loader by content-type |
| Strategy | Aggregators | Swap calculation logic |
| Composition | `AggregateReport` | Compose aggregators dynamically |
| Repository | `TestResultRepository` | Abstract database operations |

### SOLID Principles

- **Single Responsibility** - Each aggregator does one calculation
- **Open/Closed** - Add new loaders/aggregators without modifying existing code
- **Liskov Substitution** - Any aggregator can replace another
- **Interface Segregation** - Small interfaces (`#key`, `#calculate`)
- **Dependency Inversion** - Report depends on abstraction, not concrete classes

## Assumptions

1. XML is the initial format; system designed for future JSON/CSV support
2. Duplicate submissions: same student + test = keep highest score
3. All statistics (except count) returned as percentages
4. Available marks can vary per student (different test versions)

## Test Coverage

90 tests covering:
- Unit tests for all models, loaders, aggregators
- Integration tests for API endpoints
- Edge cases (empty data, duplicates, validation)

```bash
bundle exec rspec --format documentation
```

## Future Scalability

The current implementation is synchronous and calculates aggregations on-demand. For real-time dashboards (planned for City Hall), consider:

### Async Import Processing
```
POST /import → 202 Accepted { "job_id": "abc123" }
Background worker processes XML
GET /jobs/abc123 → { "status": "completed" }
```

### Pre-computed Aggregates
- Cache statistics in `test_aggregates` table
- Update incrementally on import (not full recalculation)
- Aggregation endpoint returns instantly from cache

### Event-Driven Architecture
```
Import → Publish "test_result.imported" event
         → Aggregate service updates cache
         → WebSocket pushes to dashboard
```

See [docs/1_PRD.md](docs/1_PRD.md) for detailed scalability plan.
