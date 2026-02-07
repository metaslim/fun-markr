# CLAUDE.md

## Commands

```bash
# Backend
bundle exec rspec              # Run tests
docker-compose up --build      # Start services
docker-compose down -v         # Stop + remove volumes

# Frontend
cd frontend && npm run dev     # Dev server
cd frontend && npm run build   # Production build
```

## Database Schema

```
students (id, student_number, name)
    ↓
test_results (id, student_id FK, test_id, marks_available, marks_obtained)
    ↓
test_aggregates (test_id, data JSON)
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/import` | Import XML, returns job_id |
| GET | `/jobs/:job_id` | Poll job status |
| GET | `/tests` | List all tests |
| GET | `/results/:test_id/aggregate` | Test statistics |
| GET | `/tests/:test_id/students` | Students in test |
| GET | `/students` | List all students |
| GET | `/students/:num` | Student's results |
| GET | `/students/:num/tests/:id` | Specific result |
| GET | `/health` | Health check (no auth) |

## Frontend Routes

| Route | Page |
|-------|------|
| `/` | Dashboard |
| `/tests` | Test list |
| `/tests/:id` | Test detail |
| `/tests/:id/students` | Students in test |
| `/students` | Student list |
| `/students/:num` | Student detail |
| `/import` | Import XML |

## Key Rules

- Duplicates: keep highest score per student+test
- Missing fields: reject entire document
- Aggregates: pre-computed as JSON on import
- Auth: Basic auth `markr:secret` (except /health)

## Key Files

| File | Purpose |
|------|---------|
| `app.rb` | HTTP routes |
| `lib/markr/worker/import_worker.rb` | Async processing |
| `lib/markr/repository/` | Database operations |
| `db/migrations/001_create_test_results.rb` | Schema (students + test_results) |
| `frontend/src/pages/` | React pages |
| `frontend/src/components/ChatAgent.tsx` | AI assistant |
