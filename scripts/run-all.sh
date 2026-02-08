#!/bin/bash
# Build, test, and run everything
# Usage: ./scripts/run-all.sh

set -e

# Use Homebrew Ruby if available
if [ -d "/opt/homebrew/opt/ruby/bin" ]; then
  export PATH="/opt/homebrew/opt/ruby/bin:$PATH"
fi

cd "$(dirname "$0")/.."

echo "=== Markr Setup ==="

# Stop existing containers
echo "Cleaning up..."
docker-compose down -v 2>/dev/null || true

# Build and test in Docker
echo "Building..."
docker-compose build --no-cache

echo "Running tests..."
docker-compose run --rm app bundle exec rspec --format progress

# Start services (force recreate to use new images)
echo "Starting services..."
docker-compose up -d --force-recreate

# Wait for app
echo "Waiting for app..."
until curl -s http://localhost:4567/health > /dev/null 2>&1; do
  sleep 1
done

# Run demo
echo ""
./scripts/demo.sh

echo ""
echo "=== Ready ==="
echo "App: http://localhost:4567"
echo "Credentials: markr:secret"
echo ""
echo "Commands:"
echo "  docker-compose logs -f    # View logs"
echo "  docker-compose down       # Stop"
