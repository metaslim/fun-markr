require 'spec_helper'
require 'sequel'

RSpec.describe Markr::Repository::TestResultRepository do
  let(:db) { Sequel.sqlite }
  let(:repository) { described_class.new(db) }

  before do
    # Create students table first (FK target)
    db.create_table(:students) do
      primary_key :id
      String :student_number, null: false, unique: true
      String :name
      DateTime :created_at
      DateTime :updated_at

      index :student_number
    end

    # Create test_results with FK to students
    db.create_table(:test_results) do
      primary_key :id
      foreign_key :student_id, :students, null: false
      String :test_id, null: false
      Integer :marks_available, null: false
      Integer :marks_obtained, null: false
      String :scanned_on
      DateTime :created_at
      DateTime :updated_at

      unique [:student_id, :test_id]
      index :test_id
      index :student_id
    end
  end

  after do
    db.drop_table(:test_results)
    db.drop_table(:students)
  end

  describe '#save' do
    let(:test_result) do
      Markr::Model::TestResult.new(
        student_number: '002299',
        student_name: 'KJ Alysander',
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

    it 'creates the student' do
      repository.save(test_result)
      expect(db[:students].count).to eq(1)
      expect(db[:students].first[:student_number]).to eq('002299')
      expect(db[:students].first[:name]).to eq('KJ Alysander')
    end

    it 'stores all attributes' do
      repository.save(test_result)
      row = db[:test_results].first
      student = db[:students].first

      expect(student[:student_number]).to eq('002299')
      expect(row[:student_id]).to eq(student[:id])
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

      it 'keeps highest marks_available when updating to higher score' do
        # Scenario: paper folded, some questions covered (available=18), but got higher score
        higher_score_lower_available = Markr::Model::TestResult.new(
          student_number: '002299',
          test_id: '9863',
          marks_available: 18,  # lower than original 20
          marks_obtained: 15    # higher than original 13
        )

        repository.save(higher_score_lower_available)

        expect(db[:test_results].count).to eq(1)
        expect(db[:test_results].first[:marks_obtained]).to eq(15)   # highest obtained
        expect(db[:test_results].first[:marks_available]).to eq(20)  # highest available
      end

      it 'updates marks_available if new one is higher' do
        same_score_higher_available = Markr::Model::TestResult.new(
          student_number: '002299',
          test_id: '9863',
          marks_available: 25,  # higher than original 20
          marks_obtained: 13    # same as original
        )

        repository.save(same_score_higher_available)

        expect(db[:test_results].count).to eq(1)
        expect(db[:test_results].first[:marks_obtained]).to eq(13)
        expect(db[:test_results].first[:marks_available]).to eq(25)  # updated to higher
      end

      it 'does not create duplicate students' do
        same_student = Markr::Model::TestResult.new(
          student_number: '002299',
          test_id: '9864', # different test
          marks_available: 25,
          marks_obtained: 20
        )

        repository.save(same_student)

        expect(db[:students].count).to eq(1)
        expect(db[:test_results].count).to eq(2)
      end
    end
  end

  describe '#find_by_test_id' do
    before do
      repository.save(Markr::Model::TestResult.new(
        student_number: '001', student_name: 'Alice', test_id: '9863', marks_available: 20, marks_obtained: 15
      ))
      repository.save(Markr::Model::TestResult.new(
        student_number: '002', student_name: 'Bob', test_id: '9863', marks_available: 20, marks_obtained: 18
      ))
      repository.save(Markr::Model::TestResult.new(
        student_number: '003', student_name: 'Charlie', test_id: '9999', marks_available: 20, marks_obtained: 10
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

    it 'includes student information' do
      results = repository.find_by_test_id('9863')
      names = results.map(&:student_name)
      expect(names).to contain_exactly('Alice', 'Bob')
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

  describe '#find_by_student' do
    before do
      repository.save(Markr::Model::TestResult.new(
        student_number: '001', student_name: 'Alice', test_id: '9863', marks_available: 20, marks_obtained: 15
      ))
      repository.save(Markr::Model::TestResult.new(
        student_number: '001', student_name: 'Alice', test_id: '9864', marks_available: 25, marks_obtained: 20
      ))
      repository.save(Markr::Model::TestResult.new(
        student_number: '002', student_name: 'Bob', test_id: '9863', marks_available: 20, marks_obtained: 18
      ))
    end

    it 'returns all results for the student' do
      results = repository.find_by_student('001')
      expect(results.size).to eq(2)
    end

    it 'returns hashes with student and test info' do
      results = repository.find_by_student('001')
      expect(results.first).to include(
        :student_number, :student_name, :test_id, :marks_available, :marks_obtained, :percentage
      )
    end

    it 'calculates percentage correctly' do
      results = repository.find_by_student('001')
      test_9863 = results.find { |r| r[:test_id] == '9863' }
      expect(test_9863[:percentage]).to eq(75.0) # 15/20 * 100
    end

    it 'returns empty array for unknown student' do
      results = repository.find_by_student('unknown')
      expect(results).to eq([])
    end
  end

  describe '#find_student_result' do
    before do
      repository.save(Markr::Model::TestResult.new(
        student_number: '001', student_name: 'Alice', test_id: '9863', marks_available: 20, marks_obtained: 15
      ))
    end

    it 'returns the specific result' do
      result = repository.find_student_result('001', '9863')
      expect(result[:student_number]).to eq('001')
      expect(result[:test_id]).to eq('9863')
      expect(result[:marks_obtained]).to eq(15)
    end

    it 'returns nil for unknown student' do
      result = repository.find_student_result('unknown', '9863')
      expect(result).to be_nil
    end

    it 'returns nil for unknown test' do
      result = repository.find_student_result('001', 'unknown')
      expect(result).to be_nil
    end
  end

  describe '#list_students_for_test' do
    before do
      repository.save(Markr::Model::TestResult.new(
        student_number: '001', student_name: 'Alice', test_id: '9863', marks_available: 20, marks_obtained: 15
      ))
      repository.save(Markr::Model::TestResult.new(
        student_number: '002', student_name: 'Bob', test_id: '9863', marks_available: 20, marks_obtained: 18
      ))
      repository.save(Markr::Model::TestResult.new(
        student_number: '003', student_name: 'Charlie', test_id: '9863', marks_available: 20, marks_obtained: 12
      ))
    end

    it 'returns all students in the test' do
      students = repository.list_students_for_test('9863')
      expect(students.size).to eq(3)
    end

    it 'returns students sorted by score descending' do
      students = repository.list_students_for_test('9863')
      scores = students.map { |s| s[:marks_obtained] }
      expect(scores).to eq([18, 15, 12])
    end

    it 'includes student information' do
      students = repository.list_students_for_test('9863')
      expect(students.first[:student_name]).to eq('Bob')
      expect(students.first[:student_number]).to eq('002')
    end

    it 'calculates percentage' do
      students = repository.list_students_for_test('9863')
      expect(students.first[:percentage]).to eq(90.0) # 18/20 * 100
    end

    it 'returns empty array for unknown test' do
      students = repository.list_students_for_test('unknown')
      expect(students).to eq([])
    end
  end
end
