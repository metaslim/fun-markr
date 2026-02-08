require 'spec_helper'
require 'rack/test'
require 'sidekiq/testing'
require_relative '../../app'

RSpec.describe 'API' do
  include Rack::Test::Methods

  def app
    App
  end

  def auth_header
    credentials = Base64.strict_encode64('markr:secret')
    { 'HTTP_AUTHORIZATION' => "Basic #{credentials}" }
  end

  let(:valid_xml) do
    <<~XML
      <mcq-test-results>
        <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
          <first-name>KJ</first-name>
          <last-name>Alysander</last-name>
          <student-number>002299</student-number>
          <test-id>9863</test-id>
          <summary-marks available="20" obtained="13" />
        </mcq-test-result>
        <mcq-test-result scanned-on="2017-12-04T12:15:00+11:00">
          <first-name>John</first-name>
          <last-name>Smith</last-name>
          <student-number>002300</student-number>
          <test-id>9863</test-id>
          <summary-marks available="20" obtained="17" />
        </mcq-test-result>
      </mcq-test-results>
    XML
  end

  before(:each) do
    # Reset database before each test
    App.reset_database!
    # Share the app's repositories with the worker for inline testing
    Markr::Worker::ImportWorker.repository = App.repository
    Markr::Worker::ImportWorker.aggregate_repository = App.aggregate_repository
  end

  describe 'POST /import' do
    before do
      Sidekiq::Testing.fake!
      Sidekiq::Worker.clear_all
    end

    after do
      Sidekiq::Worker.clear_all
    end

    context 'with valid XML' do
      it 'returns 202 Accepted' do
        post '/import', valid_xml, { 'CONTENT_TYPE' => 'text/xml+markr' }.merge(auth_header)
        expect(last_response.status).to eq(202)
      end

      it 'returns job_id' do
        post '/import', valid_xml, { 'CONTENT_TYPE' => 'text/xml+markr' }.merge(auth_header)
        body = JSON.parse(last_response.body)
        expect(body['job_id']).not_to be_nil
      end

      it 'returns queued status' do
        post '/import', valid_xml, { 'CONTENT_TYPE' => 'text/xml+markr' }.merge(auth_header)
        body = JSON.parse(last_response.body)
        expect(body['status']).to eq('queued')
      end

      it 'enqueues a Sidekiq job' do
        expect {
          post '/import', valid_xml, { 'CONTENT_TYPE' => 'text/xml+markr' }.merge(auth_header)
        }.to change(Markr::Worker::ImportWorker.jobs, :size).by(1)
      end
    end

    context 'with invalid XML' do
      it 'returns 400 for malformed XML' do
        post '/import', '<invalid>', { 'CONTENT_TYPE' => 'text/xml+markr' }.merge(auth_header)
        expect(last_response.status).to eq(400)
      end

      it 'does not enqueue a job for malformed XML' do
        expect {
          post '/import', '<invalid>', { 'CONTENT_TYPE' => 'text/xml+markr' }.merge(auth_header)
        }.not_to change(Markr::Worker::ImportWorker.jobs, :size)
      end
    end

    context 'with unsupported content-type' do
      it 'returns 415 Unsupported Media Type' do
        post '/import', '{}', { 'CONTENT_TYPE' => 'application/json' }.merge(auth_header)
        expect(last_response.status).to eq(415)
      end

      it 'does not enqueue a job' do
        expect {
          post '/import', '{}', { 'CONTENT_TYPE' => 'application/json' }.merge(auth_header)
        }.not_to change(Markr::Worker::ImportWorker.jobs, :size)
      end
    end

    context 'without authentication' do
      it 'returns 401 Unauthorized' do
        post '/import', valid_xml, { 'CONTENT_TYPE' => 'text/xml+markr' }
        expect(last_response.status).to eq(401)
      end
    end
  end

  describe 'GET /results/:test_id/aggregate' do
    before do
      # Import data synchronously via inline mode for testing
      Sidekiq::Testing.inline! do
        post '/import', valid_xml, { 'CONTENT_TYPE' => 'text/xml+markr' }.merge(auth_header)
      end
    end

    context 'with existing test' do
      it 'returns 200' do
        get '/results/9863/aggregate', {}, auth_header
        expect(last_response.status).to eq(200)
      end

      it 'returns JSON content-type' do
        get '/results/9863/aggregate', {}, auth_header
        expect(last_response.content_type).to include('application/json')
      end

      it 'returns all statistics' do
        get '/results/9863/aggregate', {}, auth_header
        body = JSON.parse(last_response.body)

        expect(body).to include(
          'mean', 'stddev', 'min', 'max', 'count', 'p25', 'p50', 'p75'
        )
      end

      it 'calculates correct statistics' do
        get '/results/9863/aggregate', {}, auth_header
        body = JSON.parse(last_response.body)

        # Scores: 13/20 = 65%, 17/20 = 85%
        expect(body['count']).to eq(2)
        expect(body['mean']).to eq(75.0)
        expect(body['min']).to eq(65.0)
        expect(body['max']).to eq(85.0)
      end
    end

    context 'with unknown test' do
      it 'returns 404 Not Found' do
        get '/results/unknown/aggregate', {}, auth_header
        expect(last_response.status).to eq(404)
      end

      it 'returns error message' do
        get '/results/unknown/aggregate', {}, auth_header
        body = JSON.parse(last_response.body)
        expect(body['error']).to include('not found')
      end
    end
  end


  describe 'GET /jobs/:job_id' do
    # Uses sidekiq-status gem for job status tracking

    context 'with queued job' do
      it 'returns queued status' do
        job_id = 'test-job-123'
        allow(Sidekiq::Status).to receive(:status).with(job_id).and_return(:queued)

        get "/jobs/#{job_id}", {}, auth_header
        expect(last_response.status).to eq(200)

        body = JSON.parse(last_response.body)
        expect(body['status']).to eq('queued')
        expect(body['job_id']).to eq(job_id)
      end
    end

    context 'with processing job' do
      it 'returns processing status' do
        job_id = 'test-job-456'
        allow(Sidekiq::Status).to receive(:status).with(job_id).and_return(:working)

        get "/jobs/#{job_id}", {}, auth_header
        expect(last_response.status).to eq(200)

        body = JSON.parse(last_response.body)
        expect(body['status']).to eq('processing')
        expect(body['job_id']).to eq(job_id)
      end
    end

    context 'with failed job' do
      it 'returns failed status with error' do
        job_id = 'test-job-789'
        allow(Sidekiq::Status).to receive(:status).with(job_id).and_return(:failed)

        get "/jobs/#{job_id}", {}, auth_header
        expect(last_response.status).to eq(200)

        body = JSON.parse(last_response.body)
        expect(body['status']).to eq('failed')
        expect(body['error']).to eq('Job failed')
      end
    end

    context 'with interrupted job' do
      it 'returns failed status with error' do
        job_id = 'test-job-int'
        allow(Sidekiq::Status).to receive(:status).with(job_id).and_return(:interrupted)

        get "/jobs/#{job_id}", {}, auth_header
        expect(last_response.status).to eq(200)

        body = JSON.parse(last_response.body)
        expect(body['status']).to eq('failed')
        expect(body['error']).to eq('Job interrupted')
      end
    end

    context 'with completed job' do
      it 'returns completed status with test_ids' do
        job_id = 'test-job-done'
        allow(Sidekiq::Status).to receive(:status).with(job_id).and_return(:complete)
        allow(Sidekiq::Status).to receive(:get).with(job_id, :test_ids).and_return('9863,9864')

        get "/jobs/#{job_id}", {}, auth_header
        expect(last_response.status).to eq(200)

        body = JSON.parse(last_response.body)
        expect(body['status']).to eq('completed')
        expect(body['job_id']).to eq(job_id)
        expect(body['test_ids']).to eq(['9863', '9864'])
      end
    end

    context 'with unknown job_id' do
      it 'returns unknown status' do
        allow(Sidekiq::Status).to receive(:status).with('unknown-job-id').and_return(nil)

        get '/jobs/unknown-job-id', {}, auth_header
        expect(last_response.status).to eq(200)

        body = JSON.parse(last_response.body)
        expect(body['status']).to eq('unknown')
        expect(body['job_id']).to eq('unknown-job-id')
      end
    end
  end

  describe 'GET /health' do
    it 'returns 200' do
      get '/health'
      expect(last_response.status).to eq(200)
    end

    it 'returns ok status' do
      get '/health'
      body = JSON.parse(last_response.body)
      expect(body['status']).to eq('ok')
    end
  end

  describe 'GET /tests' do
    context 'with no data' do
      it 'returns empty list' do
        get '/tests', {}, auth_header
        expect(last_response.status).to eq(200)

        body = JSON.parse(last_response.body)
        expect(body['tests']).to eq([])
        expect(body['count']).to eq(0)
      end
    end

    context 'with data' do
      before do
        Sidekiq::Testing.inline! do
          post '/import', valid_xml, { 'CONTENT_TYPE' => 'text/xml+markr' }.merge(auth_header)
        end
      end

      it 'returns list of tests' do
        get '/tests', {}, auth_header
        expect(last_response.status).to eq(200)

        body = JSON.parse(last_response.body)
        expect(body['count']).to eq(1)
        expect(body['tests'].first['test_id']).to eq('9863')
      end

      it 'includes aggregate statistics' do
        get '/tests', {}, auth_header
        body = JSON.parse(last_response.body)

        test = body['tests'].first
        expect(test).to include('mean', 'count', 'min', 'max')
      end
    end

    context 'without authentication' do
      it 'returns 401' do
        get '/tests'
        expect(last_response.status).to eq(401)
      end
    end
  end

  describe 'GET /students' do
    context 'with no data' do
      it 'returns empty list' do
        get '/students', {}, auth_header
        expect(last_response.status).to eq(200)

        body = JSON.parse(last_response.body)
        expect(body['students']).to eq([])
        expect(body['count']).to eq(0)
      end
    end

    context 'with data' do
      before do
        Sidekiq::Testing.inline! do
          post '/import', valid_xml, { 'CONTENT_TYPE' => 'text/xml+markr' }.merge(auth_header)
        end
      end

      it 'returns list of students' do
        get '/students', {}, auth_header
        expect(last_response.status).to eq(200)

        body = JSON.parse(last_response.body)
        expect(body['count']).to eq(2)
      end

      it 'includes student details' do
        get '/students', {}, auth_header
        body = JSON.parse(last_response.body)

        student_numbers = body['students'].map { |s| s['student_number'] }
        expect(student_numbers).to contain_exactly('002299', '002300')
      end
    end

    context 'without authentication' do
      it 'returns 401' do
        get '/students'
        expect(last_response.status).to eq(401)
      end
    end
  end

  describe 'GET /students/:student_number' do
    before do
      Sidekiq::Testing.inline! do
        post '/import', valid_xml, { 'CONTENT_TYPE' => 'text/xml+markr' }.merge(auth_header)
      end
    end

    context 'with existing student' do
      it 'returns 200' do
        get '/students/002299', {}, auth_header
        expect(last_response.status).to eq(200)
      end

      it 'returns student results' do
        get '/students/002299', {}, auth_header
        body = JSON.parse(last_response.body)

        expect(body['student_number']).to eq('002299')
        expect(body['count']).to eq(1)
        expect(body['results']).to be_an(Array)
      end

      it 'includes test result details' do
        get '/students/002299', {}, auth_header
        body = JSON.parse(last_response.body)

        result = body['results'].first
        expect(result['test_id']).to eq('9863')
        expect(result['marks_obtained']).to eq(13)
        expect(result['percentage']).to eq(65.0)
      end
    end

    context 'with unknown student' do
      it 'returns 404' do
        get '/students/unknown', {}, auth_header
        expect(last_response.status).to eq(404)
      end

      it 'returns error message' do
        get '/students/unknown', {}, auth_header
        body = JSON.parse(last_response.body)
        expect(body['error']).to include('not found')
      end
    end
  end

  describe 'GET /students/:student_number/tests/:test_id' do
    before do
      Sidekiq::Testing.inline! do
        post '/import', valid_xml, { 'CONTENT_TYPE' => 'text/xml+markr' }.merge(auth_header)
      end
    end

    context 'with existing result' do
      it 'returns 200' do
        get '/students/002299/tests/9863', {}, auth_header
        expect(last_response.status).to eq(200)
      end

      it 'returns the specific result' do
        get '/students/002299/tests/9863', {}, auth_header
        body = JSON.parse(last_response.body)

        expect(body['student_number']).to eq('002299')
        expect(body['test_id']).to eq('9863')
        expect(body['marks_obtained']).to eq(13)
        expect(body['marks_available']).to eq(20)
        expect(body['percentage']).to eq(65.0)
      end
    end

    context 'with unknown student' do
      it 'returns 404' do
        get '/students/unknown/tests/9863', {}, auth_header
        expect(last_response.status).to eq(404)
      end
    end

    context 'with unknown test' do
      it 'returns 404' do
        get '/students/002299/tests/unknown', {}, auth_header
        expect(last_response.status).to eq(404)
      end
    end
  end

  describe 'GET /tests/:test_id/students' do
    before do
      Sidekiq::Testing.inline! do
        post '/import', valid_xml, { 'CONTENT_TYPE' => 'text/xml+markr' }.merge(auth_header)
      end
    end

    context 'with existing test' do
      it 'returns 200' do
        get '/tests/9863/students', {}, auth_header
        expect(last_response.status).to eq(200)
      end

      it 'returns list of students' do
        get '/tests/9863/students', {}, auth_header
        body = JSON.parse(last_response.body)

        expect(body['test_id']).to eq('9863')
        expect(body['count']).to eq(2)
        expect(body['students']).to be_an(Array)
      end

      it 'returns students sorted by score descending' do
        get '/tests/9863/students', {}, auth_header
        body = JSON.parse(last_response.body)

        scores = body['students'].map { |s| s['marks_obtained'] }
        expect(scores).to eq([17, 13]) # John (17) before KJ (13)
      end

      it 'includes student details and scores' do
        get '/tests/9863/students', {}, auth_header
        body = JSON.parse(last_response.body)

        student = body['students'].first
        expect(student).to include(
          'student_number', 'student_name', 'marks_obtained', 'marks_available', 'percentage'
        )
      end
    end

    context 'with unknown test' do
      it 'returns 404' do
        get '/tests/unknown/students', {}, auth_header
        expect(last_response.status).to eq(404)
      end

      it 'returns error message' do
        get '/tests/unknown/students', {}, auth_header
        body = JSON.parse(last_response.body)
        expect(body['error']).to include('not found')
      end
    end
  end
end
