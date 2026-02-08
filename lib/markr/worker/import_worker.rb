require 'sidekiq'
require 'sidekiq-status'
require 'sequel'
require_relative '../../../config/sidekiq'
require_relative '../loader/loader_factory'
require_relative '../repository/test_result_repository'
require_relative '../repository/aggregate_repository'
require_relative '../report/aggregate_report'
require_relative '../aggregator/registry'

module Markr
  module Worker
    class ImportWorker
      include Sidekiq::Job
      include Sidekiq::Status::Worker

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

        # Store test_ids in job status data
        store test_ids: test_ids.to_a.join(',')
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

      def self.aggregator_registry
        @aggregator_registry ||= Aggregator::Registry.default
      end

      def self.aggregator_registry=(registry)
        @aggregator_registry = registry
      end

      def self.database
        @database ||= Sequel.connect(ENV.fetch('DATABASE_URL', 'sqlite://db/markr_dev.db'))
      end

      private

      def compute_aggregate(test_id)
        results = self.class.repository.find_by_test_id(test_id)
        return if results.empty?

        scores = results.map(&:percentage)

        report = Report::AggregateReport.new(scores)
        self.class.aggregator_registry.build_all.each { |agg| report.add(agg) }
        stats = report.build

        self.class.aggregate_repository.save(test_id, stats)
      end
    end
  end
end
