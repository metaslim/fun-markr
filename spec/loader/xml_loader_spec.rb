require 'spec_helper'

RSpec.describe Markr::Loader::XmlLoader do
  subject(:loader) { described_class.new }

  let(:valid_xml) do
    <<~XML
      <mcq-test-results>
        <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
          <first-name>KJ</first-name>
          <last-name>Alysander</last-name>
          <student-number>002299</student-number>
          <test-id>9863</test-id>
          <summary-marks available="20" obtained="13" />
        </mcq-test-result>
        <mcq-test-result scanned-on="2017-12-04T12:15:00+11:00">
          <first-name>John</first-name>
          <last-name>Smith</last-name>
          <student-number>002300</student-number>
          <test-id>9863</test-id>
          <summary-marks available="20" obtained="17" />
        </mcq-test-result>
      </mcq-test-results>
    XML
  end

  describe '#supported_content_type' do
    it 'returns text/xml+markr' do
      expect(loader.supported_content_type).to eq('text/xml+markr')
    end
  end

  describe '#parse' do
    context 'with valid XML' do
      it 'returns array of TestResult objects' do
        results = loader.parse(valid_xml)
        expect(results).to all(be_a(Markr::Model::TestResult))
        expect(results.size).to eq(2)
      end

      it 'extracts student_number' do
        results = loader.parse(valid_xml)
        expect(results.first.student_number).to eq('002299')
        expect(results.last.student_number).to eq('002300')
      end

      it 'extracts test_id' do
        results = loader.parse(valid_xml)
        expect(results.first.test_id).to eq('9863')
      end

      it 'extracts marks_available' do
        results = loader.parse(valid_xml)
        expect(results.first.marks_available).to eq(20)
      end

      it 'extracts marks_obtained' do
        results = loader.parse(valid_xml)
        expect(results.first.marks_obtained).to eq(13)
        expect(results.last.marks_obtained).to eq(17)
      end

      it 'extracts scanned_on timestamp' do
        results = loader.parse(valid_xml)
        expect(results.first.scanned_on).to eq('2017-12-04T12:12:10+11:00')
      end
    end

    context 'with missing required fields' do
      it 'raises InvalidDocumentError for missing student-number' do
        xml = <<~XML
          <mcq-test-results>
            <mcq-test-result>
              <test-id>9863</test-id>
              <summary-marks available="20" obtained="13" />
            </mcq-test-result>
          </mcq-test-results>
        XML

        expect { loader.parse(xml) }.to raise_error(
          Markr::Loader::InvalidDocumentError,
          /missing student-number/i
        )
      end

      it 'raises InvalidDocumentError for missing test-id' do
        xml = <<~XML
          <mcq-test-results>
            <mcq-test-result>
              <student-number>002299</student-number>
              <summary-marks available="20" obtained="13" />
            </mcq-test-result>
          </mcq-test-results>
        XML

        expect { loader.parse(xml) }.to raise_error(
          Markr::Loader::InvalidDocumentError,
          /missing test-id/i
        )
      end

      it 'raises InvalidDocumentError for missing summary-marks' do
        xml = <<~XML
          <mcq-test-results>
            <mcq-test-result>
              <student-number>002299</student-number>
              <test-id>9863</test-id>
            </mcq-test-result>
          </mcq-test-results>
        XML

        expect { loader.parse(xml) }.to raise_error(
          Markr::Loader::InvalidDocumentError,
          /missing summary-marks/i
        )
      end
    end

    context 'with malformed XML' do
      it 'raises error for invalid XML syntax' do
        xml = '<mcq-test-results><not-closed>'
        expect { loader.parse(xml) }.to raise_error(Nokogiri::XML::SyntaxError)
      end
    end

    context 'with empty results' do
      it 'returns empty array' do
        xml = '<mcq-test-results></mcq-test-results>'
        expect(loader.parse(xml)).to eq([])
      end
    end
  end
end
