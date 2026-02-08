require 'spec_helper'
require_relative '../../lib/markr/repository/base_repository'

RSpec.describe Markr::Repository::BaseRepository do
  let(:db) { instance_double('Sequel::Database') }
  let(:repository) { described_class.new(db) }

  describe '#with_error_handling' do
    # Create a test subclass to access protected method
    let(:test_repository) do
      Class.new(described_class) do
        def test_operation(&block)
          with_error_handling(&block)
        end
      end.new(db)
    end

    context 'when operation succeeds' do
      it 'returns the result' do
        result = test_repository.test_operation { 'success' }
        expect(result).to eq('success')
      end

      it 'yields to the block' do
        yielded = false
        test_repository.test_operation { yielded = true }
        expect(yielded).to be true
      end
    end

    context 'when Sequel::DatabaseError is raised' do
      it 'wraps it in DatabaseError' do
        expect {
          test_repository.test_operation { raise Sequel::DatabaseError, 'connection failed' }
        }.to raise_error(Markr::Repository::DatabaseError, /connection failed/)
      end

      it 'includes original message in the error' do
        expect {
          test_repository.test_operation { raise Sequel::DatabaseError, 'unique constraint violated' }
        }.to raise_error(Markr::Repository::DatabaseError, /unique constraint violated/)
      end
    end

    context 'when other errors are raised' do
      it 'lets them propagate unchanged' do
        expect {
          test_repository.test_operation { raise StandardError, 'other error' }
        }.to raise_error(StandardError, 'other error')
      end
    end
  end
end

RSpec.describe Markr::Repository::DatabaseError do
  it 'is a StandardError' do
    expect(described_class.new).to be_a(StandardError)
  end

  it 'can have a custom message' do
    error = described_class.new('custom message')
    expect(error.message).to eq('custom message')
  end
end
