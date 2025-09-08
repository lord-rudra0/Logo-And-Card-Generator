#!/usr/bin/env bash
set -euo pipefail
BASE_URL=${BASE_URL:-http://localhost:8000}

echo "Health check: $BASE_URL/health"
curl -sS ${BASE_URL}/health | jq . || true

echo "\nStability quick test (512x320):"
curl -sS -X POST ${BASE_URL}/generate/stability -H 'Content-Type: application/json' -d '{"prompt":"Test business card graphic","width":512,"height":320}' | jq . || true

echo "\nHF/card test (512x320):"
curl -sS -X POST ${BASE_URL}/generate/card -H 'Content-Type: application/json' -d '{"prompt":"Test business card for Alice at Example Co","width":512,"height":320}' | jq . || true

echo "\nCompose prompt test:"
curl -sS -X POST ${BASE_URL}/compose-prompt -H 'Content-Type: application/json' -d '{"name":"Alice Smith","title":"Product Designer","company":"Example Co","industry":"technology","mood":"professional","keywords":["minimal","flat","logo"]}' | jq . || true

echo "\nMulti generate test:"
curl -sS -X POST ${BASE_URL}/generate/multi -H 'Content-Type: application/json' -d '{"prompt":"Test business card for Alice Smith, clean minimalist, centered logo","width":512,"height":320,"steps":20}' | jq . || true

echo "\nGenerate with-score test:"
curl -sS -X POST ${BASE_URL}/generate/with-score -H 'Content-Type: application/json' -d '{"prompt":"Test business card for Alice Smith, clean minimalist, centered logo","width":512,"height":320,"steps":20}' | jq . || true

echo "\nLayout suggestion test:"
curl -sS -X POST ${BASE_URL}/layout/suggest -H 'Content-Type: application/json' -d '{"width":1050,"height":600,"name":"Alice Smith","title":"Product Designer","company":"Example Co","logo_preference":"left"}' | jq . || true

echo "\nIcons search test:"
curl -sS -X POST ${BASE_URL}/icons/search -H 'Content-Type: application/json' -d '{"q":"phone","top_k":5}' | jq . || true

echo "\nSmoke tests complete. Note: some endpoints require HF/STABILITY tokens or optional packages."
