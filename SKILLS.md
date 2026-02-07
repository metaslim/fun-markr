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

2. Add to `lib/markr.rb`:

```ruby
require_relative 'markr/aggregator/median'
```

3. Add to worker `lib/markr/worker/import_worker.rb`:

```ruby
.add(Aggregator::Median.new)
```

4. Add test in `spec/aggregator/median_spec.rb`

No database migration needed - aggregates stored as JSON.

## Add New Loader (e.g., JSON)

Example: Add JSON loader.

1. Create `lib/markr/loader/json_loader.rb`:

```ruby
require 'json'
require_relative 'loadable'
require_relative '../model/test_result'

module Markr
  module Loader
    class JsonLoader < Loadable
      CONTENT_TYPE = 'application/json'.freeze

      def parse(content)
        data = JSON.parse(content)
        data['results'].map do |r|
          validate!(r)
          Model::TestResult.new(
            student_number: r['student_number'],
            test_id: r['test_id'],
            marks_available: r['marks_available'],
            marks_obtained: r['marks_obtained']
          )
        end
      end

      def supported_content_type
        CONTENT_TYPE
      end

      private

      def validate!(r)
        raise InvalidDocumentError, 'Missing student_number' unless r['student_number']
        raise InvalidDocumentError, 'Missing test_id' unless r['test_id']
        raise InvalidDocumentError, 'Missing marks' unless r['marks_available'] && r['marks_obtained']
      end
    end
  end
end
```

2. Register in `lib/markr/loader/loader_factory.rb`:

```ruby
require_relative 'json_loader'

LOADERS = [XmlLoader, JsonLoader].freeze
```

3. Add to `lib/markr.rb`:

```ruby
require_relative 'markr/loader/json_loader'
```

4. Add tests in `spec/loader/json_loader_spec.rb`

## Add New Endpoint

1. Add route in `app.rb`:

```ruby
get '/results/:test_id/students' do
  # your code
end
```

2. Add integration test in `spec/integration/api_spec.rb`

## Key Files

| File | Purpose |
|------|---------|
| `app.rb` | HTTP routes |
| `lib/markr/worker/import_worker.rb` | Async processing |
| `lib/markr/loader/` | Parsers (XML, etc.) |
| `lib/markr/aggregator/` | Stats calculations |
| `lib/markr/repository/` | Database operations |
| `db/migrations/` | Schema changes |

## Testing

```bash
bundle exec rspec                    # All tests
bundle exec rspec spec/aggregator/   # Aggregator tests only
bundle exec rspec --format doc       # Verbose output
```

## Database

- `test_results` - Raw student scores
- `test_aggregates` - Pre-computed stats as JSON (no migration needed to add stats)
