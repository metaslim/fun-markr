require 'sidekiq'
require 'sequel'
require_relative '../../../config/sidekiq'
require_relative '../loader/loader_factory'
require_relative '../repository/test_result_repository'

module Markr
  module Worker
    class ImportWorker
      include Sidekiq::Job

      sidekiq_options queue: 'imports', retry: 3

      def perform(content, content_type)
        loader = Loader::LoaderFactory.for_content_type(content_type)
        results = loader.parse(content)

        results.each do |result|
          raise Loader::InvalidDocumentError, 'Invalid test result' unless result.valid?
          self.class.repository.save(result)
        end
      end

      def self.repository
        @repository ||= Repository::TestResultRepository.new(database)
      end

      def self.repository=(repo)
        @repository = repo
      end

      def self.database
        @database ||= Sequel.connect(ENV.fetch('DATABASE_URL', 'sqlite://db/markr_dev.db'))
      end
    end
  end
end
