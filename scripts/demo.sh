#!/bin/bash
# Demo: health check, import, and aggregate
# Usage: ./scripts/demo.sh

set -e

BASE_URL="${MARKR_URL:-http://localhost:4567}"
USERNAME="${MARKR_USER:-markr}"
PASSWORD="${MARKR_PASS:-secret}"

echo "=== Markr Demo ==="
echo ""

echo "1. Health Check"
curl -s "$BASE_URL/health" | jq .
echo ""

echo "2. Import Sample Data"
response=$(curl -s -u "$USERNAME:$PASSWORD" -X POST "$BASE_URL/import" \
  -H "Content-Type: text/xml+markr" \
  -d @data/sample_results.xml)
echo "$response" | jq .

job_id=$(echo "$response" | jq -r '.job_id')
echo ""

echo "3. Waiting for job $job_id..."
max_attempts=20
attempt=0
while [ $attempt -lt $max_attempts ]; do
  status=$(curl -s -u "$USERNAME:$PASSWORD" "$BASE_URL/jobs/$job_id" | jq -r '.status')
  echo "   Status: $status"

  if [ "$status" = "completed" ]; then
    echo ""
    echo "4. Get Aggregate for Test 9863"
    curl -s -u "$USERNAME:$PASSWORD" "$BASE_URL/results/9863/aggregate" | jq .
    echo ""
    echo "=== Done ==="
    exit 0
  fi

  if [ "$status" = "failed" ] || [ "$status" = "dead" ]; then
    echo "   Job failed!"
    curl -s -u "$USERNAME:$PASSWORD" "$BASE_URL/jobs/$job_id" | jq .
    exit 1
  fi

  sleep 0.5
  attempt=$((attempt + 1))
done

echo "   Timeout waiting for job"
exit 1
