# CLAUDE.md - Project Guidelines

## About This Project

Markr is a data ingestion microservice for exam results. Built as an interview code submission demonstrating clean architecture and SOLID principles.

## Developer Style Preferences

### Architecture Patterns

1. **Template Method + Interface**
   - Abstract base class with `NotImplementedError` for required methods
   - Subclasses implement specific behavior
   ```ruby
   class BaseLoader
     def parse(content)
       raise NotImplementedError
     end
   end
   ```

2. **Composable "Add & Execute"**
   - Method chaining for building pipelines
   ```ruby
   report.add(MeanAggregator.new).add(StdDevAggregator.new).build
   ```

3. **Single-Purpose Classes**
   - One class = one responsibility
   - Prefer many small classes over few large ones
   - Examples: `MeanAggregator`, `XmlLoader`, `PercentileAggregator`

4. **Strategy via Composition**
   - Swap behavior by injecting different objects
   - No conditionals for type switching

5. **Open/Closed Principle**
   - Add new features by adding classes, not modifying existing code
   - New loader? Add `JsonLoader`. New aggregator? Add `MedianAggregator`.

### Directory Structure

Mirror the domain with clear separation:
```
lib/
├── loader/           # Data ingestion (XML, JSON, CSV)
│   ├── loadable.rb   # Interface
│   └── xml_loader.rb
├── aggregator/       # Statistics calculations
│   ├── aggregatable.rb
│   ├── mean.rb
│   └── percentile.rb
├── model/            # Domain entities
│   └── test_result.rb
└── report/           # Composition layer
    └── aggregate_report.rb
```

### Testing

- **TDD approach**: Write tests FIRST, then implement
- **RSpec + FactoryBot** for Ruby projects
- **Mirror source structure** in test directory
- **Factory helpers** for creating test objects
- **One test file per class**

### Code Style

- Ruby 3.x
- 2-space indentation
- Single quotes for strings (unless interpolation needed)
- Explicit `return` only when early-returning
- No trailing whitespace
- Newline at end of file

### Naming Conventions

- Classes: `PascalCase` (e.g., `XmlLoader`, `MeanAggregator`)
- Methods/variables: `snake_case`
- Constants: `SCREAMING_SNAKE_CASE`
- Interfaces/base classes: suffix with `-able` or `Base-` (e.g., `Loadable`, `BaseAggregator`)

### Git Workflow

- Commit at meaningful milestones
- Commit message format: imperative mood, concise
- Examples:
  - "Add XML loader with validation"
  - "Implement mean and stddev aggregators"
  - "Add RSpec tests for aggregators"

## Project-Specific Context

### XML Format

```xml
<mcq-test-results>
  <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
    <first-name>KJ</first-name>
    <last-name>Alysander</last-name>
    <student-number>002299</student-number>
    <test-id>9863</test-id>
    <summary-marks available="20" obtained="13" />
  </mcq-test-result>
</mcq-test-results>
```

- Ignore `<answer>` elements - use `<summary-marks>` only
- `available` = total marks possible
- `obtained` = marks student received

### Key Business Rules

1. **Duplicate handling**: Same student + same test = keep highest score
2. **Percentages**: All stats (except count) are percentages: `(obtained / available) * 100`
3. **Validation**: Reject entire document if required fields missing

### Required Endpoints

- `POST /import` - Content-Type: `text/xml+markr`
- `GET /results/:test-id/aggregate` - Returns JSON stats

### Tech Stack

- Ruby 3.4
- Sinatra (HTTP layer)
- Sidekiq (async job processing)
- PostgreSQL (persistence)
- Redis (job queue)
- RSpec (testing)
- Docker + docker-compose (deployment)

## Commands

```bash
# Run tests
bundle exec rspec

# Run server locally
bundle exec ruby app.rb

# Run Sidekiq worker locally
bundle exec sidekiq -r ./lib/markr.rb -q imports

# Docker (recommended)
docker-compose up --build

# Force rebuild after code changes
docker-compose build --no-cache && docker-compose up
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/import` | Sync import (small batches) |
| POST | `/import/async` | Async import via Sidekiq |
| GET | `/jobs/:job_id` | Check async job status |
| GET | `/results/:test_id/aggregate` | Get statistics |
| GET | `/health` | Health check |

## Extending the Codebase

See `docs/5_SKILLS.md` for detailed examples:
- Adding new aggregators (e.g., Median)
- Adding new loader formats (JSON, CSV)
- Adding new endpoints
