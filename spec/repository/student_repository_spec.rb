require 'spec_helper'
require 'sequel'

RSpec.describe Markr::Repository::StudentRepository do
  let(:db) { Sequel.sqlite }
  let(:repository) { described_class.new(db) }

  before do
    db.create_table(:students) do
      primary_key :id
      String :student_number, null: false, unique: true
      String :name
      DateTime :created_at
      DateTime :updated_at

      index :student_number
    end
  end

  after do
    db.drop_table(:students)
  end

  describe '#find_or_create' do
    context 'with new student' do
      it 'creates the student' do
        result = repository.find_or_create(student_number: '001', name: 'Alice')

        expect(db[:students].count).to eq(1)
        expect(result[:student_number]).to eq('001')
        expect(result[:name]).to eq('Alice')
      end

      it 'returns the created student with id' do
        result = repository.find_or_create(student_number: '001')
        expect(result[:id]).to be_a(Integer)
      end

      it 'creates student without name' do
        result = repository.find_or_create(student_number: '002')
        expect(result[:name]).to be_nil
      end
    end

    context 'with existing student' do
      before do
        repository.find_or_create(student_number: '001', name: 'Alice')
      end

      it 'returns existing student' do
        result = repository.find_or_create(student_number: '001')

        expect(db[:students].count).to eq(1)
        expect(result[:student_number]).to eq('001')
      end

      it 'updates name if different' do
        result = repository.find_or_create(student_number: '001', name: 'Alice Smith')

        expect(db[:students].count).to eq(1)
        expect(result[:name]).to eq('Alice Smith')
        expect(db[:students].first[:name]).to eq('Alice Smith')
      end

      it 'does not update name if empty' do
        result = repository.find_or_create(student_number: '001', name: '')

        expect(result[:name]).to eq('Alice')
      end

      it 'does not update name if nil' do
        result = repository.find_or_create(student_number: '001', name: nil)

        expect(result[:name]).to eq('Alice')
      end
    end
  end

  describe '#find_by_student_number' do
    before do
      repository.find_or_create(student_number: '001', name: 'Alice')
    end

    it 'returns student if exists' do
      result = repository.find_by_student_number('001')

      expect(result[:student_number]).to eq('001')
      expect(result[:name]).to eq('Alice')
    end

    it 'returns nil if not found' do
      result = repository.find_by_student_number('unknown')
      expect(result).to be_nil
    end
  end

  describe '#find_by_id' do
    it 'returns student by id' do
      created = repository.find_or_create(student_number: '001', name: 'Alice')
      result = repository.find_by_id(created[:id])

      expect(result[:student_number]).to eq('001')
    end

    it 'returns nil for unknown id' do
      result = repository.find_by_id(999)
      expect(result).to be_nil
    end
  end

  describe '#all' do
    before do
      repository.find_or_create(student_number: '003', name: 'Charlie')
      repository.find_or_create(student_number: '001', name: 'Alice')
      repository.find_or_create(student_number: '002', name: 'Bob')
    end

    it 'returns all students' do
      result = repository.all
      expect(result.size).to eq(3)
    end

    it 'returns students ordered by student_number' do
      result = repository.all
      numbers = result.map { |s| s[:student_number] }
      expect(numbers).to eq(['001', '002', '003'])
    end
  end
end
