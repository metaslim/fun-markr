module Markr
  module Middleware
    class Auth
      SKIP_PATHS = ['/health'].freeze

      def initialize(app, username:, password:)
        @app = app
        @username = username
        @password = password
      end

      def call(env)
        request = Rack::Request.new(env)

        # Skip auth for certain paths and OPTIONS requests
        if skip_auth?(request)
          return @app.call(env)
        end

        if authorized?(env)
          @app.call(env)
        else
          unauthorized_response
        end
      end

      private

      def skip_auth?(request)
        SKIP_PATHS.include?(request.path_info) || request.request_method == 'OPTIONS'
      end

      def authorized?(env)
        auth = Rack::Auth::Basic::Request.new(env)
        auth.provided? && auth.basic? && auth.credentials == [@username, @password]
      end

      def unauthorized_response
        [
          401,
          {
            'Content-Type' => 'application/json',
            'WWW-Authenticate' => 'Basic realm="Markr API"'
          },
          ['{"error":"Unauthorized"}']
        ]
      end
    end
  end
end
