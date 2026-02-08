require 'sidekiq'
require 'sidekiq-status'

Sidekiq.configure_server do |config|
  config.redis = { url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/0') }
  # Configure sidekiq-status server middleware
  Sidekiq::Status.configure_server_middleware config, expiration: 3600  # 1 hour expiration
end

Sidekiq.configure_client do |config|
  config.redis = { url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/0') }
  # Configure sidekiq-status client middleware
  Sidekiq::Status.configure_client_middleware config, expiration: 3600
end
