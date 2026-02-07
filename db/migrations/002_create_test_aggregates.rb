Sequel.migration do
  change do
    create_table(:test_aggregates) do
      primary_key :id
      String :test_id, null: false, unique: true
      String :data, text: true  # JSON blob
      DateTime :created_at, default: Sequel::CURRENT_TIMESTAMP
      DateTime :updated_at, default: Sequel::CURRENT_TIMESTAMP

      index :test_id
    end
  end
end
