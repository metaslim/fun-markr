#!/bin/bash
# Import test results from XML file
# Usage: ./scripts/import.sh [file.xml]

set -e

BASE_URL="${MARKR_URL:-http://localhost:4567}"
USERNAME="${MARKR_USER:-markr}"
PASSWORD="${MARKR_PASS:-secret}"
FILE="${1:-data/sample_results.xml}"

if [ ! -f "$FILE" ]; then
  echo "Error: File not found: $FILE"
  exit 1
fi

echo "Importing $FILE..."
response=$(curl -s -u "$USERNAME:$PASSWORD" -X POST "$BASE_URL/import" \
  -H "Content-Type: text/xml+markr" \
  -d @"$FILE")
echo "$response" | jq .

job_id=$(echo "$response" | jq -r '.job_id')

if [ "$job_id" = "null" ] || [ -z "$job_id" ]; then
  echo "Error: No job_id returned"
  exit 1
fi

echo "Waiting for job $job_id..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
  status=$(curl -s -u "$USERNAME:$PASSWORD" "$BASE_URL/jobs/$job_id" | jq -r '.status')

  if [ "$status" = "completed" ]; then
    echo "Done!"
    exit 0
  fi

  if [ "$status" = "failed" ] || [ "$status" = "dead" ]; then
    echo "Job failed!"
    curl -s -u "$USERNAME:$PASSWORD" "$BASE_URL/jobs/$job_id" | jq .
    exit 1
  fi

  sleep 0.5
  attempt=$((attempt + 1))
done

echo "Timeout waiting for job"
exit 1
