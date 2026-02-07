#!/bin/bash
# Health check - no authentication required

BASE_URL="${MARKR_URL:-http://localhost:4567}"

echo "Checking health at $BASE_URL/health"
curl -s "$BASE_URL/health" | jq .
