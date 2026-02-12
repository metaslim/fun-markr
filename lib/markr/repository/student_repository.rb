module Markr
  module Repository
    class StudentRepository
      def initialize(db)
        @db = db
      end

      def find_or_create(student_number:, name: nil)
        upsert_student(student_number, name)
        @db[:students].where(student_number: student_number).first
      end

      # Bulk upsert students from a hash { student_number => name }
      def bulk_upsert(students_hash)
        students_hash.each { |student_number, name| upsert_student(student_number, name) }
      end

      # Fetch student_number => id mapping for given student numbers
      def find_ids(student_numbers)
        @db[:students]
          .where(student_number: student_numbers)
          .select_hash(:student_number, :id)
      end

      def find_by_student_number(student_number)
        @db[:students].where(student_number: student_number).first
      end

      def find_by_id(id)
        @db[:students].where(id: id).first
      end

      def all(limit: nil, offset: nil)
        ds = @db[:students].order(:student_number)
        ds = ds.limit(limit, offset) if limit
        ds.all
      end

      def count
        @db[:students].count
      end

      private

      def upsert_student(student_number, name)
        name_update = Sequel.lit(
          "CASE WHEN excluded.name IS NOT NULL AND excluded.name != '' " \
          "THEN excluded.name ELSE students.name END"
        )
        @db[:students].insert_conflict(
          target: :student_number,
          update: { name: name_update, updated_at: Time.now }
        ).insert(
          student_number: student_number,
          name: name,
          created_at: Time.now,
          updated_at: Time.now
        )
      end
    end
  end
end
