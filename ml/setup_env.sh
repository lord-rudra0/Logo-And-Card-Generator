#!/usr/bin/env bash
set -euo pipefail

# Create a Python virtual environment and install minimal dependencies for the ML server.
# Usage:
#   cd ml
#   ./setup_env.sh    # installs minimal deps (fastapi, uvicorn, pillow, httpx, pytesseract, numpy, opencv)
#   INSTALL_DIFFUSERS=1 ./setup_env.sh   # also installs torch + diffusers + transformers (may be large)

PYTHON=${PYTHON:-python3}
VENV_DIR=".venv"

if [ ! -x "$(command -v $PYTHON)" ]; then
  echo "ERROR: $PYTHON not found. Install Python 3 or set PYTHON env var to the python executable." >&2
  exit 2
fi

if [ ! -d "$VENV_DIR" ]; then
  echo "Creating virtualenv in $VENV_DIR..."
  $PYTHON -m venv "$VENV_DIR"
fi

echo "Activating virtualenv..."
# shellcheck source=/dev/null
source "$VENV_DIR/bin/activate"

echo "Upgrading pip and installing minimal packages..."
python -m pip install --upgrade pip
python -m pip install fastapi "uvicorn[standard]" pillow httpx pytesseract numpy opencv-python-headless || {
  echo "Failed to install some packages. Try running the script again or inspect pip output." >&2
}

if [ "${INSTALL_DIFFUSERS:-0}" != "0" ]; then
  echo "Installing heavy ML runtime (torch + diffusers + transformers). This may take a long time and large disk space..."
  python -m pip install --upgrade pip
  # CPU-only torch wheel (adjust if you have CUDA and want GPU)
  python -m pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision torchaudio || echo "torch install failed; see https://pytorch.org"
  python -m pip install diffusers transformers accelerate
fi

echo
echo "Done. To activate the venv:"
echo "  source $VENV_DIR/bin/activate"
echo "Then run the server with:"
echo "  uvicorn server:app --reload --host 127.0.0.1 --port 8000"
