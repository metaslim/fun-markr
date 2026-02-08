require 'spec_helper'
require 'rack/test'
require_relative '../../lib/markr/middleware/cors'

RSpec.describe Markr::Middleware::Cors do
  include Rack::Test::Methods

  let(:inner_app) { ->(env) { [200, { 'Content-Type' => 'application/json' }, ['{"ok":true}']] } }
  let(:app) { described_class.new(inner_app) }

  describe 'CORS headers' do
    it 'adds Access-Control-Allow-Origin header' do
      get '/tests'

      expect(last_response.headers['Access-Control-Allow-Origin']).to eq('*')
    end

    it 'adds Access-Control-Allow-Methods header' do
      get '/tests'

      expect(last_response.headers['Access-Control-Allow-Methods']).to eq('GET, POST, OPTIONS')
    end

    it 'adds Access-Control-Allow-Headers header' do
      get '/tests'

      expect(last_response.headers['Access-Control-Allow-Headers']).to eq('Authorization, Content-Type')
    end
  end

  describe 'OPTIONS preflight request' do
    it 'returns 200 OK' do
      options '/tests'

      expect(last_response.status).to eq(200)
    end

    it 'includes CORS headers' do
      options '/tests'

      expect(last_response.headers['Access-Control-Allow-Origin']).to eq('*')
      expect(last_response.headers['Access-Control-Allow-Methods']).to eq('GET, POST, OPTIONS')
      expect(last_response.headers['Access-Control-Allow-Headers']).to eq('Authorization, Content-Type')
    end

    it 'returns empty body' do
      options '/tests'

      expect(last_response.body).to eq('')
    end
  end

  describe 'passthrough to inner app' do
    it 'passes GET requests to inner app' do
      get '/tests'

      expect(last_response.status).to eq(200)
      expect(last_response.body).to eq('{"ok":true}')
    end

    it 'passes POST requests to inner app' do
      post '/import'

      expect(last_response.status).to eq(200)
    end
  end
end
