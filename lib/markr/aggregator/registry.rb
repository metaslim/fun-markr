require_relative 'mean'
require_relative 'stddev'
require_relative 'min'
require_relative 'max'
require_relative 'count'
require_relative 'percentile'

module Markr
  module Aggregator
    class Registry
      DEFAULT_AGGREGATORS = [
        Mean,
        StdDev,
        Min,
        Max,
        Count,
        -> { Percentile.new(25) },
        -> { Percentile.new(50) },
        -> { Percentile.new(75) }
      ].freeze

      def initialize
        @aggregators = []
      end

      def register(aggregator_or_proc)
        @aggregators << aggregator_or_proc
        self
      end

      def build_all
        @aggregators.map do |agg|
          agg.respond_to?(:call) ? agg.call : agg.new
        end
      end

      def self.default
        registry = new
        DEFAULT_AGGREGATORS.each { |agg| registry.register(agg) }
        registry
      end
    end
  end
end
