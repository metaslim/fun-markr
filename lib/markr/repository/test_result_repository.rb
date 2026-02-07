require_relative '../model/test_result'
require_relative 'student_repository'

module Markr
  module Repository
    class TestResultRepository
      def initialize(db)
        @db = db
        @student_repo = StudentRepository.new(db)
      end

      def save(test_result)
        # First, find or create the student
        student = @student_repo.find_or_create(
          student_number: test_result.student_number,
          name: test_result.student_name
        )

        existing = @db[:test_results].where(
          student_id: student[:id],
          test_id: test_result.test_id
        ).first

        if existing
          update_if_higher_score(existing, test_result)
        else
          insert_new(student[:id], test_result)
        end
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
          .map { |row| row_to_hash_with_student(row) }
      end

      private

      def row_to_hash(row, student)
        percentage = (row[:marks_obtained].to_f / row[:marks_available] * 100).round(2)
        {
          student_number: student[:student_number],
          student_name: student[:name],
          test_id: row[:test_id],
          marks_available: row[:marks_available],
          marks_obtained: row[:marks_obtained],
          percentage: percentage,
          scanned_on: row[:scanned_on]
        }
      end

      def row_to_hash_with_student(row)
        percentage = (row[:marks_obtained].to_f / row[:marks_available] * 100).round(2)
        {
          student_number: row[:student_number],
          student_name: row[:student_name],
          test_id: row[:test_id],
          marks_available: row[:marks_available],
          marks_obtained: row[:marks_obtained],
          percentage: percentage,
          scanned_on: row[:scanned_on]
        }
      end

      def update_if_higher_score(existing, test_result)
        return unless test_result.marks_obtained > existing[:marks_obtained]

        @db[:test_results]
          .where(id: existing[:id])
          .update(
            marks_obtained: test_result.marks_obtained,
            marks_available: test_result.marks_available,
            updated_at: Time.now
          )
      end

      def insert_new(student_id, test_result)
        @db[:test_results].insert(
          student_id: student_id,
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
