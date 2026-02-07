require 'spec_helper'

RSpec.describe Markr::Model::TestResult do
  describe '#initialize' do
    it 'sets attributes from hash' do
      result = described_class.new(
        student_number: '12345',
        test_id: '9863',
        marks_available: 20,
        marks_obtained: 15,
        scanned_on: '2017-12-04T12:12:10+11:00'
      )

      expect(result.student_number).to eq('12345')
      expect(result.test_id).to eq('9863')
      expect(result.marks_available).to eq(20)
      expect(result.marks_obtained).to eq(15)
      expect(result.scanned_on).to eq('2017-12-04T12:12:10+11:00')
    end
  end

  describe '#percentage' do
    it 'calculates percentage of marks obtained' do
      result = described_class.new(
        marks_available: 20,
        marks_obtained: 15
      )

      expect(result.percentage).to eq(75.0)
    end

    it 'returns 0.0 when marks_available is zero' do
      result = described_class.new(
        marks_available: 0,
        marks_obtained: 15
      )

      expect(result.percentage).to eq(0.0)
    end

    it 'returns 0.0 when marks_available is nil' do
      result = described_class.new(
        marks_available: nil,
        marks_obtained: 15
      )

      expect(result.percentage).to eq(0.0)
    end

    it 'rounds to 2 decimal places' do
      result = described_class.new(
        marks_available: 3,
        marks_obtained: 1
      )

      expect(result.percentage).to eq(33.33)
    end
  end

  describe '#valid?' do
    context 'when all required fields present' do
      it 'returns true' do
        result = described_class.new(
          student_number: '12345',
          test_id: '9863',
          marks_available: 20,
          marks_obtained: 15
        )

        expect(result.valid?).to be true
      end
    end

    context 'when student_number is missing' do
      it 'returns false for nil' do
        result = described_class.new(
          student_number: nil,
          test_id: '9863',
          marks_available: 20,
          marks_obtained: 15
        )

        expect(result.valid?).to be false
      end

      it 'returns false for empty string' do
        result = described_class.new(
          student_number: '',
          test_id: '9863',
          marks_available: 20,
          marks_obtained: 15
        )

        expect(result.valid?).to be false
      end
    end

    context 'when test_id is missing' do
      it 'returns false for nil' do
        result = described_class.new(
          student_number: '12345',
          test_id: nil,
          marks_available: 20,
          marks_obtained: 15
        )

        expect(result.valid?).to be false
      end

      it 'returns false for empty string' do
        result = described_class.new(
          student_number: '12345',
          test_id: '',
          marks_available: 20,
          marks_obtained: 15
        )

        expect(result.valid?).to be false
      end
    end

    context 'when marks_available is invalid' do
      it 'returns false for nil' do
        result = described_class.new(
          student_number: '12345',
          test_id: '9863',
          marks_available: nil,
          marks_obtained: 15
        )

        expect(result.valid?).to be false
      end

      it 'returns false for zero' do
        result = described_class.new(
          student_number: '12345',
          test_id: '9863',
          marks_available: 0,
          marks_obtained: 15
        )

        expect(result.valid?).to be false
      end

      it 'returns false for negative' do
        result = described_class.new(
          student_number: '12345',
          test_id: '9863',
          marks_available: -1,
          marks_obtained: 15
        )

        expect(result.valid?).to be false
      end
    end

    context 'when marks_obtained is invalid' do
      it 'returns false for nil' do
        result = described_class.new(
          student_number: '12345',
          test_id: '9863',
          marks_available: 20,
          marks_obtained: nil
        )

        expect(result.valid?).to be false
      end

      it 'returns false for negative' do
        result = described_class.new(
          student_number: '12345',
          test_id: '9863',
          marks_available: 20,
          marks_obtained: -1
        )

        expect(result.valid?).to be false
      end

      it 'returns true for zero' do
        result = described_class.new(
          student_number: '12345',
          test_id: '9863',
          marks_available: 20,
          marks_obtained: 0
        )

        expect(result.valid?).to be true
      end
    end
  end
end
