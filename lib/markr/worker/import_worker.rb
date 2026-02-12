require 'sidekiq'
require 'sidekiq-status'
require 'sequel'
require 'zlib'
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

      sidekiq_options queue: 'imports', retry: 5

      def perform(content, content_type)
        loader = Loader::LoaderFactory.for_content_type(content_type)
        results = loader.parse(content)

        # Collect affected test IDs
        test_ids = Set.new
        results.each { |r| test_ids.add(r.test_id) }

        # Bulk save all results in a single transaction
        self.class.repository.bulk_save(results)

        # Recompute aggregates for affected tests (with advisory lock)
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
        @database ||= Sequel.connect(
          ENV.fetch('DATABASE_URL', 'sqlite://db/markr_dev.db'),
          max_connections: Integer(ENV.fetch('DB_POOL_SIZE', '10'))
        )
      end

      def self.database=(db)
        @database = db
      end

      private

      def compute_aggregate(test_id)
        self.class.database.transaction do
          # Advisory lock to prevent concurrent aggregate computation for same test_id
          if self.class.database.database_type == :postgres
            lock_key = Zlib.crc32(test_id.to_s) & 0x7FFFFFFF
            self.class.database.run("SELECT pg_advisory_xact_lock(#{lock_key})")
          end

          # Fetch only scores (no JOIN, no object creation)
          scores = self.class.repository.scores_for_test(test_id)
          return if scores.empty?

          report = Report::AggregateReport.new(scores)
          self.class.aggregator_registry.build_all.each { |agg| report.add(agg) }
          stats = report.build

          self.class.aggregate_repository.save(test_id, stats)
        end
      end
    end
  end
end
