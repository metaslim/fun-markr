# Markr - Code Design

## Directory Structure

```
markr/
├── app.rb                      # Sinatra entry point
├── Gemfile
├── Dockerfile
├── docker-compose.yml
├── CLAUDE.md
├── README.md
├── config/
│   └── sidekiq.rb              # Sidekiq Redis configuration
├── docs/
│   ├── 1_PRD.md
│   ├── 2_SYSTEM_DESIGN.md
│   ├── 3_CODE_DESIGN.md
│   ├── 4_TASKS.md
│   └── 5_SKILLS.md             # Extension guide
├── db/
│   └── migrations/
│       └── 001_create_test_results.rb
├── lib/
│   ├── markr.rb                # Main require file
│   └── markr/
│       ├── loader/
│       │   ├── loadable.rb
│       │   ├── loader_factory.rb
│       │   └── xml_loader.rb
│       ├── aggregator/
│       │   ├── aggregatable.rb
│       │   ├── mean.rb
│       │   ├── stddev.rb
│       │   ├── min.rb
│       │   ├── max.rb
│       │   ├── count.rb
│       │   └── percentile.rb
│       ├── model/
│       │   └── test_result.rb
│       ├── repository/
│       │   └── test_result_repository.rb
│       ├── report/
│       │   └── aggregate_report.rb
│       └── worker/
│           └── import_worker.rb  # Sidekiq background job
└── spec/
    ├── spec_helper.rb
    ├── loader/
    │   ├── xml_loader_spec.rb
    │   └── loader_factory_spec.rb
    ├── aggregator/
    │   ├── mean_spec.rb
    │   ├── stddev_spec.rb
    │   ├── min_spec.rb
    │   ├── max_spec.rb
    │   ├── count_spec.rb
    │   └── percentile_spec.rb
    ├── model/
    │   └── test_result_spec.rb
    ├── repository/
    │   └── test_result_repository_spec.rb
    ├── report/
    │   └── aggregate_report_spec.rb
    ├── worker/
    │   └── import_worker_spec.rb
    └── integration/
        └── api_spec.rb
```

---

## Class Designs

### 1. Loader Layer

#### Loadable (Interface)

```ruby
# lib/markr/loader/loadable.rb
module Markr
  module Loader
    class Loadable
      def parse(content)
        raise NotImplementedError, "#{self.class} must implement #parse"
      end

      def supported_content_type
        raise NotImplementedError, "#{self.class} must implement #supported_content_type"
      end
    end
  end
end
```

#### XmlLoader

```ruby
# lib/markr/loader/xml_loader.rb
module Markr
  module Loader
    class XmlLoader < Loadable
      CONTENT_TYPE = 'text/xml+markr'.freeze

      def parse(content)
        doc = Nokogiri::XML(content) { |config| config.strict.nonet }
        validate!(doc)
        extract_results(doc)
      end

      def supported_content_type
        CONTENT_TYPE
      end

      private

      def validate!(doc)
        # Check for required elements
      end

      def extract_results(doc)
        doc.xpath('//mcq-test-result').map do |node|
          build_test_result(node)
        end
      end

      def build_test_result(node)
        Model::TestResult.new(
          student_number: node.at_xpath('student-number')&.text,
          test_id: node.at_xpath('test-id')&.text,
          marks_available: node.at_xpath('summary-marks')&.[]('available')&.to_i,
          marks_obtained: node.at_xpath('summary-marks')&.[]('obtained')&.to_i,
          scanned_on: node['scanned-on']
        )
      end
    end
  end
end
```

#### LoaderFactory

```ruby
# lib/markr/loader/loader_factory.rb
module Markr
  module Loader
    class LoaderFactory
      LOADERS = {
        'text/xml+markr' => XmlLoader
      }.freeze

      def self.for_content_type(content_type)
        loader_class = LOADERS[content_type]
        raise UnsupportedContentTypeError, content_type unless loader_class
        loader_class.new
      end
    end

    class UnsupportedContentTypeError < StandardError; end
  end
end
```

---

### 2. Aggregator Layer

#### Aggregatable (Interface)

```ruby
# lib/markr/aggregator/aggregatable.rb
module Markr
  module Aggregator
    class Aggregatable
      def key
        raise NotImplementedError, "#{self.class} must implement #key"
      end

      def calculate(scores)
        raise NotImplementedError, "#{self.class} must implement #calculate"
      end
    end
  end
end
```

#### Mean

```ruby
# lib/markr/aggregator/mean.rb
module Markr
  module Aggregator
    class Mean < Aggregatable
      def key
        'mean'
      end

      def calculate(scores)
        return 0.0 if scores.empty?
        (scores.sum.to_f / scores.size).round(2)
      end
    end
  end
end
```

#### StdDev

```ruby
# lib/markr/aggregator/stddev.rb
module Markr
  module Aggregator
    class StdDev < Aggregatable
      def key
        'stddev'
      end

      def calculate(scores)
        return 0.0 if scores.empty?
        mean = scores.sum.to_f / scores.size
        variance = scores.map { |s| (s - mean)**2 }.sum / scores.size
        Math.sqrt(variance).round(2)
      end
    end
  end
end
```

#### Min

```ruby
# lib/markr/aggregator/min.rb
module Markr
  module Aggregator
    class Min < Aggregatable
      def key
        'min'
      end

      def calculate(scores)
        scores.min || 0.0
      end
    end
  end
end
```

#### Max

```ruby
# lib/markr/aggregator/max.rb
module Markr
  module Aggregator
    class Max < Aggregatable
      def key
        'max'
      end

      def calculate(scores)
        scores.max || 0.0
      end
    end
  end
end
```

#### Count

```ruby
# lib/markr/aggregator/count.rb
module Markr
  module Aggregator
    class Count < Aggregatable
      def key
        'count'
      end

      def calculate(scores)
        scores.size
      end
    end
  end
end
```

#### Percentile

```ruby
# lib/markr/aggregator/percentile.rb
module Markr
  module Aggregator
    class Percentile < Aggregatable
      def initialize(percentile)
        @percentile = percentile
      end

      def key
        "p#{@percentile}"
      end

      def calculate(scores)
        return 0.0 if scores.empty?
        sorted = scores.sort
        rank = (@percentile / 100.0) * (sorted.size - 1)
        lower = sorted[rank.floor]
        upper = sorted[rank.ceil]
        (lower + (upper - lower) * (rank - rank.floor)).round(2)
      end
    end
  end
end
```

---

### 3. Report Layer

#### AggregateReport

```ruby
# lib/markr/report/aggregate_report.rb
module Markr
  module Report
    class AggregateReport
      def initialize(scores)
        @scores = scores
        @aggregators = []
      end

      def add(aggregator)
        @aggregators << aggregator
        self
      end

      def build
        @aggregators.each_with_object({}) do |aggregator, result|
          result[aggregator.key] = aggregator.calculate(@scores)
        end
      end
    end
  end
end
```

---

### 4. Model Layer

#### TestResult

```ruby
# lib/markr/model/test_result.rb
module Markr
  module Model
    class TestResult
      attr_accessor :id, :student_number, :test_id,
                    :marks_available, :marks_obtained, :scanned_on

      def initialize(attributes = {})
        @student_number = attributes[:student_number]
        @test_id = attributes[:test_id]
        @marks_available = attributes[:marks_available]
        @marks_obtained = attributes[:marks_obtained]
        @scanned_on = attributes[:scanned_on]
      end

      def percentage
        return 0.0 if marks_available.nil? || marks_available.zero?
        (marks_obtained.to_f / marks_available * 100).round(2)
      end

      def valid?
        !student_number.nil? && !student_number.empty? &&
          !test_id.nil? && !test_id.empty? &&
          !marks_available.nil? && marks_available.positive? &&
          !marks_obtained.nil? && marks_obtained >= 0
      end
    end
  end
end
```

---

### 5. Repository Layer

#### TestResultRepository

```ruby
# lib/markr/repository/test_result_repository.rb
module Markr
  module Repository
    class TestResultRepository
      def initialize(db)
        @db = db
      end

      def save(test_result)
        @db[:test_results].insert_conflict(
          target: [:student_number, :test_id],
          update: {
            marks_obtained: Sequel.function(:greatest,
              :marks_obtained,
              test_result.marks_obtained
            ),
            marks_available: test_result.marks_available,
            updated_at: Time.now
          }
        ).insert(
          student_number: test_result.student_number,
          test_id: test_result.test_id,
          marks_available: test_result.marks_available,
          marks_obtained: test_result.marks_obtained,
          scanned_on: test_result.scanned_on
        )
      end

      def find_by_test_id(test_id)
        @db[:test_results]
          .where(test_id: test_id)
          .map { |row| row_to_model(row) }
      end

      def exists?(test_id)
        @db[:test_results].where(test_id: test_id).count > 0
      end

      private

      def row_to_model(row)
        Model::TestResult.new(
          student_number: row[:student_number],
          test_id: row[:test_id],
          marks_available: row[:marks_available],
          marks_obtained: row[:marks_obtained],
          scanned_on: row[:scanned_on]
        )
      end
    end
  end
end
```

---

### 6. HTTP Layer (Sinatra)

#### app.rb

```ruby
# app.rb
require 'sinatra'
require 'json'
require_relative 'lib/markr'

class App < Sinatra::Base
  before do
    content_type :json
  end

  post '/import' do
    loader = Markr::Loader::LoaderFactory.for_content_type(request.content_type)
    results = loader.parse(request.body.read)

    results.each do |result|
      halt 400, { error: 'Invalid test result' }.to_json unless result.valid?
      repository.save(result)
    end

    status 201
    { imported: results.size }.to_json
  rescue Markr::Loader::UnsupportedContentTypeError
    halt 415, { error: 'Unsupported media type' }.to_json
  rescue Nokogiri::XML::SyntaxError => e
    halt 400, { error: "Invalid XML: #{e.message}" }.to_json
  end

  get '/results/:test_id/aggregate' do
    test_id = params[:test_id]

    halt 404, { error: 'Test not found' }.to_json unless repository.exists?(test_id)

    results = repository.find_by_test_id(test_id)
    scores = results.map(&:percentage)

    report = Markr::Report::AggregateReport.new(scores)
      .add(Markr::Aggregator::Mean.new)
      .add(Markr::Aggregator::StdDev.new)
      .add(Markr::Aggregator::Min.new)
      .add(Markr::Aggregator::Max.new)
      .add(Markr::Aggregator::Count.new)
      .add(Markr::Aggregator::Percentile.new(25))
      .add(Markr::Aggregator::Percentile.new(50))
      .add(Markr::Aggregator::Percentile.new(75))
      .build

    report.to_json
  end

  private

  def repository
    @repository ||= Markr::Repository::TestResultRepository.new(DB)
  end
end
```

---

### 7. Worker Layer

#### ImportWorker (Sidekiq)

```ruby
# lib/markr/worker/import_worker.rb
require 'sidekiq'
require 'sequel'

module Markr
  module Worker
    class ImportWorker
      include Sidekiq::Job

      sidekiq_options queue: 'imports', retry: 3

      def perform(content, content_type)
        loader = Loader::LoaderFactory.for_content_type(content_type)
        results = loader.parse(content)

        results.each do |result|
          raise Loader::InvalidDocumentError, 'Invalid test result' unless result.valid?
          self.class.repository.save(result)
        end
      end

      def self.repository
        @repository ||= Repository::TestResultRepository.new(database)
      end

      def self.database
        @database ||= Sequel.connect(ENV.fetch('DATABASE_URL', 'sqlite://db/markr_dev.db'))
      end
    end
  end
end
```

---

## Dependencies (Gemfile)

```ruby
source 'https://rubygems.org'

ruby '>= 3.4'

gem 'sinatra'
gem 'rackup'
gem 'puma'
gem 'nokogiri'
gem 'sequel'
gem 'pg'
gem 'sidekiq'
gem 'redis'

group :development, :test do
  gem 'rspec'
  gem 'rack-test'
  gem 'factory_bot'
  gem 'database_cleaner-sequel'
  gem 'sqlite3'
end
```

---

## Design Patterns Summary

| Pattern | Where | Purpose |
|---------|-------|---------|
| Template Method | `Loadable`, `Aggregatable` | Define interface, subclasses implement |
| Factory | `LoaderFactory` | Create loader based on content-type |
| Strategy | Aggregators | Swap calculation logic |
| Composition | `AggregateReport` | Compose aggregators dynamically |
| Repository | `TestResultRepository` | Abstract database operations |
| Builder | `AggregateReport#add` | Fluent interface for composition |
| Background Job | `ImportWorker` | Async processing via Sidekiq |

---

## SOLID Compliance

| Principle | Implementation |
|-----------|----------------|
| **S**ingle Responsibility | Each aggregator does one calculation |
| **O**pen/Closed | Add new loaders/aggregators without modifying existing code |
| **L**iskov Substitution | Any aggregator can replace another in the report |
| **I**nterface Segregation | Small, focused interfaces (`#key`, `#calculate`) |
| **D**ependency Inversion | Report depends on `Aggregatable` abstraction |
