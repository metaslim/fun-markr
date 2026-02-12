require 'csv'
require_relative 'loadable'
require_relative '../model/test_result'

module Markr
  module Loader
    class CsvLoader < Loadable
      CONTENT_TYPE = 'text/csv+markr'.freeze
      REQUIRED_HEADERS = %w[student_number test_id marks_available marks_obtained].freeze

      def validate(content)
        rows = CSV.parse(content, headers: true)
        validate_headers!(rows.headers)
        true
      rescue CSV::MalformedCSVError => e
        raise InvalidDocumentError, "Invalid CSV: #{e.message}"
      end

      def parse(content)
        rows = CSV.parse(content, headers: true)
        validate_headers!(rows.headers)

        rows.map do |row|
          validate_row!(row)
          build_test_result(row)
        end
      end

      def supported_content_type
        CONTENT_TYPE
      end

      private

      def validate_headers!(headers)
        missing = REQUIRED_HEADERS - (headers || [])
        return if missing.empty?

        raise InvalidDocumentError, "Missing required headers: #{missing.join(', ')}"
      end

      def validate_row!(row)
        REQUIRED_HEADERS.each do |header|
          value = row[header]
          if value.nil? || value.strip.empty?
            raise InvalidDocumentError, "Missing #{header} in row"
          end
        end
      end

      def build_test_result(row)
        Model::TestResult.new(
          student_number: row['student_number'].strip,
          student_name: row['student_name']&.strip,
          test_id: row['test_id'].strip,
          marks_available: row['marks_available'].to_i,
          marks_obtained: row['marks_obtained'].to_i,
          scanned_on: row['scanned_on']&.strip
        )
      end
    end
  end
end
