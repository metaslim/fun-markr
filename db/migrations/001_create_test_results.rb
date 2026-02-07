Sequel.migration do
  change do
    create_table(:test_results) do
      primary_key :id
      String :student_number, null: false
      String :test_id, null: false
      Integer :marks_available, null: false
      Integer :marks_obtained, null: false
      String :scanned_on
      DateTime :created_at, default: Sequel::CURRENT_TIMESTAMP
      DateTime :updated_at, default: Sequel::CURRENT_TIMESTAMP

      unique [:student_number, :test_id]
      index :test_id
    end
  end
end
