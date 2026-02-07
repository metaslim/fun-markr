# Markr - Task Breakdown

## Phase 1: Project Setup

### T1.1: Initialize Project Structure
- [ ] Create directory structure (`lib/markr/`, `spec/`, `db/`)
- [ ] Create `Gemfile` with dependencies
- [ ] Create `Rakefile` for running tests
- [ ] Create `spec/spec_helper.rb` with RSpec config
- [ ] Run `bundle install`

### T1.2: Database Setup
- [ ] Create migration file `db/migrations/001_create_test_results.rb`
- [ ] Create database connection config
- [ ] Test migration runs successfully

**Commit: "Set up project structure and database migration"**

---

## Phase 2: Model Layer (TDD)

### T2.1: TestResult Model
- [ ] Write spec: `spec/model/test_result_spec.rb`
  - Test initialization with attributes
  - Test `#percentage` calculation
  - Test `#valid?` with valid/invalid data
- [ ] Implement: `lib/markr/model/test_result.rb`
- [ ] Green tests

**Commit: "Add TestResult model with percentage calculation"**

---

## Phase 3: Aggregator Layer (TDD)

### T3.1: Aggregatable Interface
- [ ] Create base class: `lib/markr/aggregator/aggregatable.rb`

### T3.2: Mean Aggregator
- [ ] Write spec: `spec/aggregator/mean_spec.rb`
  - Test `#key` returns "mean"
  - Test `#calculate` with sample data
  - Test empty array edge case
- [ ] Implement: `lib/markr/aggregator/mean.rb`
- [ ] Green tests

### T3.3: StdDev Aggregator
- [ ] Write spec: `spec/aggregator/stddev_spec.rb`
- [ ] Implement: `lib/markr/aggregator/stddev.rb`
- [ ] Green tests

### T3.4: Min Aggregator
- [ ] Write spec: `spec/aggregator/min_spec.rb`
- [ ] Implement: `lib/markr/aggregator/min.rb`
- [ ] Green tests

### T3.5: Max Aggregator
- [ ] Write spec: `spec/aggregator/max_spec.rb`
- [ ] Implement: `lib/markr/aggregator/max.rb`
- [ ] Green tests

### T3.6: Count Aggregator
- [ ] Write spec: `spec/aggregator/count_spec.rb`
- [ ] Implement: `lib/markr/aggregator/count.rb`
- [ ] Green tests

### T3.7: Percentile Aggregator
- [ ] Write spec: `spec/aggregator/percentile_spec.rb`
  - Test p25, p50, p75
  - Test edge cases (single element, empty)
- [ ] Implement: `lib/markr/aggregator/percentile.rb`
- [ ] Green tests

**Commit: "Add aggregator layer with all statistics calculations"**

---

## Phase 4: Report Layer (TDD)

### T4.1: AggregateReport
- [ ] Write spec: `spec/report/aggregate_report_spec.rb`
  - Test `#add` chaining
  - Test `#build` returns hash with all aggregator results
- [ ] Implement: `lib/markr/report/aggregate_report.rb`
- [ ] Green tests

**Commit: "Add AggregateReport with composable aggregators"**

---

## Phase 5: Loader Layer (TDD)

### T5.1: Loadable Interface
- [ ] Create base class: `lib/markr/loader/loadable.rb`

### T5.2: XmlLoader
- [ ] Write spec: `spec/loader/xml_loader_spec.rb`
  - Test `#parse` with valid XML
  - Test `#parse` with missing fields (raises error)
  - Test `#parse` with malformed XML (raises error)
  - Test `#supported_content_type`
- [ ] Implement: `lib/markr/loader/xml_loader.rb`
- [ ] Green tests

### T5.3: LoaderFactory
- [ ] Write spec: `spec/loader/loader_factory_spec.rb`
  - Test returns `XmlLoader` for `text/xml+markr`
  - Test raises `UnsupportedContentTypeError` for unknown type
- [ ] Implement: `lib/markr/loader/loader_factory.rb`
- [ ] Green tests

**Commit: "Add loader layer with XML support and factory"**

---

## Phase 6: Repository Layer (TDD)

### T6.1: TestResultRepository
- [ ] Write spec: `spec/repository/test_result_repository_spec.rb`
  - Test `#save` creates new record
  - Test `#save` updates with higher score (duplicate)
  - Test `#save` keeps existing higher score (duplicate)
  - Test `#find_by_test_id` returns results
  - Test `#exists?` returns true/false
- [ ] Implement: `lib/markr/repository/test_result_repository.rb`
- [ ] Green tests

**Commit: "Add repository layer with duplicate handling"**

---

## Phase 7: HTTP Layer (TDD)

### T7.1: POST /import Endpoint
- [ ] Write spec: `spec/integration/api_spec.rb`
  - Test valid import returns 201
  - Test invalid XML returns 400
  - Test missing fields returns 400
  - Test unsupported content-type returns 415
- [ ] Implement: `app.rb` POST /import route
- [ ] Green tests

### T7.2: GET /results/:test_id/aggregate Endpoint
- [ ] Add spec to `spec/integration/api_spec.rb`
  - Test returns correct JSON with all stats
  - Test unknown test_id returns 404
- [ ] Implement: `app.rb` GET /results/:test_id/aggregate route
- [ ] Green tests

**Commit: "Add HTTP API with import and aggregate endpoints"**

---

## Phase 8: Docker Setup

### T8.1: Dockerfile
- [ ] Create `Dockerfile`
- [ ] Test `docker build` succeeds

### T8.2: docker-compose.yml
- [ ] Create `docker-compose.yml` with app + postgres
- [ ] Test `docker-compose up` starts services
- [ ] Test endpoints work via Docker

**Commit: "Add Docker and docker-compose configuration"**

---

## Phase 9: Documentation & Polish

### T9.1: README
- [ ] Write setup instructions
- [ ] Document API endpoints
- [ ] List assumptions and design decisions

### T9.2: Final Testing
- [ ] Run full test suite
- [ ] Test with sample data from challenge
- [ ] Verify all acceptance criteria pass

**Commit: "Add README and finalize documentation"**

---

## Task Dependencies

```
T1.1 ──► T1.2 ──► T2.1 ──► T3.* ──► T4.1 ──► T5.* ──► T6.1 ──► T7.* ──► T8.* ──► T9.*
                    │
                    └──────────────────────────────────────────────────────────────┘
                                        (Model used throughout)
```

---

## TDD Cycle Reminder

For each implementation task:

1. **RED**: Write failing test first
2. **GREEN**: Write minimal code to pass
3. **REFACTOR**: Clean up, maintain patterns

---

## Estimated Commits

1. "Set up project structure and database migration"
2. "Add TestResult model with percentage calculation"
3. "Add aggregator layer with all statistics calculations"
4. "Add AggregateReport with composable aggregators"
5. "Add loader layer with XML support and factory"
6. "Add repository layer with duplicate handling"
7. "Add HTTP API with import and aggregate endpoints"
8. "Add Docker and docker-compose configuration"
9. "Add README and finalize documentation"
