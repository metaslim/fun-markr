require_relative 'loadable'
require_relative 'xml_loader'

module Markr
  module Loader
    class LoaderFactory
      LOADERS = {
        'text/xml+markr' => XmlLoader
      }.freeze

      def self.for_content_type(content_type)
        loader_class = LOADERS[content_type]
        raise UnsupportedContentTypeError, "Unsupported content type: #{content_type}" unless loader_class
        loader_class.new
      end
    end
  end
end
