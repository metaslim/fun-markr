module Markr
  module Repository
    class StudentRepository
      def initialize(db)
        @db = db
      end

      def find_or_create(student_number:, name: nil)
        existing = @db[:students].where(student_number: student_number).first

        if existing
          # Update name if provided and different
          if name && !name.empty? && existing[:name] != name
            @db[:students].where(id: existing[:id]).update(name: name, updated_at: Time.now)
            existing[:name] = name
          end
          existing
        else
          id = @db[:students].insert(
            student_number: student_number,
            name: name,
            created_at: Time.now,
            updated_at: Time.now
          )
          { id: id, student_number: student_number, name: name }
        end
      end

      def find_by_student_number(student_number)
        @db[:students].where(student_number: student_number).first
      end

      def find_by_id(id)
        @db[:students].where(id: id).first
      end

      def all
        @db[:students].order(:student_number).all
      end
    end
  end
end
