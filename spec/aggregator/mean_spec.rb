require 'spec_helper'

RSpec.describe Markr::Aggregator::Mean do
  subject(:aggregator) { described_class.new }

  describe '#key' do
    it 'returns "mean"' do
      expect(aggregator.key).to eq('mean')
    end
  end

  describe '#calculate' do
    it 'calculates average of scores' do
      scores = [50.0, 75.0, 100.0]
      expect(aggregator.calculate(scores)).to eq(75.0)
    end

    it 'returns 0.0 for empty array' do
      expect(aggregator.calculate([])).to eq(0.0)
    end

    it 'handles single value' do
      expect(aggregator.calculate([80.0])).to eq(80.0)
    end

    it 'rounds to 2 decimal places' do
      scores = [33.33, 33.33, 33.34]
      expect(aggregator.calculate(scores)).to eq(33.33)
    end
  end
end
