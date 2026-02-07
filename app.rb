require 'sinatra/base'
require 'json'
require 'sequel'
require 'sidekiq/api'
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

  # Synchronous import - validates and processes immediately
  # Use for small imports or when immediate feedback is needed
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

  # Asynchronous import - queues for background processing
  # Use for large batch imports to avoid timeouts
  post '/import/async' do
    begin
      content = request.body.read
      content_type_header = request.content_type

      # Validate content type before queuing
      Markr::Loader::LoaderFactory.for_content_type(content_type_header)

      # Quick XML validation (structure only, not business rules)
      Nokogiri::XML(content) { |config| config.strict }

      # Enqueue for background processing
      job_id = Markr::Worker::ImportWorker.perform_async(content, content_type_header)

      status 202
      { job_id: job_id, status: 'queued' }.to_json
    rescue Markr::Loader::UnsupportedContentTypeError => e
      halt 415, { error: e.message }.to_json
    rescue Nokogiri::XML::SyntaxError => e
      halt 400, { error: "Invalid XML: #{e.message}" }.to_json
    end
  end

  # Check job status
  get '/jobs/:job_id' do
    job_id = params[:job_id]

    # Check if job is still in queue
    queue = Sidekiq::Queue.new('imports')
    in_queue = queue.any? { |job| job.jid == job_id }

    if in_queue
      return { job_id: job_id, status: 'queued' }.to_json
    end

    # Check if job is being processed
    workers = Sidekiq::Workers.new
    processing = workers.any? { |_, _, work| work['payload']['jid'] == job_id }

    if processing
      return { job_id: job_id, status: 'processing' }.to_json
    end

    # Check retry set for failed jobs
    retry_set = Sidekiq::RetrySet.new
    failed = retry_set.find { |job| job.jid == job_id }

    if failed
      return { job_id: job_id, status: 'failed', error: failed.item['error_message'] }.to_json
    end

    # Check dead set for permanently failed jobs
    dead_set = Sidekiq::DeadSet.new
    dead = dead_set.find { |job| job.jid == job_id }

    if dead
      return { job_id: job_id, status: 'dead', error: dead.item['error_message'] }.to_json
    end

    # If not found anywhere, assume completed
    { job_id: job_id, status: 'completed' }.to_json
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
