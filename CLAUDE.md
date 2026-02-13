# CLAUDE.md

This file helps Claude Code understand how to work with this codebase.

## Project Overview

Markr is a test results microservice with a React dashboard. Backend is Ruby/Sinatra with async processing via Sidekiq (using sidekiq-status for job tracking). Frontend is React/TypeScript with an AI assistant.

## Development Commands

```bash
# Start everything
docker-compose up --build        # Backend + Postgres + Redis + Sidekiq
cd frontend && npm run dev       # Frontend dev server

# Run tests
bundle exec rspec                # Backend tests

# Stop
docker-compose down -v           # Stop + remove volumes
```

## How to Write Code

### Backend (Ruby)

**Adding features:**
1. Routes go in `app.rb`
2. Business logic goes in `lib/markr/` - use the existing patterns:
   - `repository/` for database access (inherit from `BaseRepository`)
   - `aggregator/` for stats calculations (register in `Registry`)
   - `loader/` for data parsing (register in `LoaderFactory`)
   - `middleware/` for cross-cutting concerns (Auth, CORS)
   - `worker/` for async jobs
3. Register new classes in `lib/markr.rb`

**Key conventions:**
- Repositories abstract all database access
- Aggregates are pre-computed on import, stored as JSON
- Duplicates (same student+test): keep highest `marks_obtained` AND highest `marks_available`
- Reject entire document if any required field missing

**Testing:**
- Use RSpec, tests in `spec/`
- Inject mock repositories via class setters

### Frontend (React/TypeScript)

**Adding features:**
1. Pages go in `src/pages/`
2. Add route in `src/App.tsx`
3. Add API function in `src/services/api.ts`
4. Add types in `src/types/index.ts`

**Key conventions:**
- Use Tailwind for styling
- Use Zustand for state (`src/stores/`)
- AI assistant panel in `src/components/AssistantPanel.tsx`
- AI tools in `src/lib/tools/` (each tool in separate file)
- Job tracking store in `src/stores/jobStore.ts` (persists to localStorage)
- Layout has Jobs dropdown in right icon bar for tracking imports

**Adding AI Assistant tools:**
1. Create tool file in `src/lib/tools/myTool.ts`
2. Register in `src/lib/tools/index.ts`

## Architecture Quick Reference

```
POST /import → Queue to Redis → Sidekiq Worker → Save to DB → Compute Aggregates → Mark Complete
GET /jobs/:id → Check sidekiq-status for job state (queued, working, complete, failed)
GET /tests   → Read pre-computed aggregates from DB
```

**Database:** students → test_results → test_aggregates (JSON)

**Auth:** Basic auth `markr:secret` (except `/health`)

## Performance & Concurrency Lessons

These are hard-won lessons from a performance/concurrency review. Follow these patterns to avoid regressions.

### Backend

**Use upserts, not check-then-act:**
- Never do `SELECT` then `INSERT/UPDATE` - this creates race conditions under concurrent Sidekiq workers
- Use `insert_conflict` (Sequel's upsert) for all create-or-update operations
- See `student_repository.rb` (`upsert_student`, `bulk_upsert`) and `test_result_repository.rb` (`upsert_result`) for examples

**Batch database operations:**
- Never loop `repository.save(result)` per item - this causes N+1 queries
- Use `bulk_save` to wrap all inserts in a single transaction
- Fetch related IDs in bulk (`find_ids`) instead of one-by-one lookups

**Advisory locks for aggregation:**
- Concurrent workers computing aggregates for the same test_id will race
- Use PostgreSQL `pg_advisory_xact_lock` inside a transaction to serialize per test_id
- Guard with `database_type == :postgres` check for SQLite compatibility

**Connection pool sizing:**
- `max_connections` in Sequel must match or exceed Sidekiq concurrency
- Set via `DB_POOL_SIZE` env var, default 10

**Avoid double parsing:**
- XML validation + parsing should not build the DOM tree twice
- Use SAX-based validation (stream-only, no tree) for the validate step
- CSV double-parse is cheap and acceptable; XML is not

**Pre-sort shared data:**
- When multiple aggregators need sorted scores, sort once in `AggregateReport` and pass pre-sorted data
- Aggregators should not redundantly sort

**Paginate list endpoints:**
- All endpoints returning unbounded lists must support `?limit=N&offset=M`
- Applies to `/tests`, `/students`, and any future list routes

### Frontend

**Lazy-load expensive resources:**
- Don't preload the LLM model on page mount - load it when the assistant panel opens
- Heavy initializations should be deferred until the user actually needs them

**Use exponential backoff for polling:**
- Job status polling should use `setTimeout` with increasing intervals, not `setInterval`
- Poll in parallel with `Promise.allSettled` instead of sequential `for` loops

**Cancel async work on unmount:**
- Use a `cancelled` flag pattern in `useEffect` cleanup to prevent state updates after unmount
- Prevents React "setState on unmounted component" warnings

**Cap unbounded collections:**
- Zustand stores holding history (pageHistory, viewedTests) must have size caps
- Without caps, long sessions will leak memory

### Testing

- Use `sidekiq-status/testing/inline` to stub Redis storage in specs
- Mock `database` (with `transaction` and `database_type`) when testing worker aggregate computation
- When changing repository APIs (e.g., `save` → `bulk_save`), update spec mocks to match
- Call `worker.perform()` directly for unit tests instead of going through `perform_async`

## Engineering Practices

See `SKILLS.md` for general engineering practices on performance, concurrency, testing, and API design.
