# Markr - System Design

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Compose                           │
│  ┌─────────────────────────────┐  ┌─────────────────────────┐  │
│  │         Markr App           │  │       PostgreSQL        │  │
│  │        (Ruby/Sinatra)       │  │                         │  │
│  │                             │  │  ┌───────────────────┐  │  │
│  │  ┌───────────────────────┐  │  │  │   test_results    │  │  │
│  │  │     HTTP Layer        │  │  │  ├───────────────────┤  │  │
│  │  │  POST /import         │──┼──┼─▶│ student_number    │  │  │
│  │  │  GET /results/:id/agg │  │  │  │ test_id           │  │  │
│  │  └───────────────────────┘  │  │  │ marks_available   │  │  │
│  │            │                │  │  │ marks_obtained    │  │  │
│  │            ▼                │  │  │ scanned_on        │  │  │
│  │  ┌───────────────────────┐  │  │  └───────────────────┘  │  │
│  │  │    Loader Layer       │  │  │                         │  │
│  │  │  (XML, JSON, CSV)     │  │  └─────────────────────────┘  │
│  │  └───────────────────────┘  │                               │
│  │            │                │                               │
│  │            ▼                │                               │
│  │  ┌───────────────────────┐  │                               │
│  │  │   Aggregator Layer    │  │                               │
│  │  │ (Mean, StdDev, P25..) │  │                               │
│  │  └───────────────────────┘  │                               │
│  └─────────────────────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. HTTP Layer (Sinatra)

**Responsibilities:**
- Route handling
- Content-type detection and loader dispatch
- Request validation
- Response formatting (JSON)
- Error handling (HTTP status codes)

**Endpoints:**

| Method | Path | Content-Type | Description |
|--------|------|--------------|-------------|
| POST | `/import` | `text/xml+markr` | Import test results |
| GET | `/results/:test_id/aggregate` | `application/json` | Get statistics |

---

### 2. Loader Layer

**Responsibilities:**
- Parse incoming data formats
- Validate required fields
- Transform to domain models
- Extensible for new formats

**Interface:**
```ruby
class Loadable
  def parse(content) → Array<TestResult>
  def supported_content_type → String
end
```

**Implementations:**
- `XmlLoader` - Parses `text/xml+markr`
- `JsonLoader` - Future: `application/json`
- `CsvLoader` - Future: `text/csv`

**Loader Factory:**
```ruby
LoaderFactory.for_content_type('text/xml+markr') → XmlLoader
```

---

### 3. Repository Layer

**Responsibilities:**
- Persist test results to PostgreSQL
- Handle duplicate logic (keep highest score)
- Query results for aggregation

**Interface:**
```ruby
class TestResultRepository
  def save(test_result) → TestResult
  def find_by_test_id(test_id) → Array<TestResult>
  def exists?(test_id) → Boolean
end
```

**Duplicate Handling:**
```sql
INSERT INTO test_results (student_number, test_id, marks_available, marks_obtained)
VALUES (?, ?, ?, ?)
ON CONFLICT (student_number, test_id)
DO UPDATE SET
  marks_obtained = GREATEST(test_results.marks_obtained, EXCLUDED.marks_obtained),
  marks_available = EXCLUDED.marks_available;
```

---

### 4. Aggregator Layer

**Responsibilities:**
- Calculate individual statistics
- Single responsibility per aggregator
- Composable via AggregateReport

**Interface:**
```ruby
class Aggregatable
  def key → String        # e.g., "mean", "p50"
  def calculate(scores) → Float
end
```

**Implementations:**
- `MeanAggregator`
- `StdDevAggregator`
- `MinAggregator`
- `MaxAggregator`
- `PercentileAggregator` (configurable: p25, p50, p75)
- `CountAggregator`

**Composition:**
```ruby
AggregateReport.new(scores)
  .add(MeanAggregator.new)
  .add(StdDevAggregator.new)
  .add(PercentileAggregator.new(25))
  .build
# => { "mean" => 72.5, "stddev" => 12.3, "p25" => 65.0 }
```

---

### 5. Model Layer

**TestResult:**
```ruby
class TestResult
  attr_accessor :student_number, :test_id, :marks_available, :marks_obtained, :scanned_on

  def percentage
    (marks_obtained.to_f / marks_available * 100).round(2)
  end
end
```

---

## Data Flow

### Import Flow

```
1. POST /import (text/xml+markr)
         │
         ▼
2. HTTP Layer: Detect content-type
         │
         ▼
3. LoaderFactory.for_content_type('text/xml+markr')
         │
         ▼
4. XmlLoader.parse(body)
         │
         ├── Validate required fields
         ├── Extract test results
         └── Return Array<TestResult>
         │
         ▼
5. TestResultRepository.save(result) for each
         │
         ├── Insert or update (keep highest score)
         └── Return saved result
         │
         ▼
6. HTTP Layer: Return 201 Created
```

### Aggregation Flow

```
1. GET /results/9863/aggregate
         │
         ▼
2. TestResultRepository.find_by_test_id('9863')
         │
         ├── Query all results for test
         └── Return Array<TestResult>
         │
         ▼
3. Extract percentages: results.map(&:percentage)
         │
         ▼
4. AggregateReport.new(percentages)
         │
         ├── Add all aggregators
         └── Build statistics hash
         │
         ▼
5. HTTP Layer: Return JSON response
```

---

## Database Schema

### Table: test_results

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| student_number | VARCHAR(50) | NOT NULL |
| test_id | VARCHAR(50) | NOT NULL |
| marks_available | INTEGER | NOT NULL |
| marks_obtained | INTEGER | NOT NULL |
| scanned_on | TIMESTAMP | |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |

**Indexes:**
- UNIQUE INDEX on `(student_number, test_id)` - For duplicate handling
- INDEX on `test_id` - For aggregation queries

**SQL:**
```sql
CREATE TABLE test_results (
  id SERIAL PRIMARY KEY,
  student_number VARCHAR(50) NOT NULL,
  test_id VARCHAR(50) NOT NULL,
  marks_available INTEGER NOT NULL,
  marks_obtained INTEGER NOT NULL,
  scanned_on TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(student_number, test_id)
);

CREATE INDEX idx_test_results_test_id ON test_results(test_id);
```

---

## Docker Architecture

### docker-compose.yml

```yaml
services:
  app:
    build: .
    ports:
      - "4567:4567"
    environment:
      - DATABASE_URL=postgres://markr:markr@db:5432/markr
    depends_on:
      - db

  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=markr
      - POSTGRES_PASSWORD=markr
      - POSTGRES_DB=markr
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Dockerfile

```dockerfile
FROM ruby:3.2

WORKDIR /app
COPY Gemfile Gemfile.lock ./
RUN bundle install
COPY . .

EXPOSE 4567
CMD ["bundle", "exec", "ruby", "app.rb", "-o", "0.0.0.0"]
```

---

## Error Handling

| Scenario | HTTP Status | Response Body |
|----------|-------------|---------------|
| Valid import | 201 | `{ "imported": 5 }` |
| Malformed XML | 400 | `{ "error": "Invalid XML" }` |
| Missing required field | 400 | `{ "error": "Missing student-number" }` |
| Unsupported content-type | 415 | `{ "error": "Unsupported media type" }` |
| Test not found | 404 | `{ "error": "Test not found" }` |
| Server error | 500 | `{ "error": "Internal server error" }` |

---

## Security Considerations

1. **Input Validation** - Sanitize all XML input, prevent XXE attacks
2. **SQL Injection** - Use parameterized queries (handled by ORM)
3. **Content-Type Enforcement** - Strict content-type checking

---

## Scalability Notes (Future)

1. **Horizontal Scaling** - Stateless app, can run multiple instances
2. **Caching** - Redis for aggregation results (invalidate on import)
3. **Async Processing** - Queue large imports for background processing
4. **Read Replicas** - Separate read/write for heavy aggregation loads
