module Markr
  module Loader
    class Loadable
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
