#!/bin/bash
# Import test results from XML file (synchronous)
# Usage: ./scripts/import.sh [file.xml]

BASE_URL="${MARKR_URL:-http://localhost:4567}"
USERNAME="${MARKR_USER:-markr}"
PASSWORD="${MARKR_PASS:-secret}"

FILE="${1:-data/sample_results.xml}"

if [ ! -f "$FILE" ]; then
  echo "Error: File not found: $FILE"
  echo "Usage: ./scripts/import.sh [file.xml]"
  exit 1
fi

echo "Importing from $FILE to $BASE_URL/import"
curl -s -u "$USERNAME:$PASSWORD" -X POST "$BASE_URL/import" \
  -H "Content-Type: text/xml+markr" \
  -d @"$FILE" | jq .
