require_relative 'aggregatable'

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
        # Scores are pre-sorted by AggregateReport
        return scores.first if scores.size == 1

        rank = (@percentile / 100.0) * (scores.size - 1)
        lower = scores[rank.floor]
        upper = scores[rank.ceil]
        (lower + (upper - lower) * (rank - rank.floor)).round(2)
      end
    end
  end
end
