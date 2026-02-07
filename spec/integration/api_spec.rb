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
  end

  describe 'POST /import' do
    context 'with valid XML' do
      it 'returns 201 Created' do
        post '/import', valid_xml, { 'CONTENT_TYPE' => 'text/xml+markr' }.merge(auth_header)
        expect(last_response.status).to eq(201)
      end

      it 'returns import count' do
        post '/import', valid_xml, { 'CONTENT_TYPE' => 'text/xml+markr' }.merge(auth_header)
        body = JSON.parse(last_response.body)
        expect(body['imported']).to eq(2)
      end
    end

    context 'with invalid XML' do
      it 'returns 400 for malformed XML' do
        post '/import', '<invalid>', { 'CONTENT_TYPE' => 'text/xml+markr' }.merge(auth_header)
        expect(last_response.status).to eq(400)
      end

      it 'returns 400 for missing required fields' do
        xml = <<~XML
          <mcq-test-results>
            <mcq-test-result>
              <test-id>9863</test-id>
              <summary-marks available="20" obtained="13" />
            </mcq-test-result>
          </mcq-test-results>
        XML

        post '/import', xml, { 'CONTENT_TYPE' => 'text/xml+markr' }.merge(auth_header)
        expect(last_response.status).to eq(400)
      end
    end

    context 'with unsupported content-type' do
      it 'returns 415 Unsupported Media Type' do
        post '/import', '{}', { 'CONTENT_TYPE' => 'application/json' }.merge(auth_header)
        expect(last_response.status).to eq(415)
      end
    end

    context 'with duplicate submissions' do
      it 'keeps higher score' do
        # First submission: score 13
        post '/import', valid_xml, { 'CONTENT_TYPE' => 'text/xml+markr' }.merge(auth_header)

        # Second submission: higher score for same student
        higher_xml = <<~XML
          <mcq-test-results>
            <mcq-test-result>
              <student-number>002299</student-number>
              <test-id>9863</test-id>
              <summary-marks available="20" obtained="18" />
            </mcq-test-result>
          </mcq-test-results>
        XML

        post '/import', higher_xml, { 'CONTENT_TYPE' => 'text/xml+markr' }.merge(auth_header)

        get '/results/9863/aggregate', {}, auth_header
        body = JSON.parse(last_response.body)

        # Max should be 90% (18/20), not 65% (13/20)
        expect(body['max']).to eq(90.0)
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
      post '/import', valid_xml, { 'CONTENT_TYPE' => 'text/xml+markr' }.merge(auth_header)
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

  describe 'POST /import/async' do
    before do
      Sidekiq::Testing.fake!
      Sidekiq::Worker.clear_all
    end

    after do
      Sidekiq::Worker.clear_all
    end

    context 'with valid XML' do
      it 'returns 202 Accepted' do
        post '/import/async', valid_xml, { 'CONTENT_TYPE' => 'text/xml+markr' }.merge(auth_header)
        expect(last_response.status).to eq(202)
      end

      it 'returns job_id' do
        post '/import/async', valid_xml, { 'CONTENT_TYPE' => 'text/xml+markr' }.merge(auth_header)
        body = JSON.parse(last_response.body)
        expect(body['job_id']).not_to be_nil
      end

      it 'returns queued status' do
        post '/import/async', valid_xml, { 'CONTENT_TYPE' => 'text/xml+markr' }.merge(auth_header)
        body = JSON.parse(last_response.body)
        expect(body['status']).to eq('queued')
      end

      it 'enqueues a Sidekiq job' do
        expect {
          post '/import/async', valid_xml, { 'CONTENT_TYPE' => 'text/xml+markr' }.merge(auth_header)
        }.to change(Markr::Worker::ImportWorker.jobs, :size).by(1)
      end
    end

    context 'with invalid XML' do
      it 'returns 400 for malformed XML' do
        post '/import/async', '<invalid>', { 'CONTENT_TYPE' => 'text/xml+markr' }.merge(auth_header)
        expect(last_response.status).to eq(400)
      end

      it 'does not enqueue a job for malformed XML' do
        expect {
          post '/import/async', '<invalid>', { 'CONTENT_TYPE' => 'text/xml+markr' }.merge(auth_header)
        }.not_to change(Markr::Worker::ImportWorker.jobs, :size)
      end
    end

    context 'with unsupported content-type' do
      it 'returns 415 Unsupported Media Type' do
        post '/import/async', '{}', { 'CONTENT_TYPE' => 'application/json' }.merge(auth_header)
        expect(last_response.status).to eq(415)
      end

      it 'does not enqueue a job' do
        expect {
          post '/import/async', '{}', { 'CONTENT_TYPE' => 'application/json' }.merge(auth_header)
        }.not_to change(Markr::Worker::ImportWorker.jobs, :size)
      end
    end
  end

  describe 'GET /jobs/:job_id' do
    let(:mock_queue) { instance_double(Sidekiq::Queue) }
    let(:mock_workers) { instance_double(Sidekiq::Workers) }
    let(:mock_retry_set) { instance_double(Sidekiq::RetrySet) }
    let(:mock_dead_set) { instance_double(Sidekiq::DeadSet) }

    before do
      allow(Sidekiq::Queue).to receive(:new).with('imports').and_return(mock_queue)
      allow(Sidekiq::Workers).to receive(:new).and_return(mock_workers)
      allow(Sidekiq::RetrySet).to receive(:new).and_return(mock_retry_set)
      allow(Sidekiq::DeadSet).to receive(:new).and_return(mock_dead_set)
    end

    context 'with queued job' do
      it 'returns queued status' do
        job_id = 'test-job-123'
        mock_job = double('job', jid: job_id)

        allow(mock_queue).to receive(:any?).and_yield(mock_job).and_return(true)

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

        allow(mock_queue).to receive(:any?).and_return(false)
        allow(mock_workers).to receive(:any?).and_yield('worker', 'tid', { 'payload' => { 'jid' => job_id } }).and_return(true)

        get "/jobs/#{job_id}", {}, auth_header
        expect(last_response.status).to eq(200)

        body = JSON.parse(last_response.body)
        expect(body['status']).to eq('processing')
        expect(body['job_id']).to eq(job_id)
      end
    end

    context 'with failed job in retry queue' do
      it 'returns failed status with error' do
        job_id = 'test-job-789'
        mock_failed_job = double('job', jid: job_id, item: { 'error_message' => 'Something went wrong' })

        allow(mock_queue).to receive(:any?).and_return(false)
        allow(mock_workers).to receive(:any?).and_return(false)
        allow(mock_retry_set).to receive(:find).and_yield(mock_failed_job).and_return(mock_failed_job)

        get "/jobs/#{job_id}", {}, auth_header
        expect(last_response.status).to eq(200)

        body = JSON.parse(last_response.body)
        expect(body['status']).to eq('failed')
        expect(body['error']).to eq('Something went wrong')
      end
    end

    context 'with dead job' do
      it 'returns dead status with error' do
        job_id = 'test-job-dead'
        mock_dead_job = double('job', jid: job_id, item: { 'error_message' => 'Permanently failed' })

        allow(mock_queue).to receive(:any?).and_return(false)
        allow(mock_workers).to receive(:any?).and_return(false)
        allow(mock_retry_set).to receive(:find).and_return(nil)
        allow(mock_dead_set).to receive(:find).and_yield(mock_dead_job).and_return(mock_dead_job)

        get "/jobs/#{job_id}", {}, auth_header
        expect(last_response.status).to eq(200)

        body = JSON.parse(last_response.body)
        expect(body['status']).to eq('dead')
        expect(body['error']).to eq('Permanently failed')
      end
    end

    context 'with unknown job_id (assumed completed)' do
      it 'returns completed status' do
        allow(mock_queue).to receive(:any?).and_return(false)
        allow(mock_workers).to receive(:any?).and_return(false)
        allow(mock_retry_set).to receive(:find).and_return(nil)
        allow(mock_dead_set).to receive(:find).and_return(nil)

        get '/jobs/unknown-job-id', {}, auth_header
        expect(last_response.status).to eq(200)

        body = JSON.parse(last_response.body)
        expect(body['status']).to eq('completed')
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
end
