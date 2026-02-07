require 'nokogiri'
require_relative 'loadable'
require_relative '../model/test_result'

module Markr
  module Loader
    class XmlLoader < Loadable
      CONTENT_TYPE = 'text/xml+markr'.freeze

      def parse(content)
        doc = Nokogiri::XML(content) { |config| config.strict.nonet }
        extract_results(doc)
      end

      def supported_content_type
        CONTENT_TYPE
      end

      private

      def extract_results(doc)
        doc.xpath('//mcq-test-result').map do |node|
          validate_node!(node)
          build_test_result(node)
        end
      end

      def validate_node!(node)
        raise InvalidDocumentError, 'Missing student-number' if node.at_xpath('student-number').nil?
        raise InvalidDocumentError, 'Missing test-id' if node.at_xpath('test-id').nil?
        raise InvalidDocumentError, 'Missing summary-marks' if node.at_xpath('summary-marks').nil?
      end

      def build_test_result(node)
        Model::TestResult.new(
          student_number: node.at_xpath('student-number')&.text,
          test_id: node.at_xpath('test-id')&.text,
          marks_available: node.at_xpath('summary-marks')&.[]('available')&.to_i,
          marks_obtained: node.at_xpath('summary-marks')&.[]('obtained')&.to_i,
          scanned_on: node['scanned-on']
        )
      end
    end
  end
end
