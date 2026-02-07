module Markr
  module Aggregator
    class Aggregatable
      def key
        raise NotImplementedError, "#{self.class} must implement #key"
      end

      def calculate(scores)
        raise NotImplementedError, "#{self.class} must implement #calculate"
      end
    end
  end
end
