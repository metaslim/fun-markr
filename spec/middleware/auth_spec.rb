require 'spec_helper'
require 'rack/test'
require_relative '../../lib/markr/middleware/auth'

RSpec.describe Markr::Middleware::Auth do
  include Rack::Test::Methods

  let(:inner_app) { ->(env) { [200, { 'Content-Type' => 'application/json' }, ['{"ok":true}']] } }
  let(:username) { 'testuser' }
  let(:password) { 'testpass' }
  let(:app) { described_class.new(inner_app, username: username, password: password) }

  describe 'with valid credentials' do
    it 'allows access' do
      authorize username, password
      get '/tests'

      expect(last_response.status).to eq(200)
      expect(last_response.body).to eq('{"ok":true}')
    end
  end

  describe 'with invalid credentials' do
    it 'returns 401 Unauthorized' do
      authorize 'wrong', 'credentials'
      get '/tests'

      expect(last_response.status).to eq(401)
      expect(last_response.body).to include('Unauthorized')
    end

    it 'includes WWW-Authenticate header' do
      authorize 'wrong', 'credentials'
      get '/tests'

      expect(last_response.headers['WWW-Authenticate']).to include('Basic realm=')
    end
  end

  describe 'without credentials' do
    it 'returns 401 Unauthorized' do
      get '/tests'

      expect(last_response.status).to eq(401)
    end
  end

  describe 'skip paths' do
    it 'allows /health without auth' do
      get '/health'

      expect(last_response.status).to eq(200)
    end

    it 'allows OPTIONS requests without auth (CORS preflight)' do
      options '/tests'

      expect(last_response.status).to eq(200)
    end
  end
end
