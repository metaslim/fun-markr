#!/bin/bash
# Check async job status
# Usage: ./scripts/job-status.sh <job_id>

BASE_URL="${MARKR_URL:-http://localhost:4567}"
USERNAME="${MARKR_USER:-markr}"
PASSWORD="${MARKR_PASS:-secret}"

JOB_ID="$1"

if [ -z "$JOB_ID" ]; then
  echo "Error: Job ID required"
  echo "Usage: ./scripts/job-status.sh <job_id>"
  exit 1
fi

echo "Checking job status for $JOB_ID"
curl -s -u "$USERNAME:$PASSWORD" "$BASE_URL/jobs/$JOB_ID" | jq .
