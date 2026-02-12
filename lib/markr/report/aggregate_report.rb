module Markr
  module Report
    class AggregateReport
      def initialize(scores)
        @scores = scores.sort  # Sort once, reused by all aggregators (e.g. Percentile)
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
