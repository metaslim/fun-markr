require_relative 'aggregatable'

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
