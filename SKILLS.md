# Skills

How to extend this codebase.

## Design Patterns

| Pattern | Location | Purpose |
|---------|----------|---------|
| **Strategy** | `lib/markr/aggregator/` | Pluggable stats calculators |
| **Factory** | `lib/markr/loader/loader_factory.rb` | Select parser by content-type |
| **Registry** | `lib/markr/aggregator/registry.rb` | Configure aggregators without code changes |
| **Repository** | `lib/markr/repository/` | Abstract database access |
| **Middleware** | `lib/markr/middleware/` | Cross-cutting concerns (Auth, CORS) |
| **Worker** | `lib/markr/worker/` | Async job processing (uses sidekiq-status for tracking) |

## Add New Aggregator (Strategy Pattern)

Aggregators inherit from `Aggregatable` and implement `#key` and `#calculate(scores)`.

Example: Add `median` aggregator.

1. Create `lib/markr/aggregator/median.rb`:

```ruby
require_relative 'aggregatable'

module Markr
  module Aggregator
    class Median < Aggregatable
      def key
        'median'  # JSON key in output
      end

      def calculate(scores)
        return 0.0 if scores.empty?
        sorted = scores.sort
        mid = sorted.length / 2
        sorted.length.odd? ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2.0
      end
    end
  end
end
```

2. Register in `lib/markr.rb`:
```ruby
require_relative 'markr/aggregator/median'
```

3. Register in the aggregator registry (`lib/markr/aggregator/registry.rb`):
```ruby
DEFAULT_AGGREGATORS = [
  Mean,
  Median,  # Add here
  # ...
].freeze
```

Or register at runtime:
```ruby
Markr::Worker::ImportWorker.aggregator_registry.register(Median)
```

No database migration needed - aggregates stored as JSON.

## Add New Loader (Factory Pattern)

Loaders inherit from `Loadable` and implement `#parse(content)`.

1. Create `lib/markr/loader/json_loader.rb`:
```ruby
require_relative 'loadable'
require_relative '../model/test_result'

module Markr
  module Loader
    class JsonLoader < Loadable
      def parse(content)
        data = JSON.parse(content)
        data['results'].map { |r| Model::TestResult.new(**r) }
      end
    end
  end
end
```

2. Register in `lib/markr/loader/loader_factory.rb`:
```ruby
LOADERS = {
  'text/xml+markr' => XmlLoader,
  'application/json+markr' => JsonLoader  # Add here
}.freeze
```

3. Register in `lib/markr.rb` and add tests

## Add New Middleware

Middleware handles cross-cutting concerns (auth, CORS, logging).

1. Create `lib/markr/middleware/logging.rb`:
```ruby
module Markr
  module Middleware
    class Logging
      def initialize(app)
        @app = app
      end

      def call(env)
        start = Time.now
        status, headers, body = @app.call(env)
        puts "[#{status}] #{env['REQUEST_METHOD']} #{env['PATH_INFO']} (#{Time.now - start}s)"
        [status, headers, body]
      end
    end
  end
end
```

2. Register in `app.rb`:
```ruby
use Markr::Middleware::Logging
```

3. Register in `lib/markr.rb` and add tests

## Dependency Injection (Testing)

Repositories and registries injected via class-level setters:

```ruby
# In tests
before do
  Markr::Worker::ImportWorker.repository = mock_repo
  Markr::Worker::ImportWorker.aggregator_registry = custom_registry
end

after do
  Markr::Worker::ImportWorker.repository = nil  # Reset
  Markr::Worker::ImportWorker.aggregator_registry = nil
end
```

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

## Duplicate Handling

When importing, if the same student+test combination already exists:
- Keep the **highest** `marks_obtained`
- Keep the **highest** `marks_available`

This handles the scenario where a paper gets folded and some questions are covered during scanning, resulting in a lower `marks_available`. The system keeps the best of both values.

See `lib/markr/repository/test_result_repository.rb` → `update_if_higher_score` method.

## Key Files

| File | Purpose |
|------|---------|
| `app.rb` | HTTP routes |
| `lib/markr/middleware/auth.rb` | Authentication middleware |
| `lib/markr/middleware/cors.rb` | CORS middleware |
| `lib/markr/worker/import_worker.rb` | Async processing |
| `lib/markr/loader/` | Parsers (XML, etc.) |
| `lib/markr/aggregator/` | Stats calculations |
| `lib/markr/aggregator/registry.rb` | Aggregator configuration |
| `lib/markr/repository/` | Database operations |
| `lib/markr/repository/base_repository.rb` | Base class with error handling |
| `lib/markr/repository/test_result_repository.rb` | Results + duplicate handling |
| `db/migrations/` | Schema |
| `frontend/src/pages/` | React pages |
| `frontend/src/services/api.ts` | API client |
| `frontend/src/components/AssistantPanel.tsx` | AI assistant |
| `frontend/src/components/Layout.tsx` | App shell, nav, Jobs dropdown |
| `frontend/src/components/Tooltip.tsx` | Tooltip component |
| `frontend/src/stores/assistantStore.ts` | AI state |
| `frontend/src/stores/jobStore.ts` | Import job tracking (Zustand + persist) |

## AI Assistant

The assistant uses **Qwen 2.5 7B** via WebLLM with action-based tool calling.

### Architecture

```
src/lib/tools/
├── index.ts              # Tool registry + helper functions
├── types.ts              # Tool & ActionResult interfaces
├── listTests.ts          # Each tool in its own file
├── getTest.ts
├── getTopStudents.ts
├── getStrugglingStudents.ts
├── listStudents.ts
├── getStudent.ts
├── searchStudent.ts
├── getTestStats.ts
├── getClassOverview.ts
├── findAtRiskStudents.ts
├── getHardestTest.ts
├── getEasiestTest.ts
├── compareStudentToClass.ts
└── getPassingStudents.ts
```

### Add New Tool

1. Create `frontend/src/lib/tools/myTool.ts`:

```typescript
import { someApi } from '../../services/api';
import type { Tool } from './types';

export const myTool: Tool = {
  name: 'myTool',                              // Action name
  description: '[ACTION:myTool:ARG] - what it does',  // For LLM prompt
  loadingLabel: 'Doing something',             // Shown in UI while loading
  execute: async (arg, navigate) => {
    if (!arg) return { message: 'Error: No argument', suggestions: [] };

    const data = await someApi(arg);
    navigate('/relevant/path');

    // Return markdown message + follow-up suggestions
    return {
      message: `### Result\n\n${data}`,
      suggestions: ['Next action 1', 'Next action 2']
    };
  },
};
```

2. Register in `frontend/src/lib/tools/index.ts`:

```typescript
import { myTool } from './myTool';

const TOOLS: Tool[] = [
  // ...existing tools
  myTool,
];
```

3. (Optional) Add trigger words to system prompt in `AssistantPanel.tsx`:

```typescript
## RULES
// Add pattern matching for your tool
12. "my keyword" / "another keyword" → [ACTION:myTool:ARG]
```

### Tool Interface

```typescript
interface Tool {
  name: string;           // Unique identifier
  description: string;    // Goes into LLM system prompt
  loadingLabel: string;   // Shown in thinking indicator
  execute: (arg: string, navigate: (path: string) => void) => Promise<ActionResult>;
}

interface ActionResult {
  message: string;        // Markdown to display
  suggestions: string[];  // Follow-up buttons
}
```

### Current Tools

| Tool | Description |
|------|-------------|
| `listTests` | Show all tests |
| `getTest:ID` | Show single test |
| `getTopStudents:ID` | Top 5 performers |
| `getStrugglingStudents:ID` | Bottom 5 performers |
| `getPassingStudents:ID` | Students >= 50% |
| `listStudents` | Show all students |
| `getStudent:NUM` | Show student by number |
| `searchStudent:NAME` | Search by name |
| `getTestStats:ID` | Detailed statistics |
| `getClassOverview` | Overall summary |
| `findAtRiskStudents` | Failing multiple tests |
| `getHardestTest` | Lowest average test |
| `getEasiestTest` | Highest average test |
| `compareStudentToClass:NUM` | Student vs class average |

## Testing

```bash
bundle exec rspec                    # All tests
bundle exec rspec spec/aggregator/   # Specific folder
bundle exec rspec --format doc       # Verbose
```
