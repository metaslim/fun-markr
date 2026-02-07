require_relative 'aggregatable'

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
