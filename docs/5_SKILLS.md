# Markr - Skills & Extension Guide

This guide demonstrates how to extend the codebase following SOLID principles. The architecture is designed so you can add new features by adding classes, not modifying existing code.

---

## Skill 1: Add a New Aggregator

**Example:** Add a `Median` aggregator

### Step 1: Create the spec (TDD)

```ruby
# spec/aggregator/median_spec.rb
require 'spec_helper'

RSpec.describe Markr::Aggregator::Median do
  subject { described_class.new }

  describe '#key' do
    it 'returns "median"' do
      expect(subject.key).to eq('median')
    end
  end

  describe '#calculate' do
    it 'returns 0.0 for empty array' do
      expect(subject.calculate([])).to eq(0.0)
    end

    it 'returns the middle value for odd count' do
      expect(subject.calculate([10, 20, 30])).to eq(20.0)
    end

    it 'returns average of middle values for even count' do
      expect(subject.calculate([10, 20, 30, 40])).to eq(25.0)
    end
  end
end
```

### Step 2: Implement the aggregator

```ruby
# lib/markr/aggregator/median.rb
require_relative 'aggregatable'

module Markr
  module Aggregator
    class Median < Aggregatable
      def key
        'median'
      end

      def calculate(scores)
        return 0.0 if scores.empty?
        sorted = scores.sort
        mid = sorted.size / 2

        if sorted.size.odd?
          sorted[mid].to_f
        else
          ((sorted[mid - 1] + sorted[mid]) / 2.0).round(2)
        end
      end
    end
  end
end
```

### Step 3: Register in lib/markr.rb

```ruby
# lib/markr.rb
require_relative 'markr/aggregator/median'
```

### Step 4: Use in app.rb (optional - add to default report)

```ruby
# app.rb
report = Markr::Report::AggregateReport.new(scores)
  .add(Markr::Aggregator::Mean.new)
  .add(Markr::Aggregator::Median.new)  # <-- Add here
  .add(Markr::Aggregator::StdDev.new)
  # ...
```

---

## Skill 2: Add a New Loader Format

**Example:** Add a `JsonLoader` for `application/json`

### Step 1: Create the spec (TDD)

```ruby
# spec/loader/json_loader_spec.rb
require 'spec_helper'

RSpec.describe Markr::Loader::JsonLoader do
  subject { described_class.new }

  describe '#supported_content_type' do
    it 'returns application/json' do
      expect(subject.supported_content_type).to eq('application/json')
    end
  end

  describe '#parse' do
    let(:valid_json) do
      <<~JSON
        {
          "results": [
            {
              "student_number": "002299",
              "test_id": "9863",
              "marks_available": 20,
              "marks_obtained": 13
            }
          ]
        }
      JSON
    end

    it 'returns array of TestResult objects' do
      results = subject.parse(valid_json)
      expect(results).to all(be_a(Markr::Model::TestResult))
    end

    it 'extracts student_number' do
      results = subject.parse(valid_json)
      expect(results.first.student_number).to eq('002299')
    end

    context 'with missing required fields' do
      let(:invalid_json) { '{"results": [{"test_id": "123"}]}' }

      it 'raises InvalidDocumentError' do
        expect { subject.parse(invalid_json) }
          .to raise_error(Markr::Loader::InvalidDocumentError)
      end
    end
  end
end
```

### Step 2: Implement the loader

```ruby
# lib/markr/loader/json_loader.rb
require 'json'
require_relative 'loadable'
require_relative '../model/test_result'

module Markr
  module Loader
    class JsonLoader < Loadable
      CONTENT_TYPE = 'application/json'.freeze

      def parse(content)
        data = JSON.parse(content)
        extract_results(data)
      end

      def supported_content_type
        CONTENT_TYPE
      end

      private

      def extract_results(data)
        results = data['results'] || []
        results.map do |item|
          validate_item!(item)
          build_test_result(item)
        end
      end

      def validate_item!(item)
        raise InvalidDocumentError, 'Missing student_number' unless item['student_number']
        raise InvalidDocumentError, 'Missing test_id' unless item['test_id']
        raise InvalidDocumentError, 'Missing marks_available' unless item['marks_available']
        raise InvalidDocumentError, 'Missing marks_obtained' unless item['marks_obtained']
      end

      def build_test_result(item)
        Model::TestResult.new(
          student_number: item['student_number'],
          test_id: item['test_id'],
          marks_available: item['marks_available'].to_i,
          marks_obtained: item['marks_obtained'].to_i,
          scanned_on: item['scanned_on']
        )
      end
    end
  end
end
```

### Step 3: Register in LoaderFactory

```ruby
# lib/markr/loader/loader_factory.rb
require_relative 'json_loader'

module Markr
  module Loader
    class LoaderFactory
      LOADERS = {
        'text/xml+markr' => XmlLoader,
        'application/json' => JsonLoader  # <-- Add here
      }.freeze

      # ... rest unchanged
    end
  end
end
```

### Step 4: Register in lib/markr.rb

```ruby
# lib/markr.rb
require_relative 'markr/loader/json_loader'
```

**No changes needed to app.rb** - the factory handles dispatch automatically!

---

## Skill 3: Add a CSV Loader

Similar pattern to JSON loader:

```ruby
# lib/markr/loader/csv_loader.rb
require 'csv'
require_relative 'loadable'

module Markr
  module Loader
    class CsvLoader < Loadable
      CONTENT_TYPE = 'text/csv'.freeze

      def parse(content)
        CSV.parse(content, headers: true).map do |row|
          validate_row!(row)
          build_test_result(row)
        end
      end

      def supported_content_type
        CONTENT_TYPE
      end

      private

      def validate_row!(row)
        raise InvalidDocumentError, 'Missing student_number' unless row['student_number']
        raise InvalidDocumentError, 'Missing test_id' unless row['test_id']
        # ... etc
      end

      def build_test_result(row)
        Model::TestResult.new(
          student_number: row['student_number'],
          test_id: row['test_id'],
          marks_available: row['marks_available'].to_i,
          marks_obtained: row['marks_obtained'].to_i
        )
      end
    end
  end
end
```

Register in factory:
```ruby
LOADERS = {
  'text/xml+markr' => XmlLoader,
  'application/json' => JsonLoader,
  'text/csv' => CsvLoader
}.freeze
```

---

## Skill 4: Add Pre-computed Aggregates (Performance)

For real-time dashboards, cache aggregates on import:

### Step 1: Create migration

```ruby
# db/migrations/002_create_test_aggregates.rb
Sequel.migration do
  change do
    create_table(:test_aggregates) do
      String :test_id, primary_key: true
      Integer :count, default: 0
      Float :sum_percentage, default: 0.0
      Float :sum_squared, default: 0.0  # For stddev calculation
      Float :min_percentage
      Float :max_percentage
      column :percentages, 'jsonb'  # Store all percentages for percentile calc
      DateTime :updated_at
    end
  end
end
```

### Step 2: Create AggregateCache service

```ruby
# lib/markr/service/aggregate_cache.rb
module Markr
  module Service
    class AggregateCache
      def initialize(db)
        @db = db
      end

      def update(test_id, percentage)
        existing = @db[:test_aggregates].where(test_id: test_id).first

        if existing
          update_existing(test_id, existing, percentage)
        else
          insert_new(test_id, percentage)
        end
      end

      def get(test_id)
        @db[:test_aggregates].where(test_id: test_id).first
      end

      private

      def update_existing(test_id, existing, percentage)
        percentages = existing[:percentages] + [percentage]
        @db[:test_aggregates].where(test_id: test_id).update(
          count: existing[:count] + 1,
          sum_percentage: existing[:sum_percentage] + percentage,
          sum_squared: existing[:sum_squared] + (percentage ** 2),
          min_percentage: [existing[:min_percentage], percentage].min,
          max_percentage: [existing[:max_percentage], percentage].max,
          percentages: Sequel.pg_jsonb(percentages),
          updated_at: Time.now
        )
      end

      def insert_new(test_id, percentage)
        @db[:test_aggregates].insert(
          test_id: test_id,
          count: 1,
          sum_percentage: percentage,
          sum_squared: percentage ** 2,
          min_percentage: percentage,
          max_percentage: percentage,
          percentages: Sequel.pg_jsonb([percentage]),
          updated_at: Time.now
        )
      end
    end
  end
end
```

---

## Skill 5: Add a New Endpoint

**Example:** Add `GET /results/:test_id/distribution` for histogram data

### Step 1: Add spec

```ruby
# In spec/integration/api_spec.rb
describe 'GET /results/:test_id/distribution' do
  before do
    # Import test data with various scores
  end

  it 'returns histogram buckets' do
    get '/results/9863/distribution'
    body = JSON.parse(last_response.body)

    expect(body['buckets']).to include(
      { 'range' => '0-10', 'count' => 0 },
      { 'range' => '60-70', 'count' => 1 }
    )
  end
end
```

### Step 2: Add endpoint to app.rb

```ruby
# app.rb
get '/results/:test_id/distribution' do
  test_id = params[:test_id]

  halt 404, { error: 'Test not found' }.to_json unless self.class.repository.exists?(test_id)

  results = self.class.repository.find_by_test_id(test_id)
  scores = results.map(&:percentage)

  buckets = (0..90).step(10).map do |start|
    {
      range: "#{start}-#{start + 10}",
      count: scores.count { |s| s >= start && s < start + 10 }
    }
  end

  { test_id: test_id, buckets: buckets }.to_json
end
```

---

## Architecture Principles

| Principle | How It's Applied |
|-----------|------------------|
| **Open/Closed** | Add new loaders/aggregators without modifying existing code |
| **Single Responsibility** | Each aggregator does one calculation |
| **Dependency Inversion** | Report depends on Aggregatable interface, not concrete classes |
| **Liskov Substitution** | Any Aggregatable can be swapped in the report |
| **Interface Segregation** | Small interfaces: `#key`, `#calculate`, `#parse` |

---

## Testing Pattern

Always follow TDD:

1. **RED**: Write failing spec first
2. **GREEN**: Implement minimal code to pass
3. **REFACTOR**: Clean up, follow patterns

```bash
# Run specific spec
bundle exec rspec spec/aggregator/median_spec.rb

# Run all specs
bundle exec rspec

# Run with documentation
bundle exec rspec --format documentation
```

---

## Test Data Files

Edge case test data is available in `data/`:

| File | Description | Expected |
|------|-------------|----------|
| `sample_results.xml` | Full sample data from challenge | 201 Created |
| `edge_duplicates.xml` | Same student submits multiple times | Keeps highest score |
| `edge_missing_fields.xml` | Missing student-number | 400 Bad Request |
| `edge_missing_testid.xml` | Missing test-id | 400 Bad Request |
| `edge_missing_marks.xml` | Missing summary-marks | 400 Bad Request |
| `edge_malformed.xml` | Invalid XML syntax | 400 Bad Request |
| `edge_perfect_scores.xml` | All students score 100% | stddev = 0 |
| `edge_zero_scores.xml` | All students score 0% | mean = 0 |
| `edge_single_student.xml` | Only one student | count = 1 |
| `edge_varied_available.xml` | Different available marks | Normalized percentages |
| `edge_multiple_tests.xml` | Multiple tests in one import | Separated by test_id |
| `edge_empty.xml` | No results in document | imported = 0 |

Run all edge case tests:
```bash
./scripts/test-edge-cases.sh
```
