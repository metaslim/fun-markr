require 'spec_helper'

RSpec.describe Markr::Aggregator::StdDev do
  subject(:aggregator) { described_class.new }

  describe '#key' do
    it 'returns "stddev"' do
      expect(aggregator.key).to eq('stddev')
    end
  end

  describe '#calculate' do
    it 'calculates population standard deviation' do
      # scores: 50, 75, 100 -> mean = 75
      # variance = ((50-75)^2 + (75-75)^2 + (100-75)^2) / 3 = (625 + 0 + 625) / 3 = 416.67
      # stddev = sqrt(416.67) = 20.41
      scores = [50.0, 75.0, 100.0]
      expect(aggregator.calculate(scores)).to eq(20.41)
    end

    it 'returns 0.0 for empty array' do
      expect(aggregator.calculate([])).to eq(0.0)
    end

    it 'returns 0.0 for single value' do
      expect(aggregator.calculate([80.0])).to eq(0.0)
    end

    it 'returns 0.0 for identical values' do
      expect(aggregator.calculate([50.0, 50.0, 50.0])).to eq(0.0)
    end

    it 'rounds to 2 decimal places' do
      scores = [10.0, 20.0, 30.0]
      # mean = 20, variance = (100 + 0 + 100) / 3 = 66.67, stddev = 8.165
      expect(aggregator.calculate(scores)).to eq(8.16)
    end
  end
end
