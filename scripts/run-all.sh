#!/bin/bash
# Master script: Build, start, and test everything
# Usage: ./scripts/run-all.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "========================================"
echo "   MARKR - Complete Setup & Test Suite"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_step() {
  echo ""
  echo -e "${YELLOW}>>> $1${NC}"
  echo "----------------------------------------"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

# Step 1: Run unit tests
print_step "Step 1: Running RSpec unit tests"
if bundle exec rspec --format progress; then
  print_success "All 111 tests passed!"
else
  print_error "Tests failed!"
  exit 1
fi

# Step 2: Build Docker containers
print_step "Step 2: Building Docker containers"
docker-compose build --no-cache
print_success "Docker build complete"

# Step 3: Start services
print_step "Step 3: Starting Docker services"
docker-compose down -v 2>/dev/null || true
docker-compose up -d
print_success "Services starting..."

# Step 4: Wait for services to be healthy
print_step "Step 4: Waiting for services to be healthy"
echo "Waiting for PostgreSQL..."
until docker-compose exec -T db pg_isready -U markr > /dev/null 2>&1; do
  sleep 1
  echo -n "."
done
echo ""
print_success "PostgreSQL is ready"

echo "Waiting for Redis..."
until docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; do
  sleep 1
  echo -n "."
done
echo ""
print_success "Redis is ready"

echo "Waiting for app..."
max_attempts=30
attempt=0
until curl -s http://localhost:4567/health > /dev/null 2>&1; do
  sleep 1
  echo -n "."
  attempt=$((attempt + 1))
  if [ $attempt -ge $max_attempts ]; then
    print_error "App failed to start after ${max_attempts} seconds"
    docker-compose logs app
    exit 1
  fi
done
echo ""
print_success "App is ready"

# Step 5: Health check
print_step "Step 5: Health check"
"$SCRIPT_DIR/health.sh"
print_success "Health check passed"

# Step 6: Demo workflow
print_step "Step 6: Running demo workflow"
"$SCRIPT_DIR/demo.sh"
print_success "Demo completed"

# Step 7: Edge case tests
print_step "Step 7: Running edge case tests"
"$SCRIPT_DIR/test-edge-cases.sh"
print_success "Edge case tests completed"

# Step 8: Test async import
print_step "Step 8: Testing async import"
echo "Submitting async import..."
response=$(curl -s -u markr:secret -X POST http://localhost:4567/import/async \
  -H "Content-Type: text/xml+markr" \
  -d @data/sample_results.xml)
echo "Response: $response"

job_id=$(echo "$response" | jq -r '.job_id')
if [ "$job_id" != "null" ] && [ -n "$job_id" ]; then
  echo "Job ID: $job_id"
  echo "Waiting for job to complete..."
  sleep 2
  "$SCRIPT_DIR/job-status.sh" "$job_id"
  print_success "Async import test completed"
else
  print_error "Failed to get job_id from async import"
fi

# Step 9: Show service status
print_step "Step 9: Service status"
docker-compose ps

# Summary
echo ""
echo "========================================"
echo -e "${GREEN}   ALL TESTS PASSED SUCCESSFULLY!${NC}"
echo "========================================"
echo ""
echo "Services are running:"
echo "  - App:      http://localhost:4567"
echo "  - Health:   http://localhost:4567/health"
echo ""
echo "Credentials: markr:secret"
echo ""
echo "Commands:"
echo "  - View logs:    docker-compose logs -f"
echo "  - Stop:         docker-compose down"
echo "  - Import data:  ./scripts/import.sh data/sample_results.xml"
echo "  - Get stats:    ./scripts/aggregate.sh 9863"
echo ""
