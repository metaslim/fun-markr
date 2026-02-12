require_relative '../model/test_result'
require_relative 'base_repository'
require_relative 'student_repository'

module Markr
  module Repository
    class TestResultRepository < BaseRepository
      def initialize(db)
        super(db)
        @student_repo = StudentRepository.new(db)
      end

      def save(test_result)
        with_error_handling do
          student = @student_repo.find_or_create(
            student_number: test_result.student_number,
            name: test_result.student_name
          )
          upsert_result(student[:id], test_result)
        end
      end

      # Bulk save results: upserts students and test results in a single transaction
      def bulk_save(results)
        with_error_handling do
          @db.transaction do
            # Batch upsert unique students
            unique_students = results.each_with_object({}) do |r, hash|
              hash[r.student_number] ||= r.student_name
            end
            @student_repo.bulk_upsert(unique_students)

            # Fetch student ID mapping in one query
            student_map = @student_repo.find_ids(unique_students.keys)

            # Batch upsert test results
            results.each do |result|
              student_id = student_map[result.student_number]
              upsert_result(student_id, result)
            end
          end
        end
      end

      # Efficiently fetch only percentage scores for aggregation (no JOIN)
      def scores_for_test(test_id)
        @db[:test_results]
          .where(test_id: test_id)
          .exclude(marks_available: 0)
          .select_map(
            Sequel.lit("ROUND(CAST(marks_obtained AS FLOAT) / marks_available * 100, 2)")
          )
      end

      def find_by_test_id(test_id)
        @db[:test_results]
          .join(:students, id: :student_id)
          .where(test_id: test_id)
          .select_all(:test_results)
          .select_append(Sequel[:students][:student_number], Sequel[:students][:name].as(:student_name))
          .map { |row| row_to_model(row) }
      end

      def exists?(test_id)
        @db[:test_results].where(test_id: test_id).count > 0
      end

      def find_by_student(student_number)
        student = @student_repo.find_by_student_number(student_number)
        return [] unless student

        @db[:test_results]
          .where(student_id: student[:id])
          .order(:test_id)
          .map { |row| row_to_hash(row, student) }
      end

      def find_student_result(student_number, test_id)
        student = @student_repo.find_by_student_number(student_number)
        return nil unless student

        row = @db[:test_results]
          .where(student_id: student[:id], test_id: test_id)
          .first
        return nil unless row

        row_to_hash(row, student)
      end

      def list_students_for_test(test_id)
        @db[:test_results]
          .join(:students, id: :student_id)
          .where(test_id: test_id)
          .order(Sequel.desc(:marks_obtained))
          .select_all(:test_results)
          .select_append(Sequel[:students][:student_number], Sequel[:students][:name].as(:student_name))
          .map { |row| row_to_hash(row) }
      end

      private

      def upsert_result(student_id, test_result)
        obtained_expr = Sequel.lit(
          "CASE WHEN excluded.marks_obtained > test_results.marks_obtained " \
          "THEN excluded.marks_obtained ELSE test_results.marks_obtained END"
        )
        available_expr = Sequel.lit(
          "CASE WHEN excluded.marks_available > test_results.marks_available " \
          "THEN excluded.marks_available ELSE test_results.marks_available END"
        )
        @db[:test_results].insert_conflict(
          target: [:student_id, :test_id],
          update: {
            marks_obtained: obtained_expr,
            marks_available: available_expr,
            updated_at: Time.now
          }
        ).insert(
          student_id: student_id,
          test_id: test_result.test_id,
          marks_available: test_result.marks_available,
          marks_obtained: test_result.marks_obtained,
          scanned_on: test_result.scanned_on,
          created_at: Time.now,
          updated_at: Time.now
        )
      end

      def row_to_hash(row, student = nil)
        model = row_to_model_with_student(row, student)
        {
          student_number: model.student_number,
          student_name: model.student_name,
          test_id: model.test_id,
          marks_available: model.marks_available,
          marks_obtained: model.marks_obtained,
          percentage: model.percentage,
          scanned_on: model.scanned_on
        }
      end

      def row_to_model_with_student(row, student = nil)
        Model::TestResult.new(
          student_number: student ? student[:student_number] : row[:student_number],
          student_name: student ? student[:name] : row[:student_name],
          test_id: row[:test_id],
          marks_available: row[:marks_available],
          marks_obtained: row[:marks_obtained],
          scanned_on: row[:scanned_on]
        )
      end

      def row_to_model(row)
        Model::TestResult.new(
          student_number: row[:student_number],
          student_name: row[:student_name],
          test_id: row[:test_id],
          marks_available: row[:marks_available],
          marks_obtained: row[:marks_obtained],
          scanned_on: row[:scanned_on]
        )
      end
    end
  end
end
