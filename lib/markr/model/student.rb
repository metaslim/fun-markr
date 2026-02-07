module Markr
  module Model
    class Student
      attr_accessor :id, :student_number, :name

      def initialize(attributes = {})
        @id = attributes[:id]
        @student_number = attributes[:student_number]
        @name = attributes[:name]
      end

      def valid?
        !student_number.nil? && !student_number.to_s.empty?
      end
    end
  end
end
