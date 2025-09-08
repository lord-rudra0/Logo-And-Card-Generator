#!/usr/bin/env bash
set -euo pipefail
BASE_URL=${BASE_URL:-http://localhost:8000}

echo "Health check: $BASE_URL/health"
curl -sS ${BASE_URL}/health | jq . || true

echo "\nStability quick test (512x320):"
curl -sS -X POST ${BASE_URL}/generate/stability -H 'Content-Type: application/json' -d '{"prompt":"Test business card graphic","width":512,"height":320}' | jq . || true

echo "\nHF/card test (512x320):"
curl -sS -X POST ${BASE_URL}/generate/card -H 'Content-Type: application/json' -d '{"prompt":"Test business card for Alice at Example Co","width":512,"height":320}' | jq . || true

echo "\nDone"
