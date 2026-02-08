require 'sinatra/base'
require 'json'
require 'sequel'
require 'sidekiq/api'
require 'sidekiq-status'
require_relative 'lib/markr'
require_relative 'lib/markr/middleware/cors'
require_relative 'lib/markr/middleware/auth'

class App < Sinatra::Base
  # HTTP Basic Auth credentials from environment
  AUTH_USERNAME = ENV.fetch('AUTH_USERNAME', 'markr')
  AUTH_PASSWORD = ENV.fetch('AUTH_PASSWORD', 'secret')

  # Use middleware for cross-cutting concerns
  use Markr::Middleware::Cors
  use Markr::Middleware::Auth, username: AUTH_USERNAME, password: AUTH_PASSWORD

  configure do
    # PostgreSQL in production, SQLite for local dev fallback
    set :database_url, ENV.fetch('DATABASE_URL', 'sqlite://db/markr_dev.db')
    # Disable rack-protection host authorization for API usage
    set :host_authorization, { permitted_hosts: [] }
    # Bind to all interfaces for Docker
    set :bind, '0.0.0.0'
  end

  set :protection, except: [:http_origin]

  def self.database
    @database ||= Sequel.connect(settings.database_url)
  end

  def self.run_migrations!
    Sequel.extension :migration
    Sequel::Migrator.run(database, 'db/migrations')
  end

  def self.reset_database!
    @database = Sequel.sqlite
    @database.create_table?(:students) do
      primary_key :id
      String :student_number, null: false, unique: true
      String :name
      DateTime :created_at
      DateTime :updated_at

      index :student_number
    end
    @database.create_table?(:test_results) do
      primary_key :id
      foreign_key :student_id, :students, null: false
      String :test_id, null: false
      Integer :marks_available, null: false
      Integer :marks_obtained, null: false
      String :scanned_on
      DateTime :created_at
      DateTime :updated_at

      unique [:student_id, :test_id]
      index :test_id
      index :student_id
    end
    @database.create_table?(:test_aggregates) do
      primary_key :id
      String :test_id, null: false, unique: true
      String :data, text: true  # JSON blob
      DateTime :created_at
      DateTime :updated_at

      index :test_id
    end
    @repository = nil
    @student_repository = nil
    @aggregate_repository = nil
  end

  def self.repository
    @repository ||= Markr::Repository::TestResultRepository.new(database)
  end

  def self.student_repository
    @student_repository ||= Markr::Repository::StudentRepository.new(database)
  end

  def self.aggregate_repository
    @aggregate_repository ||= Markr::Repository::AggregateRepository.new(database)
  end

  before do
    content_type :json
  end

  # Import endpoint - queues for background processing via Sidekiq
  post '/import' do
    begin
      content = request.body.read
      content_type_header = request.content_type

      # Get loader for content type (raises UnsupportedContentTypeError if invalid)
      loader = Markr::Loader::LoaderFactory.for_content_type(content_type_header)

      # Quick syntax validation before queuing (format-specific, not business rules)
      loader.validate(content)

      # Enqueue for background processing
      job_id = Markr::Worker::ImportWorker.perform_async(content, content_type_header)

      status 202
      { job_id: job_id, status: 'queued' }.to_json
    rescue Markr::Loader::UnsupportedContentTypeError => e
      halt 415, { error: e.message }.to_json
    rescue Markr::Loader::InvalidDocumentError => e
      halt 400, { error: e.message }.to_json
    end
  end

  # Check job status using sidekiq-status gem
  get '/jobs/:job_id' do
    job_id = params[:job_id]

    # Use sidekiq-status to get job status
    status = Sidekiq::Status.status(job_id)

    case status
    when :queued
      { job_id: job_id, status: 'queued' }.to_json
    when :working
      { job_id: job_id, status: 'processing' }.to_json
    when :complete
      test_ids = Sidekiq::Status.get(job_id, :test_ids)
      {
        job_id: job_id,
        status: 'completed',
        test_ids: test_ids&.split(',') || []
      }.to_json
    when :failed
      { job_id: job_id, status: 'failed', error: 'Job failed' }.to_json
    when :interrupted
      { job_id: job_id, status: 'failed', error: 'Job interrupted' }.to_json
    else
      # Status not found - job may have expired or never existed
      { job_id: job_id, status: 'unknown' }.to_json
    end
  end

  get '/results/:test_id/aggregate' do
    test_id = params[:test_id]

    # Read from pre-computed cache
    cached = self.class.aggregate_repository.find_by_test_id(test_id)

    unless cached
      halt 404, { error: 'Test not found' }.to_json
    end

    cached.to_json
  end

  # List all tests with aggregates
  get '/tests' do
    tests = self.class.aggregate_repository.list_all
    { tests: tests, count: tests.length }.to_json
  end

  # List all students
  get '/students' do
    students = self.class.student_repository.all
    { students: students, count: students.length }.to_json
  end

  # Get all results for a student
  get '/students/:student_number' do
    student_number = params[:student_number]
    results = self.class.repository.find_by_student(student_number)

    if results.empty?
      halt 404, { error: 'Student not found' }.to_json
    end

    { student_number: student_number, results: results, count: results.length }.to_json
  end

  # Get student result for a specific test
  get '/students/:student_number/tests/:test_id' do
    student_number = params[:student_number]
    test_id = params[:test_id]

    result = self.class.repository.find_student_result(student_number, test_id)

    unless result
      halt 404, { error: 'Result not found' }.to_json
    end

    result.to_json
  end

  # List all students for a test (with scores)
  get '/tests/:test_id/students' do
    test_id = params[:test_id]
    students = self.class.repository.list_students_for_test(test_id)

    if students.empty?
      halt 404, { error: 'Test not found or no students' }.to_json
    end

    { test_id: test_id, students: students, count: students.length }.to_json
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
