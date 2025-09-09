# CardGEN — Windows quick start (PowerShell)

Use these commands to run the Python ML service and the Node backend.

## Environment files (.env)

**Backend** (`backend/.env`):
```env
# Required: Google Generative AI API key (Gemini)
GEMINI_API_KEY=your_gemini_api_key

# API server port
PORT=5000

# Point to Python ML service (if running)
PY_IMAGE_SERVICE_URL=http://127.0.0.1:8000
```

**ML Service** (`ml/.env`):
```env
# HuggingFace API token (required for image generation)
HF_TOKEN=your_huggingface_token
# or
HUGGINGFACE_API_TOKEN=your_huggingface_token

# Stability.ai API key (optional)
STABILITY_API_KEY=your_stability_key

# Use remote APIs (recommended for Windows)
USE_LOCAL_DIFFUSION=0

# If using local models, set device
LOCAL_DEVICE=cpu
```

Python ML service (FastAPI):

```powershell
# from repo root
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r ml\requirements.txt

uvicorn ml.server:app --host 127.0.0.1 --port 8000
```

Node backend (Express):

```powershell
cd backend
npm install

$env:PY_IMAGE_SERVICE_URL = "http://127.0.0.1:8000"
$env:PORT = "5000"

npm start
# (.venv) PS C:\Users\...\Logo-And-Card-Generator\backend> npm start
```

Health checks (optional):

```powershell
curl http://127.0.0.1:8000/health    # Python ML service
curl http://localhost:5000/api/health # Node backend
```

Frontend (Vite React):

```powershell
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```


