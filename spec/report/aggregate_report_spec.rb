require 'spec_helper'

RSpec.describe Markr::Report::AggregateReport do
  let(:scores) { [50.0, 75.0, 100.0] }

  describe '#add' do
    it 'returns self for chaining' do
      report = described_class.new(scores)
      result = report.add(Markr::Aggregator::Mean.new)
      expect(result).to be(report)
    end

    it 'supports method chaining' do
      report = described_class.new(scores)
        .add(Markr::Aggregator::Mean.new)
        .add(Markr::Aggregator::Min.new)
        .add(Markr::Aggregator::Max.new)

      expect(report).to be_a(described_class)
    end
  end

  describe '#build' do
    it 'returns hash with all aggregator results' do
      report = described_class.new(scores)
        .add(Markr::Aggregator::Mean.new)
        .add(Markr::Aggregator::Min.new)
        .add(Markr::Aggregator::Max.new)

      result = report.build

      expect(result).to eq({
        'mean' => 75.0,
        'min' => 50.0,
        'max' => 100.0
      })
    end

    it 'returns empty hash when no aggregators added' do
      report = described_class.new(scores)
      expect(report.build).to eq({})
    end

    it 'includes all standard statistics' do
      report = described_class.new(scores)
        .add(Markr::Aggregator::Mean.new)
        .add(Markr::Aggregator::StdDev.new)
        .add(Markr::Aggregator::Min.new)
        .add(Markr::Aggregator::Max.new)
        .add(Markr::Aggregator::Count.new)
        .add(Markr::Aggregator::Percentile.new(25))
        .add(Markr::Aggregator::Percentile.new(50))
        .add(Markr::Aggregator::Percentile.new(75))

      result = report.build

      expect(result.keys).to contain_exactly(
        'mean', 'stddev', 'min', 'max', 'count', 'p25', 'p50', 'p75'
      )
    end
  end
end
