require 'sinatra/base'
require 'json'
require 'sequel'
require_relative 'lib/markr'

class App < Sinatra::Base
  configure do
    # PostgreSQL in production, SQLite for local dev fallback
    set :database_url, ENV.fetch('DATABASE_URL', 'sqlite://db/markr_dev.db')
    # Disable rack-protection host authorization for API usage
    set :host_authorization, { permitted_hosts: [] }
  end

  def self.database
    @database ||= Sequel.connect(settings.database_url)
  end

  def self.run_migrations!
    Sequel.extension :migration
    Sequel::Migrator.run(database, 'db/migrations')
  end

  def self.reset_database!
    @database = Sequel.sqlite
    @database.create_table?(:test_results) do
      primary_key :id
      String :student_number, null: false
      String :test_id, null: false
      Integer :marks_available, null: false
      Integer :marks_obtained, null: false
      String :scanned_on
      DateTime :created_at
      DateTime :updated_at

      unique [:student_number, :test_id]
      index :test_id
    end
    @repository = nil
  end

  def self.repository
    @repository ||= Markr::Repository::TestResultRepository.new(database)
  end

  before do
    content_type :json
  end

  post '/import' do
    begin
      loader = Markr::Loader::LoaderFactory.for_content_type(request.content_type)
      results = loader.parse(request.body.read)

      results.each do |result|
        halt 400, { error: 'Invalid test result' }.to_json unless result.valid?
        self.class.repository.save(result)
      end

      status 201
      { imported: results.size }.to_json
    rescue Markr::Loader::UnsupportedContentTypeError => e
      halt 415, { error: e.message }.to_json
    rescue Nokogiri::XML::SyntaxError => e
      halt 400, { error: "Invalid XML: #{e.message}" }.to_json
    rescue Markr::Loader::InvalidDocumentError => e
      halt 400, { error: e.message }.to_json
    end
  end

  get '/results/:test_id/aggregate' do
    test_id = params[:test_id]

    unless self.class.repository.exists?(test_id)
      halt 404, { error: 'Test not found' }.to_json
    end

    results = self.class.repository.find_by_test_id(test_id)
    scores = results.map(&:percentage)

    report = Markr::Report::AggregateReport.new(scores)
      .add(Markr::Aggregator::Mean.new)
      .add(Markr::Aggregator::StdDev.new)
      .add(Markr::Aggregator::Min.new)
      .add(Markr::Aggregator::Max.new)
      .add(Markr::Aggregator::Count.new)
      .add(Markr::Aggregator::Percentile.new(25))
      .add(Markr::Aggregator::Percentile.new(50))
      .add(Markr::Aggregator::Percentile.new(75))
      .build

    report.to_json
  end

  # Health check endpoint
  get '/health' do
    { status: 'ok' }.to_json
  end
end

# Run if executed directly
if __FILE__ == $0
  App.run_migrations!
  App.run!
end
