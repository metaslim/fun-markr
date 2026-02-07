require 'spec_helper'
require 'sequel'

RSpec.describe Markr::Repository::TestResultRepository do
  let(:db) { Sequel.sqlite }
  let(:repository) { described_class.new(db) }

  before do
    db.create_table(:test_results) do
      primary_key :id
      String :student_number, null: false
      String :test_id, null: false
      Integer :marks_available, null: false
      Integer :marks_obtained, null: false
      String :scanned_on
      DateTime :created_at
      DateTime :updated_at

      unique [:student_number, :test_id]
      index :test_id
    end
  end

  after do
    db.drop_table(:test_results)
  end

  describe '#save' do
    let(:test_result) do
      Markr::Model::TestResult.new(
        student_number: '002299',
        test_id: '9863',
        marks_available: 20,
        marks_obtained: 13,
        scanned_on: '2017-12-04T12:12:10+11:00'
      )
    end

    it 'creates a new record' do
      repository.save(test_result)
      expect(db[:test_results].count).to eq(1)
    end

    it 'stores all attributes' do
      repository.save(test_result)
      row = db[:test_results].first

      expect(row[:student_number]).to eq('002299')
      expect(row[:test_id]).to eq('9863')
      expect(row[:marks_available]).to eq(20)
      expect(row[:marks_obtained]).to eq(13)
      expect(row[:scanned_on]).to eq('2017-12-04T12:12:10+11:00')
    end

    context 'with duplicate (same student, same test)' do
      before do
        repository.save(test_result)
      end

      it 'updates to higher score' do
        higher_score = Markr::Model::TestResult.new(
          student_number: '002299',
          test_id: '9863',
          marks_available: 20,
          marks_obtained: 18
        )

        repository.save(higher_score)

        expect(db[:test_results].count).to eq(1)
        expect(db[:test_results].first[:marks_obtained]).to eq(18)
      end

      it 'keeps existing higher score' do
        lower_score = Markr::Model::TestResult.new(
          student_number: '002299',
          test_id: '9863',
          marks_available: 20,
          marks_obtained: 10
        )

        repository.save(lower_score)

        expect(db[:test_results].count).to eq(1)
        expect(db[:test_results].first[:marks_obtained]).to eq(13)
      end
    end
  end

  describe '#find_by_test_id' do
    before do
      repository.save(Markr::Model::TestResult.new(
        student_number: '001', test_id: '9863', marks_available: 20, marks_obtained: 15
      ))
      repository.save(Markr::Model::TestResult.new(
        student_number: '002', test_id: '9863', marks_available: 20, marks_obtained: 18
      ))
      repository.save(Markr::Model::TestResult.new(
        student_number: '003', test_id: '9999', marks_available: 20, marks_obtained: 10
      ))
    end

    it 'returns all results for the test' do
      results = repository.find_by_test_id('9863')
      expect(results.size).to eq(2)
    end

    it 'returns TestResult objects' do
      results = repository.find_by_test_id('9863')
      expect(results).to all(be_a(Markr::Model::TestResult))
    end

    it 'returns empty array for unknown test' do
      results = repository.find_by_test_id('unknown')
      expect(results).to eq([])
    end
  end

  describe '#exists?' do
    before do
      repository.save(Markr::Model::TestResult.new(
        student_number: '001', test_id: '9863', marks_available: 20, marks_obtained: 15
      ))
    end

    it 'returns true for existing test' do
      expect(repository.exists?('9863')).to be true
    end

    it 'returns false for unknown test' do
      expect(repository.exists?('unknown')).to be false
    end
  end
end
