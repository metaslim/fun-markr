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
3. See `SKILLS.md` for full guide

## Architecture Quick Reference

```
POST /import → Queue to Redis → Sidekiq Worker → Save to DB → Compute Aggregates → Mark Complete
GET /jobs/:id → Check sidekiq-status for job state (queued, working, complete, failed)
GET /tests   → Read pre-computed aggregates from DB
```

**Database:** students → test_results → test_aggregates (JSON)

**Auth:** Basic auth `markr:secret` (except `/health`)

## Extension Guide

See `SKILLS.md` for detailed guides on adding aggregators, loaders, API endpoints, frontend pages, and AI assistant tools.
