require 'nokogiri'
require_relative 'loadable'
require_relative '../model/test_result'

module Markr
  module Loader
    class XmlLoader < Loadable
      CONTENT_TYPE = 'text/xml+markr'.freeze

      # Lightweight syntax validation using SAX (no DOM tree built)
      def validate(content)
        handler = StrictSaxHandler.new
        parser = Nokogiri::XML::SAX::Parser.new(handler)
        parser.parse(content)
        true
      rescue Nokogiri::XML::SyntaxError => e
        raise InvalidDocumentError, "Invalid XML: #{e.message}"
      end

      def parse(content)
        doc = Nokogiri::XML(content) { |config| config.strict.nonet }
        extract_results(doc)
      end

      def supported_content_type
        CONTENT_TYPE
      end

      private

      # SAX handler that raises on any XML error
      class StrictSaxHandler < Nokogiri::XML::SAX::Document
        def error(string)
          raise Nokogiri::XML::SyntaxError, string
        end
      end

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
          student_name: extract_student_name(node),
          test_id: node.at_xpath('test-id')&.text,
          marks_available: node.at_xpath('summary-marks')&.[]('available')&.to_i,
          marks_obtained: node.at_xpath('summary-marks')&.[]('obtained')&.to_i,
          scanned_on: node['scanned-on']
        )
      end

      def extract_student_name(node)
        # Try <student-name> first
        name = node.at_xpath('student-name')&.text
        return name if name && !name.empty?

        # Fall back to <first-name> + <last-name>
        first = node.at_xpath('first-name')&.text
        last = node.at_xpath('last-name')&.text

        return nil if first.nil? && last.nil?

        full_name = [first, last].compact.join(' ').strip
        full_name.empty? ? nil : full_name
      end
    end
  end
end
