require_relative 'aggregatable'

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
