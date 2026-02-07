# Models
require_relative 'markr/model/test_result'

# Loaders
require_relative 'markr/loader/loadable'
require_relative 'markr/loader/xml_loader'
require_relative 'markr/loader/loader_factory'

# Aggregators
require_relative 'markr/aggregator/aggregatable'
require_relative 'markr/aggregator/mean'
require_relative 'markr/aggregator/stddev'
require_relative 'markr/aggregator/min'
require_relative 'markr/aggregator/max'
require_relative 'markr/aggregator/count'
require_relative 'markr/aggregator/percentile'

# Reports
require_relative 'markr/report/aggregate_report'

# Repository
require_relative 'markr/repository/test_result_repository'
require_relative 'markr/repository/aggregate_repository'

# Workers
require_relative 'markr/worker/import_worker'
