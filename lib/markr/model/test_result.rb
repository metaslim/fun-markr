module Markr
  module Model
    class TestResult
      attr_accessor :id, :student_number, :student_name, :test_id,
                    :marks_available, :marks_obtained, :scanned_on

      def initialize(attributes = {})
        @student_number = attributes[:student_number]
        @student_name = attributes[:student_name]
        @test_id = attributes[:test_id]
        @marks_available = attributes[:marks_available]
        @marks_obtained = attributes[:marks_obtained]
        @scanned_on = attributes[:scanned_on]
      end

      def percentage
        return 0.0 if marks_available.nil? || marks_available.zero?
        (marks_obtained.to_f / marks_available * 100).round(2)
      end

      def valid?
        present?(student_number) &&
          present?(test_id) &&
          positive?(marks_available) &&
          non_negative?(marks_obtained)
      end

      private

      def present?(value)
        !value.nil? && !value.to_s.empty?
      end

      def positive?(value)
        !value.nil? && value.positive?
      end

      def non_negative?(value)
        !value.nil? && value >= 0
      end
    end
  end
end
