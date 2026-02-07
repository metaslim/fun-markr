require 'spec_helper'

RSpec.describe Markr::Aggregator::Max do
  subject(:aggregator) { described_class.new }

  describe '#key' do
    it 'returns "max"' do
      expect(aggregator.key).to eq('max')
    end
  end

  describe '#calculate' do
    it 'returns maximum value' do
      scores = [50.0, 75.0, 100.0]
      expect(aggregator.calculate(scores)).to eq(100.0)
    end

    it 'returns 0.0 for empty array' do
      expect(aggregator.calculate([])).to eq(0.0)
    end

    it 'handles single value' do
      expect(aggregator.calculate([80.0])).to eq(80.0)
    end
  end
end
