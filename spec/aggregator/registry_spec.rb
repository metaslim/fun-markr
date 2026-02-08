require 'spec_helper'
require_relative '../../lib/markr/aggregator/registry'

RSpec.describe Markr::Aggregator::Registry do
  describe '.default' do
    it 'returns a registry with default aggregators' do
      registry = described_class.default

      aggregators = registry.build_all
      keys = aggregators.map(&:key)

      expect(keys).to include('mean')
      expect(keys).to include('stddev')
      expect(keys).to include('min')
      expect(keys).to include('max')
      expect(keys).to include('count')
      expect(keys).to include('p25')
      expect(keys).to include('p50')
      expect(keys).to include('p75')
    end

    it 'returns 8 default aggregators' do
      registry = described_class.default
      expect(registry.build_all.length).to eq(8)
    end
  end

  describe '#register' do
    it 'adds a class to the registry' do
      registry = described_class.new
      registry.register(Markr::Aggregator::Mean)

      aggregators = registry.build_all
      expect(aggregators.length).to eq(1)
      expect(aggregators.first).to be_a(Markr::Aggregator::Mean)
    end

    it 'adds a proc/lambda to the registry' do
      registry = described_class.new
      registry.register(-> { Markr::Aggregator::Percentile.new(90) })

      aggregators = registry.build_all
      expect(aggregators.length).to eq(1)
      expect(aggregators.first.key).to eq('p90')
    end

    it 'returns self for chaining' do
      registry = described_class.new

      result = registry.register(Markr::Aggregator::Mean)

      expect(result).to eq(registry)
    end

    it 'allows chaining multiple registers' do
      registry = described_class.new
        .register(Markr::Aggregator::Mean)
        .register(Markr::Aggregator::Min)
        .register(Markr::Aggregator::Max)

      expect(registry.build_all.length).to eq(3)
    end
  end

  describe '#build_all' do
    it 'instantiates classes' do
      registry = described_class.new
      registry.register(Markr::Aggregator::Mean)

      aggregators = registry.build_all

      expect(aggregators.first).to be_a(Markr::Aggregator::Mean)
    end

    it 'calls procs/lambdas' do
      registry = described_class.new
      registry.register(-> { Markr::Aggregator::Percentile.new(99) })

      aggregators = registry.build_all

      expect(aggregators.first.key).to eq('p99')
    end

    it 'returns new instances each time' do
      registry = described_class.new
      registry.register(Markr::Aggregator::Mean)

      first_build = registry.build_all.first
      second_build = registry.build_all.first

      expect(first_build).not_to be(second_build)
    end
  end

  describe 'extensibility (Open/Closed Principle)' do
    it 'allows adding custom aggregators without modifying existing code' do
      # Create a custom aggregator
      custom_aggregator = Class.new(Markr::Aggregator::Aggregatable) do
        def key
          'custom'
        end

        def calculate(scores)
          scores.sum * 2
        end
      end

      registry = described_class.default
      registry.register(custom_aggregator)

      aggregators = registry.build_all
      keys = aggregators.map(&:key)

      expect(keys).to include('custom')
      expect(aggregators.length).to eq(9) # 8 default + 1 custom
    end
  end
end
