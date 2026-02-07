#!/bin/bash
# Test all edge case data files
# Usage: ./scripts/test-edge-cases.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_URL="${MARKR_URL:-http://localhost:4567}"
USERNAME="${MARKR_USER:-markr}"
PASSWORD="${MARKR_PASS:-secret}"

echo "=== Testing Edge Cases ==="
echo ""

# Helper function
test_import() {
  local file="$1"
  local expected_status="$2"
  local description="$3"

  echo "Testing: $description"
  echo "File: $file"

  response=$(curl -s -w "\n%{http_code}" -u "$USERNAME:$PASSWORD" -X POST "$BASE_URL/import" \
    -H "Content-Type: text/xml+markr" \
    -d @"$file")

  body=$(echo "$response" | head -n -1)
  status=$(echo "$response" | tail -n 1)

  if [ "$status" -eq "$expected_status" ]; then
    echo "✓ Status: $status (expected $expected_status)"
  else
    echo "✗ Status: $status (expected $expected_status)"
  fi
  echo "Response: $body"
  echo ""
}

test_aggregate() {
  local test_id="$1"
  local description="$2"

  echo "Aggregate: $description (test_id=$test_id)"
  curl -s -u "$USERNAME:$PASSWORD" "$BASE_URL/results/$test_id/aggregate" | jq .
  echo ""
}

echo "=== 1. Duplicate Handling (should keep highest score) ==="
test_import "data/edge_duplicates.xml" 201 "Duplicate submissions"
test_aggregate "TEST001" "Should show max=90% (18/20), not lower duplicates"

echo "=== 2. Missing Fields (should reject entire document) ==="
test_import "data/edge_missing_fields.xml" 400 "Missing student-number"
test_import "data/edge_missing_testid.xml" 400 "Missing test-id"
test_import "data/edge_missing_marks.xml" 400 "Missing summary-marks"

echo "=== 3. Malformed XML (should reject) ==="
test_import "data/edge_malformed.xml" 400 "Malformed XML"

echo "=== 4. Perfect Scores (all 100%) ==="
test_import "data/edge_perfect_scores.xml" 201 "Perfect scores"
test_aggregate "PERFECT" "Mean=100, Min=100, Max=100, StdDev=0"

echo "=== 5. Zero Scores (all 0%) ==="
test_import "data/edge_zero_scores.xml" 201 "Zero scores"
test_aggregate "ZERO" "Mean=0, Min=0, Max=0, StdDev=0"

echo "=== 6. Single Student ==="
test_import "data/edge_single_student.xml" 201 "Single student"
test_aggregate "SINGLE" "Count=1, StdDev=0"

echo "=== 7. Varied Available Marks (percentage normalization) ==="
test_import "data/edge_varied_available.xml" 201 "Varied available marks"
test_aggregate "VARIED" "Different available marks should normalize to percentages"

echo "=== 8. Multiple Tests in One Import ==="
test_import "data/edge_multiple_tests.xml" 201 "Multiple tests"
test_aggregate "TESTA" "Test A: 3 students (50%, 75%, 100%)"
test_aggregate "TESTB" "Test B: 2 students (80%, 90%)"

echo "=== 9. Empty Results ==="
test_import "data/edge_empty.xml" 201 "Empty results (0 imported)"

echo "=== Edge Case Testing Complete ==="
