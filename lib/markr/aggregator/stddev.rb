require_relative 'aggregatable'

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
