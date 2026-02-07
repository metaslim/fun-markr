Sequel.migration do
  change do
    # Students table - stores unique student information
    create_table(:students) do
      primary_key :id
      String :student_number, null: false, unique: true
      String :name
      DateTime :created_at, default: Sequel::CURRENT_TIMESTAMP
      DateTime :updated_at, default: Sequel::CURRENT_TIMESTAMP

      index :student_number
    end

    # Test results - references students table
    create_table(:test_results) do
      primary_key :id
      foreign_key :student_id, :students, null: false
      String :test_id, null: false
      Integer :marks_available, null: false
      Integer :marks_obtained, null: false
      String :scanned_on
      DateTime :created_at, default: Sequel::CURRENT_TIMESTAMP
      DateTime :updated_at, default: Sequel::CURRENT_TIMESTAMP

      unique [:student_id, :test_id]
      index :test_id
      index :student_id
    end
  end
end
