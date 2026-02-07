require 'spec_helper'

RSpec.describe Markr::Aggregator::Count do
  subject(:aggregator) { described_class.new }

  describe '#key' do
    it 'returns "count"' do
      expect(aggregator.key).to eq('count')
    end
  end

  describe '#calculate' do
    it 'returns number of scores' do
      scores = [50.0, 75.0, 100.0]
      expect(aggregator.calculate(scores)).to eq(3)
    end

    it 'returns 0 for empty array' do
      expect(aggregator.calculate([])).to eq(0)
    end

    it 'handles single value' do
      expect(aggregator.calculate([80.0])).to eq(1)
    end
  end
end
