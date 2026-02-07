#!/bin/bash
# Full demo: health check, import, and aggregate
# Usage: ./scripts/demo.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_URL="${MARKR_URL:-http://localhost:4567}"

echo "=== Markr Demo ==="
echo ""

echo "1. Health Check"
echo "---------------"
"$SCRIPT_DIR/health.sh"
echo ""

echo "2. Import Sample Data (sync)"
echo "----------------------------"
"$SCRIPT_DIR/import.sh" data/sample_results.xml
echo ""

echo "3. Get Aggregate for Test 9863"
echo "------------------------------"
"$SCRIPT_DIR/aggregate.sh" 9863
echo ""

echo "=== Demo Complete ==="
