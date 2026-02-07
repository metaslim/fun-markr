require 'spec_helper'

RSpec.describe Markr::Aggregator::Percentile do
  describe '#key' do
    it 'returns "p25" for 25th percentile' do
      aggregator = described_class.new(25)
      expect(aggregator.key).to eq('p25')
    end

    it 'returns "p50" for 50th percentile' do
      aggregator = described_class.new(50)
      expect(aggregator.key).to eq('p50')
    end

    it 'returns "p75" for 75th percentile' do
      aggregator = described_class.new(75)
      expect(aggregator.key).to eq('p75')
    end
  end

  describe '#calculate' do
    context 'with p25' do
      subject(:aggregator) { described_class.new(25) }

      it 'calculates 25th percentile' do
        # scores: 10, 20, 30, 40 (sorted)
        # rank = 0.25 * (4-1) = 0.75
        # lower = scores[0] = 10, upper = scores[1] = 20
        # result = 10 + (20-10) * 0.75 = 17.5
        scores = [40.0, 10.0, 30.0, 20.0]
        expect(aggregator.calculate(scores)).to eq(17.5)
      end
    end

    context 'with p50 (median)' do
      subject(:aggregator) { described_class.new(50) }

      it 'calculates median for odd number of elements' do
        scores = [10.0, 20.0, 30.0]
        expect(aggregator.calculate(scores)).to eq(20.0)
      end

      it 'calculates median for even number of elements' do
        scores = [10.0, 20.0, 30.0, 40.0]
        # rank = 0.5 * (4-1) = 1.5
        # lower = scores[1] = 20, upper = scores[2] = 30
        # result = 20 + (30-20) * 0.5 = 25
        expect(aggregator.calculate(scores)).to eq(25.0)
      end
    end

    context 'with p75' do
      subject(:aggregator) { described_class.new(75) }

      it 'calculates 75th percentile' do
        scores = [10.0, 20.0, 30.0, 40.0]
        # rank = 0.75 * (4-1) = 2.25
        # lower = scores[2] = 30, upper = scores[3] = 40
        # result = 30 + (40-30) * 0.25 = 32.5
        expect(aggregator.calculate(scores)).to eq(32.5)
      end
    end

    context 'edge cases' do
      subject(:aggregator) { described_class.new(50) }

      it 'returns 0.0 for empty array' do
        expect(aggregator.calculate([])).to eq(0.0)
      end

      it 'returns the value for single element' do
        expect(aggregator.calculate([80.0])).to eq(80.0)
      end

      it 'rounds to 2 decimal places' do
        scores = [10.0, 20.0, 30.0]
        p33 = described_class.new(33)
        # rank = 0.33 * 2 = 0.66
        # lower = 10, upper = 20
        # result = 10 + 10 * 0.66 = 16.6
        expect(p33.calculate(scores)).to eq(16.6)
      end
    end
  end
end
