require_relative 'aggregatable'

module Markr
  module Aggregator
    class Count < Aggregatable
      def key
        'count'
      end

      def calculate(scores)
        scores.size
      end
    end
  end
end
