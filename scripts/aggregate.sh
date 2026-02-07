#!/bin/bash
# Get aggregate statistics for a test
# Usage: ./scripts/aggregate.sh <test_id>

BASE_URL="${MARKR_URL:-http://localhost:4567}"
USERNAME="${MARKR_USER:-markr}"
PASSWORD="${MARKR_PASS:-secret}"

TEST_ID="${1:-9863}"

echo "Getting aggregate for test $TEST_ID"
curl -s -u "$USERNAME:$PASSWORD" "$BASE_URL/results/$TEST_ID/aggregate" | jq .
