module Markr
  module Loader
    class Loadable
      # Quick syntax validation before queuing (does NOT validate business rules)
      # Raises InvalidDocumentError if content is malformed
      def validate(content)
        raise NotImplementedError, "#{self.class} must implement #validate"
      end

      # Full parsing with business rule validation
      # Returns array of TestResult objects
      def parse(content)
        raise NotImplementedError, "#{self.class} must implement #parse"
      end

      def supported_content_type
        raise NotImplementedError, "#{self.class} must implement #supported_content_type"
      end
    end

    class UnsupportedContentTypeError < StandardError; end
    class InvalidDocumentError < StandardError; end
  end
end
