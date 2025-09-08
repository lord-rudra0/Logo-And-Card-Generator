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


echo "\nRefine-loop test (using generated init image):"
# generate a small white PNG data URL for local testing (requires python3 and pillow)
INIT_IMG=$(python3 - <<'PY'
try:
		from PIL import Image
		import io, base64
		img = Image.new('RGB', (512,320), (255,255,255))
		buf = io.BytesIO()
		img.save(buf, format='PNG')
		print('data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode('utf-8'))
except Exception as e:
		# fallback: empty string
		print('')
PY
)

export INIT_IMG

if [ -z "$INIT_IMG" ]; then
	echo "Could not generate init image (python3/pillow missing); skipping refine-loop init test"
else
			# build the JSON payload using INIT_IMG from the environment and post it
			python3 - <<'PY' | curl -sS -X POST "${BASE_URL}/generate/refine-loop" -H 'Content-Type: application/json' --data-binary @- | jq . || true
import os, json
payload = {
	'prompt': 'Test business card for Alice Smith, crisp text',
	'width': 512,
	'height': 320,
	'steps': 20,
	'target_ocr_score': 1,
	'max_iters': 1,
	'init_imageBase64': os.environ.get('INIT_IMG', '')
}
print(json.dumps(payload))
PY
fi


echo "\nLayout suggestion test:"
curl -sS -X POST ${BASE_URL}/layout/suggest -H 'Content-Type: application/json' -d '{"width":1050,"height":600,"name":"Alice Smith","title":"Product Designer","company":"Example Co","logo_preference":"left"}' | jq . || true

echo "\nIcons search test:"
curl -sS -X POST ${BASE_URL}/icons/search -H 'Content-Type: application/json' -d '{"q":"phone","top_k":5}' | jq . || true

echo "\nSmoke tests complete. Note: some endpoints require HF/STABILITY tokens or optional packages."
