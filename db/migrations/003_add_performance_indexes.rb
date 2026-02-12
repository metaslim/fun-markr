Sequel.migration do
  change do
    alter_table(:test_results) do
      add_index [:test_id, :marks_obtained], name: :idx_test_results_test_marks
    end

    alter_table(:test_aggregates) do
      add_index :updated_at, name: :idx_test_aggregates_updated_at
    end
  end
end
