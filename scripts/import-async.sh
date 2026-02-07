#!/bin/bash
# Import test results from XML file (asynchronous via Sidekiq)
# Usage: ./scripts/import-async.sh [file.xml]

BASE_URL="${MARKR_URL:-http://localhost:4567}"
USERNAME="${MARKR_USER:-markr}"
PASSWORD="${MARKR_PASS:-secret}"

FILE="${1:-data/sample_results.xml}"

if [ ! -f "$FILE" ]; then
  echo "Error: File not found: $FILE"
  echo "Usage: ./scripts/import-async.sh [file.xml]"
  exit 1
fi

echo "Queueing async import from $FILE to $BASE_URL/import/async"
curl -s -u "$USERNAME:$PASSWORD" -X POST "$BASE_URL/import/async" \
  -H "Content-Type: text/xml+markr" \
  -d @"$FILE" | jq .
