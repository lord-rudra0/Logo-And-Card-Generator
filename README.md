# CardGEN

Monorepo scaffold for AI Business Card & Logo Creator.

- `frontend/` – React + Vite UI (optional in this repo)
- `backend/` – Node.js + Express API

This README includes the backend environment variable structure so you can configure the API quickly.


## Backend setup
1) Install dependencies
```bash
cd backend
npm install
```

2) Create `.env`
See the structure below. Create a file at `backend/.env` and fill your values:

```env
# Required: Google Generative AI API key (Gemini)
GEMINI_API_KEY=your_gemini_api_key

# API server port
PORT=5000

# Default Gemini image-capable model name (adjust as needed)
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image-preview

# If you run a separate Python image service, point to it here
# For local, you can keep it at the backend if not used externally
PY_IMAGE_SERVICE_URL=http://localhost:5000

# Optional: GCP project metadata (if your workflow integrates with GCP)
PROJECT_ID=your-gcp-project-id
LOCATION=us-central1
```

3) Run the server
```bash
npm run dev
```
Server listens on `http://localhost:${PORT}`.

## ML service (python) — venv and env loading

This repo includes a small FastAPI ML microservice under `ml/` used for image generation and helpers. The recommended way to run it is inside a Python virtual environment and load `ml/.env` for environment variables.

1) Create and activate a venv (Linux/macOS):
```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r ml/requirements.txt
```

2) Create or verify `ml/.env` has the tokens and flags you need. Example important vars:
- `HUGGINGFACE_API_TOKEN` or `HF_TOKEN` — required for HuggingFace inference API
- `STABILITY_API_KEY` — optional Stability.ai key
- `USE_LOCAL_DIFFUSION` — set to `1` to enable local diffusers models, `0` (default) to use remote APIs
- `LOCAL_DEVICE` — if using local models, set `cpu` or `cuda` (if you have GPU)

3) Load environment from `ml/.env` and run the service (Linux/macOS):
```bash
# from repo root
source ml/.env && uvicorn ml.server:app --host 127.0.0.1 --port 8001
```

Platform-specific run commands

- Windows (no GPU) — recommended: keep `USE_LOCAL_DIFFUSION=0` to use remote APIs. Use PowerShell to set env and run:
```powershell
# create venv and install (one-time)
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r ml/requirements.txt

# ensure ml/.env contains HUGGINGFACE_API_TOKEN or STABILITY_API_KEY and USE_LOCAL_DIFFUSION=0
# run server
set -p HUGGINGFACE_API_TOKEN=$env:HUGGINGFACE_API_TOKEN
# or load ml/.env manually, then:
uvicorn ml.server:app --host 127.0.0.1 --port 8001
```

- Windows (with GPU) — install CUDA-enabled PyTorch and enable local diffusers. Example steps (adjust CUDA version):
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
# Install CUDA-enabled PyTorch following https://pytorch.org instructions for your CUDA
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install -r ml/requirements.txt
# set ml/.env: USE_LOCAL_DIFFUSION=1 and LOCAL_DEVICE=cuda
uvicorn ml.server:app --host 127.0.0.1 --port 8001
```

- Linux (no GPU) — remote APIs (recommended):
```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r ml/requirements.txt
# ensure ml/.env has HUGGINGFACE_API_TOKEN and USE_LOCAL_DIFFUSION=0
source ml/.env && uvicorn ml.server:app --host 127.0.0.1 --port 8001
```

- Linux (with GPU) — install CUDA PyTorch and run local models:
```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
# follow https://pytorch.org to pick the correct CUDA wheel, e.g.:
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install -r ml/requirements.txt
# set ml/.env: USE_LOCAL_DIFFUSION=1 and LOCAL_DEVICE=cuda
source ml/.env && uvicorn ml.server:app --host 127.0.0.1 --port 8001
```

Notes and caveats
- If you keep `USE_LOCAL_DIFFUSION=0` you do not need an NVIDIA GPU and you do not need to modify code. The service will call hosted HF/Stability APIs.
- If you enable `USE_LOCAL_DIFFUSION=1` and set `LOCAL_DEVICE=cpu`, the code in `ml/server.py` currently loads pipelines with `torch_dtype=torch.float16` and `variant='fp16'`. Running fp16 on CPU will fail — you must change the loader to use float32 on CPU. Local CPU inference for large models can be extremely slow and memory-intensive.
- For OCR endpoints install Tesseract binary (Windows: Chocolatey `choco install tesseract`, Linux: `apt install tesseract-ocr`).

## How to use

Quick start (backend)

1. Open a terminal and set up environment variables (example):

```bash
cd backend
# copy or create .env following the example in this README
cp .env.example .env || true
# edit backend/.env and set GEMINI_API_KEY and PY_IMAGE_SERVICE_URL if needed
npm install
npm run dev
```

The backend typically listens on the port declared in `backend/.env` (default 5000). API root: `http://localhost:5000/api`.

Quick start (frontend)

1. In a separate terminal, start the frontend (if present):

```bash
cd frontend
npm install
npm run dev
```

By default Vite serves at `http://localhost:5173`. Configure a proxy in `frontend/vite.config.js` to forward `/api` to your backend during development.

Example API calls

- Health check:

```bash
curl http://localhost:5000/api/health
```

- Generate a text-to-image POST (example):

```bash
curl -sS -X POST http://localhost:5000/api/text-to-image \
	-H 'Content-Type: application/json' \
	-d '{"prompt":"Photoreal business card mockup for Alice at Example Co, clean, neutral background","width":512,"height":320}' | jq .
```

- Generate a logo (server-side helper will ensure logo-negative prompt is applied):

```bash
curl -sS -X POST http://localhost:5000/api/ml/generate-logo \
	-H 'Content-Type: application/json' \
	-d '{"companyName":"Example Co","style":"modern","count":1}' | jq .
```

Notes on negative prompts and enforcement

The backend appends safe negative prompts automatically when proxying requests to the Python ML service. Logos and card/stability flows have different negative defaults to help produce vector-like logos and clean, print-ready card mockups respectively. If you provide a `negative_prompt` in the API request, the server will append the default negatives rather than overwrite them.

Auto-attach generated logo

When you generate a logo via `/api/ml/generate-logo`, the backend caches the first returned image URL for the incoming request (short-lived, per-process). When you subsequently call `/api/generate-card-image` with `useLastLogo: true` in the JSON body, the server will attempt to attach that cached logo URL into the card request (field `logoUrl`) and clear the cached entry. This makes a quick generate-logo -> generate-card flow seamless in the UI. Note: this is an in-memory, ephemeral store intended for simple UX flows; for multi-user persistence, consider a persistent cache like Redis.


## Frontend (if added)
If you add a `frontend/` folder, typical Vite usage:
```bash
cd frontend
npm install
npm run dev
```
Configure a dev proxy in `frontend/vite.config.js` to forward `/api` to your backend (e.g., `http://localhost:5000`).


## Scripts
Backend (`backend/package.json`):
- `npm run dev` – start with nodemon
- `npm start` – start with node


## Notes
- Never commit real secrets. Add `.env`, `.env.local` to `.gitignore`.
- If you encounter `ENOENT: uv_cwd` in npm, reopen a terminal and run commands from the correct folder.
- Make sure your `GEMINI_API_KEY` is valid to use AI endpoints.
