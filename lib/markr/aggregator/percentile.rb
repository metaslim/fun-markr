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
        sorted = scores.sort
        return sorted.first if sorted.size == 1

        rank = (@percentile / 100.0) * (sorted.size - 1)
        lower = sorted[rank.floor]
        upper = sorted[rank.ceil]
        (lower + (upper - lower) * (rank - rank.floor)).round(2)
      end
    end
  end
end
