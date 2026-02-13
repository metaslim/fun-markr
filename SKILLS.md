# Engineering Practices

Principles and practices for building reliable, performant software. Distilled from real production lessons.

---

## 1. Data Integrity Under Concurrency

### Never check-then-act

The most common concurrency bug in web applications: read the database to see if a record exists, then insert if it doesn't. Two concurrent requests can both see "not exists" and both try to insert, causing duplicates or constraint violations.

**The fix is always the same: make the database enforce it.**

Use upserts (`INSERT ... ON CONFLICT`), not application-level conditionals. Let the database's unique constraints be the source of truth. Your application code should declare intent ("save this record, update if it already exists") and let the database handle the atomicity.

This applies everywhere: user creation, deduplication, counters, toggle states. If two requests can race, they will.

### Use transactions as boundaries, not just safety nets

A transaction isn't just "rollback if something fails." It's a **unit of work boundary**. When you have a sequence of writes that must be consistent with each other, wrap them in a single transaction. This is especially important for batch operations where partial completion would leave the system in a bad state.

### Lock what you compute

When multiple workers can compute the same derived data simultaneously, the last writer wins and intermediate computations are wasted. Use advisory locks or row-level locks scoped to the specific resource being computed. The lock should live inside a transaction so it's automatically released on commit or rollback.

The key insight: lock at the **logical resource level** (e.g., per-entity), not at the table level. Coarse locks kill throughput.

---

## 2. Database Access Patterns

### Eliminate N+1 queries

The single most impactful performance fix in most applications. If you're calling the database inside a loop, you have an N+1 problem.

Signs you have it:
- `results.each { |r| repo.save(r) }` inside a loop
- Looking up a related record for each item in a collection
- Your import of 1,000 records makes 3,000 database calls

The fix:
- Batch inserts into a single transaction
- Fetch related records in bulk (one query for all IDs) before the loop
- Use joins or subqueries instead of sequential lookups

### Fetch only what you need

Don't build full domain objects when you only need a single derived value. If you need percentages, compute them in SQL. If you need counts, use `COUNT(*)`. Don't fetch 10 columns, instantiate objects, and extract one field.

This matters most in aggregation and reporting paths, where you're processing many records and only need a narrow slice of each.

### Paginate everything that can grow

Every list endpoint will eventually have too many records. Add `limit` and `offset` (or cursor-based pagination) from day one. It's much harder to retrofit pagination than to include it upfront.

Default to a reasonable page size (50-100) and enforce a maximum. This protects both your database and your frontend from unbounded responses.

### Index with intention

Indexes should match your actual query patterns, not just your schema. Composite indexes matter: an index on `(test_id, score)` serves queries that filter by test and sort by score in a single index scan. An index on just `test_id` would require a separate sort step.

Add indexes for:
- Foreign keys (most ORMs don't do this automatically)
- Columns used in `WHERE`, `ORDER BY`, and `JOIN` clauses
- Composite columns used together in queries
- Columns in unique constraints (to back upserts)

---

## 3. Resource Management

### Size your pools to match your concurrency

If you have 10 concurrent workers and a connection pool of 5, half your workers are waiting for a database connection before they even start working. Pool starvation is a silent performance killer.

**Rule of thumb:** connection pool size >= worker concurrency. Configure both from environment variables so they stay in sync across deployments.

### Don't parse what you can stream

When validating input before processing it, avoid building a full in-memory representation twice. If you need to validate XML, use a streaming parser (SAX) for validation and a DOM parser only for the actual data extraction. The validation step should be as cheap as possible since most inputs are valid.

This principle extends beyond XML: validate CSV headers without parsing the body, check JSON structure with a schema validator before deserializing, validate image headers without loading pixels.

### Pre-compute expensive results

If the same expensive computation is needed by multiple consumers, do it once and share the result. Sort data once at the entry point, not in every function that touches it. Compute aggregates on write, not on every read.

The trade-off is freshness vs. latency. For data that changes on import but is read frequently, pre-computing on write and caching the result is almost always the right call.

---

## 4. API Design

### Accept the work, process it later

For operations that take more than a couple hundred milliseconds, return immediately with a job ID and process asynchronously. This keeps your API responsive and lets clients poll or subscribe for completion.

The pattern: `POST /import` returns `202 Accepted` with a `job_id`, the client polls `GET /jobs/:id` for status. The server does the heavy lifting in a background worker.

### Validate early, fail fast

Validate input format at the API boundary before queuing work. A malformed document should return `400 Bad Request` immediately, not get queued, processed, and fail in a background worker where the error is harder to surface.

But keep validation lightweight: check syntax and required fields at the boundary, defer business rule validation to the processing layer.

### Make error responses useful

Every error response should include:
- An appropriate HTTP status code (not 200 with an error body)
- A human-readable error message
- Enough context to debug without checking server logs

---

## 5. Frontend Performance

### Defer expensive initialization

Never load heavy resources (large models, complex libraries, big datasets) on page mount. Users may never interact with the feature that needs them. Load on first interaction: open a panel, click a button, navigate to a route.

The difference between a 2-second and a 6-second initial load is often a single eager import.

### Poll with backoff, not intervals

Fixed-interval polling (`setInterval`) hammers your server at a constant rate regardless of whether anything has changed. Use exponential backoff: start with short intervals, increase them over time. Reset when the user takes an action.

And poll in parallel when checking multiple jobs: `Promise.allSettled` not sequential `await` in a loop.

### Clean up after yourself

Every subscription, interval, timeout, and async operation started in a component must be cancelled when that component unmounts. Use a cancelled flag pattern or AbortController. Without cleanup, you get:
- State updates on unmounted components (React warnings)
- Memory leaks from accumulated listeners
- Stale data from orphaned requests

### Cap unbounded client-side collections

Any in-memory store that grows over a session (navigation history, viewed items, cached responses) needs a size cap. Without one, a long session will eventually consume enough memory to degrade performance. Simple FIFO eviction (drop oldest when cap is reached) works for most cases.

---

## 6. Testing

### Tests should not depend on infrastructure

If your tests require Redis, PostgreSQL, or any external service running to pass, they are fragile and will fail in CI, on new developer machines, and during offline work.

Use in-memory alternatives (SQLite for database tests), mocking libraries for external services, and the testing utilities that your dependencies provide (most background job libraries have a test mode that stubs external calls).

### Test the unit, not the framework

When testing a worker, call `worker.perform(args)` directly. Don't go through the framework's `perform_async` which adds middleware, serialization, and infrastructure dependencies you're not trying to test.

When testing an API endpoint that needs data, insert it through the repository layer directly. Don't go through the import pipeline when you're testing the read path.

### Mock at the boundary, not in the middle

Inject dependencies through constructors or setters, then replace them with test doubles in tests. This keeps your mocks stable: they match the public interface of the dependency, not internal implementation details.

When your production code changes (e.g., `save` becomes `bulk_save`), update the mock to match. If you find yourself constantly updating mocks, your abstractions may be too leaky.

### Pre-existing failures are tech debt, not normal

If your test suite has "known failures" that everyone ignores, your test suite is lying to you. Fix them or delete them. A test suite that cries wolf teaches developers to ignore failures, and real regressions slip through.

---

## 7. Design Patterns That Pay Off

### Repository pattern for data access

All database operations go through a repository. No raw SQL in controllers, workers, or business logic. This gives you one place to optimize queries, add caching, or swap databases.

### Strategy + Registry for extensible computation

When you need to add new calculations, parsers, or processors without modifying existing code: define a common interface, implement each variant as a separate class, and register them in a central registry. Adding a new one is just writing a class and registering it. No switch statements, no modification of existing code.

### Factory for input handling

When different inputs need different parsers (XML, CSV, JSON), use a factory that selects the right one based on the input type. The caller doesn't need to know which parser to use. The factory maps content types to implementations.

### Dependency injection for testability

Make dependencies configurable. Use constructor parameters or class-level setters so tests can inject mocks. This is the single most important pattern for testable code.

---

## 8. Operational Awareness

### Configure through environment variables

Concurrency levels, pool sizes, database URLs, feature flags - all should come from environment variables with sensible defaults. This lets you tune production without deploying code, and keeps configuration out of version control.

### Make health checks real

A `/health` endpoint that always returns 200 is useless. Check your actual dependencies: can you reach the database? Is the job queue accessible? Return degraded status when a dependency is down so your load balancer can act on it.

### Log at decision points, not everywhere

Log when you make a decision (skipped a record, chose a code path, retried an operation) not on every line of execution. Include context: what entity, what decision, what the inputs were. This makes debugging possible without making log storage unaffordable.

---

## Summary: The Short Version

| Principle | In practice |
|-----------|-------------|
| Let the database enforce invariants | Upserts, unique constraints, foreign keys |
| Batch database operations | One transaction, not N queries in a loop |
| Lock what you compute | Advisory locks scoped to the resource |
| Fetch only what you need | SQL projections, not full object hydration |
| Paginate from day one | Default limits, enforced maximums |
| Accept and process later | 202 + job ID for heavy operations |
| Validate at the boundary | Fast format checks before queuing |
| Defer heavy initialization | Load on first use, not on mount |
| Poll with backoff | Exponential intervals, parallel checks |
| Clean up on unmount | Cancelled flags, AbortController |
| Cap client-side state | FIFO eviction for session collections |
| Test without infrastructure | In-memory DBs, framework test modes |
| Test the unit directly | Call the method, not the framework |
| Inject dependencies | Constructors and setters for testability |
| Configure through environment | Env vars with sensible defaults |
