#!/usr/bin/env bash
set -euo pipefail

# Simple smoke test for /generate/refine-loop using a small generated PNG
# Usage: ./ml/test_refine_loop_init.sh

HOST=${ML_HOST:-http://localhost:8000}
ENDPOINT="$HOST/generate/refine-loop"

echo "Preparing init image (256x64 with the word 'TEST')..."
INIT_DATA=$(python3 - <<'PY'
from io import BytesIO
import base64
try:
    from PIL import Image, ImageDraw
except Exception:
    print('ERROR:Pillow missing - install with pip install pillow')
    raise SystemExit(2)
img = Image.new('RGBA', (256,64), (255,255,255,255))
d = ImageDraw.Draw(img)
d.text((10,10), 'TEST', fill=(0,0,0,255))
buf = BytesIO()
img.save(buf, format='PNG')
print('data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode('ascii'))
PY
)

if [[ "$INIT_DATA" == ERROR:* ]]; then
  echo "$INIT_DATA"
  exit 2
fi

# Build payload
read -r -d '' PAYLOAD <<JSON || true
{
  "prompt": "business card, minimal, clear legible text, centered logo",
  "width": 512,
  "height": 128,
  "steps": 20,
  "guidance_scale": 7.5,
  "target_ocr_score": 5,
  "max_iters": 2,
  "init_imageBase64": "$INIT_DATA"
}
JSON

echo "Posting to $ENDPOINT"
curl -s -X POST "$ENDPOINT" -H 'Content-Type: application/json' -d "$PAYLOAD" | jq . || curl -s -X POST "$ENDPOINT" -H 'Content-Type: application/json' -d "$PAYLOAD"
#!/usr/bin/env bash
set -euo pipefail
OUT=/tmp/refine_loop_response.json
INIT_JSON=/tmp/init_img.json

python3 - <<'PY' > ${INIT_JSON}
from PIL import Image, ImageDraw
from io import BytesIO
import base64, json
img = Image.new('RGBA', (128,64), (255,255,255,255))
d = ImageDraw.Draw(img)
d.text((16,16),'HI',(0,0,0))
buf = BytesIO()
img.save(buf,'PNG')
b64 = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
payload = {
  'prompt': 'A business-card style image with large legible text HI',
  'init_imageBase64': b64,
  'width': 512, 'height': 256,
  'steps': 20, 'guidance_scale': 7.5,
  'target_ocr_score': 20, 'max_iters': 2
}
print(json.dumps(payload))
PY

curl -s -X POST 'http://127.0.0.1:8000/generate/refine-loop' \
  -H 'Content-Type: application/json' \
  --data-binary @${INIT_JSON} -o ${OUT} -w "\nHTTP_STATUS:%{http_code}\n"

if command -v jq >/dev/null 2>&1; then
  jq . ${OUT} || sed -n '1,200p' ${OUT}
else
  sed -n '1,200p' ${OUT}
fi
