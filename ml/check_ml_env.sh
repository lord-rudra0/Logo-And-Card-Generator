#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV="$ROOT_DIR/.venv"

echo "ML environment diagnostic"
echo "-------------------------"

echo "1) Python & venv"
if command -v python3 >/dev/null 2>&1; then
  PY=$(python3 -c 'import sys; print(sys.executable)') || PY=python3
  echo " python: $PY"
else
  echo " python3 not found"
fi

if [ -d "$VENV" ]; then
  echo " venv: found at $VENV"
  echo " packages (top 20):"
  "$VENV/bin/python" -m pip list --format=columns | sed -n '1,20p' || true
else
  echo " venv: not found (run ./setup_env.sh to create one)"
fi

echo
echo "2) diffusers/torch availability"
if [ -d "$VENV" ]; then
  if "$VENV/bin/python" - <<PY >/dev/null 2>&1
try:
    import diffusers, torch
    print('ok')
except Exception as e:
    raise SystemExit(2)
PY
  then
    echo " diffusers+torch: available"
  else
    echo " diffusers+torch: NOT available (install with INSTALL_DIFFUSERS=1 ./setup_env.sh)"
  fi
else
  echo " diffusers+torch: venv not present"
fi

echo
echo "3) Hugging Face token and model metadata check"
HF_TOKEN=${HUGGINGFACE_API_TOKEN:-${HF_TOKEN:-}}
HF_MODEL=${HUGGINGFACE_MODEL:-runwayml/stable-diffusion-v1-5}
HF_REFINE=${HUGGINGFACE_REFINE_MODEL:-}
if [ -z "$HF_TOKEN" ]; then
  echo " HF token: NOT set in environment (HUGGINGFACE_API_TOKEN or HF_TOKEN)"
else
  echo " HF token: present"
  echo -n " Checking metadata for model $HF_MODEL... "
  python3 - <<PY || true
import os, sys, requests
tok = os.environ.get('HUGGINGFACE_API_TOKEN') or os.environ.get('HF_TOKEN')
model = '$HF_MODEL'
if not tok:
    print('no-token')
    sys.exit(0)
url = f'https://api-inference.huggingface.co/models/{model}'
h = {'Authorization': f'Bearer {tok}'}
try:
    r = requests.head(url, headers=h, timeout=10)
    print(r.status_code, r.reason)
except Exception as e:
    print('error', str(e))
PY
fi

echo
echo "4) Stability key"
if [ -n "${STABILITY_API_KEY:-}" ]; then
  echo " STABILITY_API_KEY: present"
else
  echo " STABILITY_API_KEY: NOT set"
fi

echo
echo "5) Quick local server health"
if curl -sS --fail http://127.0.0.1:8000/health >/dev/null 2>&1; then
  curl -sS http://127.0.0.1:8000/health | jq . || true
else
  echo " ML server not responding at http://127.0.0.1:8000/health"
fi

echo
echo "Diagnostic complete."
