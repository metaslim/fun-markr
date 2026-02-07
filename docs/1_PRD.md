# Markr - Product Requirements Document

## Overview

Markr is a data ingestion microservice for an exam-marking platform. It receives test results from scanning machines, stores them persistently, and provides statistical aggregations for analytics dashboards.

---

## Problem Statement

Exam scanning machines produce test results in various formats (initially XML). The system needs to:
1. Ingest results reliably, handling malformed/duplicate data
2. Store results persistently for downstream analytics
3. Provide real-time statistical aggregations per test

---

## Core Features

### F1: Import Test Results

**Endpoint:** `POST /import`

**Content-Type:** `text/xml+markr` (initially; extensible to other formats)

**Behavior:**
- Parse incoming test result documents
- Extract student scores (use `summary-marks` only, ignore individual answers)
- Handle duplicates: if same student + same test submitted multiple times, keep the **highest score**
- Reject entire document if required fields are missing
- Return appropriate HTTP status codes

**Required Fields:**
- `test-id` - Unique identifier for the test
- `student-number` - Unique identifier for the student
- `summary-marks.available` - Total marks available
- `summary-marks.obtained` - Marks obtained by student

**Success Response:** `201 Created` (or `200 OK` for updates)

**Error Responses:**
- `400 Bad Request` - Malformed XML or missing required fields
- `415 Unsupported Media Type` - Unsupported content-type

---

### F2: Aggregate Results

**Endpoint:** `GET /results/:test-id/aggregate`

**Response Content-Type:** `application/json`

**Response Body:**
```json
{
  "mean": 65.5,
  "stddev": 12.3,
  "min": 25.0,
  "max": 95.0,
  "p25": 55.0,
  "p50": 67.5,
  "p75": 78.0,
  "count": 150
}
```

**Calculation Notes:**
- All values (except `count`) are **percentages** (0-100) of available marks
- Formula: `(obtained / available) * 100`
- Percentiles use linear interpolation

**Error Responses:**
- `404 Not Found` - Test ID does not exist

---

## Non-Functional Requirements

### NF1: Deployment
- Provide `docker-compose.yml` for single-command deployment
- Service should be production-ready with `docker-compose up`

### NF2: Persistence
- Data must survive container restarts
- Use PostgreSQL for reliable storage and efficient stats queries

### NF3: Extensibility
- Loader interface must support future formats (JSON, CSV)
- Aggregator interface must support adding new statistics without modifying existing code

### NF4: Testing
- Comprehensive automated test suite
- TDD approach: tests written before implementation

### NF5: Documentation
- README with setup instructions
- Document assumptions and design decisions

---

## Assumptions

1. **XML is just the first format** - System will support JSON, CSV in the future via pluggable loaders
2. **Aggregations are extensible** - New statistics (median, mode, range) can be added without breaking existing code
3. **Duplicate handling is per student per test** - Same student can appear in different tests
4. **Available marks can vary per student** - Different test versions may have different totals
5. **Scores are stored as raw values** - Percentages calculated at query time
6. **Single test per document** - Each XML document contains results for one test only (multiple students)

---

## Out of Scope (v1)

- Authentication/Authorization
- Rate limiting
- Batch export endpoints
- Real-time WebSocket updates
- Multi-tenancy

---

## Future Scalability Considerations

> The current visualisation solution generates printed & mailed reports overnight, so aggregate fetching doesn't need to be fast. However, real-time dashboards are planned for City Hall - worth considering even if the prototype is simple.

### Current State (Prototype)
- Synchronous import processing
- Aggregations calculated on-demand from database
- Acceptable for overnight batch reports

### Future State (Real-time Dashboards)

**Challenge:** Real-time dashboards require fast aggregate queries even with millions of records.

**Recommended Architecture:**

1. **Async Import Processing**
   - Import endpoint returns `202 Accepted` immediately
   - Background worker (Sidekiq/Resque) processes XML
   - Enables handling large batch imports without timeout
   ```
   POST /import → 202 Accepted { "job_id": "abc123" }
   GET /jobs/abc123 → { "status": "completed", "imported": 500 }
   ```

2. **Pre-computed Aggregates**
   - Maintain `test_aggregates` table with cached statistics
   - Update incrementally on each import (not full recalculation)
   - Aggregation endpoint reads from cache, returns instantly
   ```sql
   CREATE TABLE test_aggregates (
     test_id VARCHAR PRIMARY KEY,
     count INTEGER,
     sum_percentage DECIMAL,
     sum_squared DECIMAL,  -- for stddev
     min_percentage DECIMAL,
     max_percentage DECIMAL,
     percentiles JSONB,    -- pre-computed p25, p50, p75
     updated_at TIMESTAMP
   );
   ```

3. **Event-Driven Updates**
   - Publish events on import: `test_result.imported`
   - Aggregate service subscribes and updates cache
   - Enables real-time dashboard updates via WebSocket

4. **Read Replicas**
   - Separate read/write databases
   - Dashboard queries hit read replica
   - Imports go to primary

**Migration Path:**
1. Phase 1 (current): Synchronous, on-demand calculation
2. Phase 2: Add background jobs for imports
3. Phase 3: Add aggregate caching
4. Phase 4: Add WebSocket for real-time updates

---

## Acceptance Criteria

### AC1: Basic Import
```
GIVEN a valid XML document with test results
WHEN POST /import is called
THEN results are stored and 201 is returned
```

### AC2: Duplicate Handling (Higher Score)
```
GIVEN a student has an existing score of 50 for test-123
WHEN a new result with score 60 is imported
THEN the stored score becomes 60 (higher score wins)
```

### AC3: Duplicate Handling (Lower Score)
```
GIVEN a student has an existing score of 80 for test-123
WHEN a new result with score 70 is imported
THEN the stored score remains 80 (higher score preserved)
```

### AC4: Missing Fields
```
GIVEN an XML document missing student-number
WHEN POST /import is called
THEN 400 Bad Request is returned
AND no data is stored
```

### AC5: Aggregation
```
GIVEN test-123 has results: [50/100, 75/100, 100/100]
WHEN GET /results/test-123/aggregate is called
THEN response includes mean=75.0, min=50.0, max=100.0, count=3
```

### AC6: Unknown Test
```
GIVEN test-999 does not exist
WHEN GET /results/test-999/aggregate is called
THEN 404 Not Found is returned
```

### AC7: Unsupported Content-Type
```
GIVEN content-type is application/json (not yet supported)
WHEN POST /import is called
THEN 415 Unsupported Media Type is returned
```

---

## XML Format

```xml
<mcq-test-results>
  <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
    <first-name>KJ</first-name>
    <last-name>Alysander</last-name>
    <student-number>002299</student-number>
    <test-id>9863</test-id>
    <summary-marks available="20" obtained="13" />
  </mcq-test-result>
  <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
    <first-name>John</first-name>
    <last-name>Smith</last-name>
    <student-number>521585129</student-number>
    <test-id>9863</test-id>
    <summary-marks available="20" obtained="17" />
  </mcq-test-result>
</mcq-test-results>
```

**Note:** Ignore `<answer>` elements. Use `<summary-marks>` only.

---

## Success Metrics

1. All acceptance criteria pass
2. Test coverage > 90%
3. `docker-compose up` starts the service successfully
4. Clean, extensible architecture following SOLID principles
