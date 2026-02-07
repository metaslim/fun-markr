require 'sidekiq'
require 'sequel'
require_relative '../../../config/sidekiq'
require_relative '../loader/loader_factory'
require_relative '../repository/test_result_repository'
require_relative '../repository/aggregate_repository'
require_relative '../report/aggregate_report'
require_relative '../aggregator/mean'
require_relative '../aggregator/stddev'
require_relative '../aggregator/min'
require_relative '../aggregator/max'
require_relative '../aggregator/count'
require_relative '../aggregator/percentile'

module Markr
  module Worker
    class ImportWorker
      include Sidekiq::Job

      sidekiq_options queue: 'imports', retry: 3

      def perform(content, content_type)
        loader = Loader::LoaderFactory.for_content_type(content_type)
        results = loader.parse(content)

        # Track which tests need aggregate updates
        test_ids = Set.new

        results.each do |result|
          self.class.repository.save(result)
          test_ids.add(result.test_id)
        end

        # Recompute aggregates for affected tests
        test_ids.each do |test_id|
          compute_aggregate(test_id)
        end
      end

      def self.repository
        @repository ||= Repository::TestResultRepository.new(database)
      end

      def self.repository=(repo)
        @repository = repo
      end

      def self.aggregate_repository
        @aggregate_repository ||= Repository::AggregateRepository.new(database)
      end

      def self.aggregate_repository=(repo)
        @aggregate_repository = repo
      end

      def self.database
        @database ||= Sequel.connect(ENV.fetch('DATABASE_URL', 'sqlite://db/markr_dev.db'))
      end

      private

      def compute_aggregate(test_id)
        results = self.class.repository.find_by_test_id(test_id)
        return if results.empty?

        scores = results.map(&:percentage)

        stats = Report::AggregateReport.new(scores)
          .add(Aggregator::Mean.new)
          .add(Aggregator::StdDev.new)
          .add(Aggregator::Min.new)
          .add(Aggregator::Max.new)
          .add(Aggregator::Count.new)
          .add(Aggregator::Percentile.new(25))
          .add(Aggregator::Percentile.new(50))
          .add(Aggregator::Percentile.new(75))
          .build

        self.class.aggregate_repository.save(test_id, stats)
      end
    end
  end
end
