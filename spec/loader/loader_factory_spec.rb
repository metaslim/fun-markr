require 'spec_helper'

RSpec.describe Markr::Loader::LoaderFactory do
  describe '.for_content_type' do
    it 'returns XmlLoader for text/xml+markr' do
      loader = described_class.for_content_type('text/xml+markr')
      expect(loader).to be_a(Markr::Loader::XmlLoader)
    end

    it 'raises UnsupportedContentTypeError for unknown type' do
      expect {
        described_class.for_content_type('application/json')
      }.to raise_error(
        Markr::Loader::UnsupportedContentTypeError,
        /application\/json/
      )
    end

    it 'raises UnsupportedContentTypeError for nil' do
      expect {
        described_class.for_content_type(nil)
      }.to raise_error(Markr::Loader::UnsupportedContentTypeError)
    end
  end
end
