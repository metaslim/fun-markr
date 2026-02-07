# CLAUDE.md

## Commands

```bash
bundle exec rspec           # Tests
docker-compose up --build   # Docker
./scripts/run-all.sh        # Everything
./scripts/demo.sh           # Demo
```

## Flow

```
POST /import → 202 + job_id
     ↓
Poll GET /jobs/:job_id → until "completed"
     ↓
GET /results/:test_id/aggregate → pre-computed stats
```

All async via Sidekiq. Aggregates stored as JSON blob.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/import` | Import XML, returns job_id |
| GET | `/jobs/:job_id` | Poll until `completed` |
| GET | `/results/:test_id/aggregate` | Pre-computed stats |
| GET | `/health` | Health (no auth) |

## Rules

- Duplicates: keep highest score
- Missing fields: job fails, check `/jobs/:job_id` for error
- Retry: 3 attempts then dead queue
- Aggregates: percentages as JSON
