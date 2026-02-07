require 'sinatra/base'
require 'json'
require 'sequel'
require 'sidekiq/api'
require_relative 'lib/markr'

class App < Sinatra::Base
  # HTTP Basic Auth credentials from environment
  AUTH_USERNAME = ENV.fetch('AUTH_USERNAME', 'markr')
  AUTH_PASSWORD = ENV.fetch('AUTH_PASSWORD', 'secret')

  configure do
    # PostgreSQL in production, SQLite for local dev fallback
    set :database_url, ENV.fetch('DATABASE_URL', 'sqlite://db/markr_dev.db')
    # Disable rack-protection host authorization for API usage
    set :host_authorization, { permitted_hosts: [] }
    # Bind to all interfaces for Docker
    set :bind, '0.0.0.0'
  end

  # CORS support for frontend
  set :protection, except: [:http_origin]

  before do
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type'
  end

  options '*' do
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type'
    200
  end

  helpers do
    def protected!
      return if authorized?
      headers['WWW-Authenticate'] = 'Basic realm="Markr API"'
      halt 401, { error: 'Unauthorized' }.to_json
    end

    def authorized?
      @auth ||= Rack::Auth::Basic::Request.new(request.env)
      @auth.provided? && @auth.basic? && @auth.credentials &&
        @auth.credentials == [AUTH_USERNAME, AUTH_PASSWORD]
    end
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
    # Protect all endpoints except health check and OPTIONS (CORS preflight)
    protected! unless request.path_info == '/health' || request.request_method == 'OPTIONS'
  end

  # Import endpoint - queues for background processing via Sidekiq
  post '/import' do
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
