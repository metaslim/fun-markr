require_relative '../model/test_result'

module Markr
  module Repository
    class TestResultRepository
      def initialize(db)
        @db = db
      end

      def save(test_result)
        existing = @db[:test_results].where(
          student_number: test_result.student_number,
          test_id: test_result.test_id
        ).first

        if existing
          update_if_higher_score(existing, test_result)
        else
          insert_new(test_result)
        end
      end

      def find_by_test_id(test_id)
        @db[:test_results]
          .where(test_id: test_id)
          .map { |row| row_to_model(row) }
      end

      def exists?(test_id)
        @db[:test_results].where(test_id: test_id).count > 0
      end

      private

      def update_if_higher_score(existing, test_result)
        return if test_result.marks_obtained <= existing[:marks_obtained]

        @db[:test_results]
          .where(id: existing[:id])
          .update(
            marks_obtained: test_result.marks_obtained,
            marks_available: test_result.marks_available,
            updated_at: Time.now
          )
      end

      def insert_new(test_result)
        @db[:test_results].insert(
          student_number: test_result.student_number,
          test_id: test_result.test_id,
          marks_available: test_result.marks_available,
          marks_obtained: test_result.marks_obtained,
          scanned_on: test_result.scanned_on,
          created_at: Time.now,
          updated_at: Time.now
        )
      end

      def row_to_model(row)
        Model::TestResult.new(
          student_number: row[:student_number],
          test_id: row[:test_id],
          marks_available: row[:marks_available],
          marks_obtained: row[:marks_obtained],
          scanned_on: row[:scanned_on]
        )
      end
    end
  end
end
