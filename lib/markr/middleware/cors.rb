module Markr
  module Middleware
    class Cors
      ALLOWED_METHODS = 'GET, POST, OPTIONS'.freeze
      ALLOWED_HEADERS = 'Authorization, Content-Type'.freeze

      def initialize(app)
        @app = app
      end

      def call(env)
        # Handle preflight OPTIONS request
        if env['REQUEST_METHOD'] == 'OPTIONS'
          return [200, cors_headers, ['']]
        end

        status, headers, body = @app.call(env)
        [status, headers.merge(cors_headers), body]
      end

      private

      def cors_headers
        {
          'Access-Control-Allow-Origin' => '*',
          'Access-Control-Allow-Methods' => ALLOWED_METHODS,
          'Access-Control-Allow-Headers' => ALLOWED_HEADERS
        }
      end
    end
  end
end
