# Skills

How to extend this codebase.

## Add New Aggregator

Example: Add `median` aggregator.

1. Create `lib/markr/aggregator/median.rb`:

```ruby
module Markr
  module Aggregator
    class Median
      def name
        'median'
      end

      def calculate(scores)
        sorted = scores.sort
        mid = sorted.length / 2
        sorted.length.odd? ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2.0
      end
    end
  end
end
```

2. Register in `lib/markr.rb` and add to worker's aggregator chain.

No database migration needed - aggregates stored as JSON.

## Add New Loader (e.g., JSON)

1. Create `lib/markr/loader/json_loader.rb` implementing `Loadable`
2. Register in `lib/markr/loader/loader_factory.rb`
3. Add tests

## Add New API Endpoint

1. Add route in `app.rb`
2. Add repository method if needed
3. Add integration test

## Add Frontend Page

1. Create page in `frontend/src/pages/`
2. Add route in `frontend/src/App.tsx`
3. Add API function in `frontend/src/services/api.ts`
4. Update types in `frontend/src/types/index.ts`

## Database Schema

```
students
├── id (PK)
├── student_number (unique)
├── name
└── timestamps

test_results
├── id (PK)
├── student_id (FK → students)
├── test_id
├── marks_available
├── marks_obtained
├── scanned_on
└── timestamps

test_aggregates
├── test_id (unique)
└── data (JSON blob)
```

## Key Files

| File | Purpose |
|------|---------|
| `app.rb` | HTTP routes |
| `lib/markr/worker/import_worker.rb` | Async processing |
| `lib/markr/loader/` | Parsers (XML, etc.) |
| `lib/markr/aggregator/` | Stats calculations |
| `lib/markr/repository/` | Database operations |
| `db/migrations/` | Schema |
| `frontend/src/pages/` | React pages |
| `frontend/src/services/api.ts` | API client |
| `frontend/src/stores/contextStore.ts` | AI context |

## Testing

```bash
bundle exec rspec                    # All tests
bundle exec rspec spec/aggregator/   # Specific folder
bundle exec rspec --format doc       # Verbose
```
