require 'spec_helper'
require 'rack/test'
require_relative '../../app'

RSpec.describe 'API' do
  include Rack::Test::Methods

  def app
    App
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
        post '/import', valid_xml, { 'CONTENT_TYPE' => 'text/xml+markr' }
        expect(last_response.status).to eq(201)
      end

      it 'returns import count' do
        post '/import', valid_xml, { 'CONTENT_TYPE' => 'text/xml+markr' }
        body = JSON.parse(last_response.body)
        expect(body['imported']).to eq(2)
      end
    end

    context 'with invalid XML' do
      it 'returns 400 for malformed XML' do
        post '/import', '<invalid>', { 'CONTENT_TYPE' => 'text/xml+markr' }
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

        post '/import', xml, { 'CONTENT_TYPE' => 'text/xml+markr' }
        expect(last_response.status).to eq(400)
      end
    end

    context 'with unsupported content-type' do
      it 'returns 415 Unsupported Media Type' do
        post '/import', '{}', { 'CONTENT_TYPE' => 'application/json' }
        expect(last_response.status).to eq(415)
      end
    end

    context 'with duplicate submissions' do
      it 'keeps higher score' do
        # First submission: score 13
        post '/import', valid_xml, { 'CONTENT_TYPE' => 'text/xml+markr' }

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

        post '/import', higher_xml, { 'CONTENT_TYPE' => 'text/xml+markr' }

        get '/results/9863/aggregate'
        body = JSON.parse(last_response.body)

        # Max should be 90% (18/20), not 65% (13/20)
        expect(body['max']).to eq(90.0)
      end
    end
  end

  describe 'GET /results/:test_id/aggregate' do
    before do
      post '/import', valid_xml, { 'CONTENT_TYPE' => 'text/xml+markr' }
    end

    context 'with existing test' do
      it 'returns 200' do
        get '/results/9863/aggregate'
        expect(last_response.status).to eq(200)
      end

      it 'returns JSON content-type' do
        get '/results/9863/aggregate'
        expect(last_response.content_type).to include('application/json')
      end

      it 'returns all statistics' do
        get '/results/9863/aggregate'
        body = JSON.parse(last_response.body)

        expect(body).to include(
          'mean', 'stddev', 'min', 'max', 'count', 'p25', 'p50', 'p75'
        )
      end

      it 'calculates correct statistics' do
        get '/results/9863/aggregate'
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
        get '/results/unknown/aggregate'
        expect(last_response.status).to eq(404)
      end

      it 'returns error message' do
        get '/results/unknown/aggregate'
        body = JSON.parse(last_response.body)
        expect(body['error']).to include('not found')
      end
    end
  end
end
