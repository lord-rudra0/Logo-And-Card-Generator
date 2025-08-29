# CardGEN Complete Setup Guide

This guide covers the complete setup process from scratch, including model downloads and all commands used.

## Prerequisites
- Node.js 18+ and npm
- Python 3.10+
- Git

## 1. Initial Setup

### Clone/Download Repository
```bash
# If cloning from git
git clone <repository-url>
cd CardGEN

# Or if downloaded as zip
cd /path/to/CardGEN
```

## 2. ML Service Setup (Python FastAPI)

### Create Virtual Environment
```bash
cd ml
python3 -m venv .venv
source .venv/bin/activate  # On Linux/Mac
# .venv\Scripts\activate   # On Windows
```

### Install Dependencies
```bash
pip install -r requirements.txt
```

### Download Stable Diffusion Models for Local Generation

#### Option 1: Automatic Download (Recommended)
Models download automatically on first use. Just set the backend:
```bash
export GEN_BACKEND=local
```

#### Option 2: Manual Pre-download
To download models beforehand, uncomment the heavy dependencies in `ml/requirements.txt`:
```bash
# Edit ml/requirements.txt - uncomment these lines:
torch==2.3.1
torchvision==0.18.1
diffusers==0.30.0
transformers==4.43.3
safetensors==0.4.3
open-clip-torch==2.24.0

# Install the ML dependencies
pip install -r requirements.txt
```

#### Option 3: Download via Python Script
Create a download script `ml/download_models.py`:
```python
from diffusers import StableDiffusionPipeline
import torch

# Download Stable Diffusion 1.5
pipe = StableDiffusionPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5",
    torch_dtype=torch.float16,
    cache_dir="./models/hf_cache"
)
print("Models downloaded to ml/models/hf_cache/")
```

Run the download:
```bash
cd ml
python download_models.py
```

Models will be cached in `ml/models/hf_cache/hub/models--runwayml--stable-diffusion-v1-5/`

### Start ML Service
```bash
# From repo root (important for imports)
cd /home/rudra_thakur/Downloads/CardGEN
ml/.venv/bin/python -m uvicorn ml.server:app --reload --port 8000
```

### Verify ML Service
```bash
curl http://127.0.0.1:8000/openapi.json
# Or open http://127.0.0.1:8000/docs in browser
```

## 3. Backend API Setup (Node.js Express)

### Install Dependencies
```bash
cd backend
npm install
```

### Create Environment File
Create `backend/.env`:
```env
# Required: Google Generative AI API key (Gemini)
GEMINI_API_KEY=your_gemini_api_key_here

# API server port
PORT=5000

# Default Gemini image-capable model name
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image-preview

# Python ML service URL
PY_IMAGE_SERVICE_URL=http://localhost:8000

# Optional: GCP project metadata
PROJECT_ID=your-gcp-project-id
LOCATION=us-central1
```

### Start Backend
```bash
npm run dev
# Server runs on http://localhost:5000
```

### Verify Backend
```bash
curl http://localhost:5000/api/health
```

## 4. Frontend Setup (React + Vite)

### Install Dependencies
```bash
cd frontend
npm install
```

### Configure Proxy (if needed)
Ensure `frontend/vite.config.js` proxies `/api` to backend:
```js
export default {
  server: {
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
}
```

### Start Frontend
```bash
npm run dev
# Usually runs on http://localhost:5173
```

## 5. Git Setup and Model Cache

### Update .gitignore
The repository includes proper `.gitignore` patterns for:
- Node modules (`**/node_modules/`)
- Python virtual environments (`**/.venv/`)
- ML model cache (`ml/models/`, `**/hf_cache/`)
- Environment files (`.env`, `.env.*`)

### Git Commands
```bash
# Add all files (models are ignored)
git add -A -- .

# Commit changes
git commit -m "Initial setup with ML models"

# Push if needed
git push origin main
```

## 6. Running All Services Step by Step

### Step 1: Start ML Service (Terminal 1)
```bash
# Navigate to project root
cd /home/rudra_thakur/Downloads/CardGEN

# Activate virtual environment (if not already active)
source ml/.venv/bin/activate

# Set backend type (optional - defaults to placeholder)
export GEN_BACKEND=local  # or 'hosted' or 'placeholder'

# Start ML service
ml/.venv/bin/python -m uvicorn ml.server:app --reload --port 8000

# You should see:
# INFO: Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

### Step 2: Start Backend API (Terminal 2)
```bash
# Navigate to backend directory
cd /home/rudra_thakur/Downloads/CardGEN/backend

# Make sure .env file exists with GEMINI_API_KEY
ls -la .env

# Install dependencies (if not done already)
npm install

# Start backend server
npm run dev

# You should see:
# 🚀 Server running on port 5000
# 📡 API available at http://localhost:5000/api
```

### Step 3: Start Frontend (Terminal 3)
```bash
# Navigate to frontend directory
cd /home/rudra_thakur/Downloads/CardGEN/frontend

# Install dependencies (if not done already)
npm install

# Start frontend development server
npm run dev

# You should see:
# ➜  Local:   http://localhost:5173/
# ➜  Network: use --host to expose
```

### Step 4: Verify All Services Are Running
```bash
# Test ML service (Terminal 4 or new terminal)
curl http://127.0.0.1:8000/docs
# Should return HTML for FastAPI docs

# Test backend API
curl http://localhost:5000/api/health
# Should return: {"status":"OK","message":"AI Card Creator API is running!"}

# Test frontend
# Open browser to http://localhost:5173
# Should show the CardGEN interface
```

## 7. Verification

### Check All Services
```bash
# ML Service
curl http://127.0.0.1:8000/docs

# Backend API
curl http://localhost:5000/api/health

# Frontend
# Open http://localhost:5173 in browser
```

### Test Logo Generation
```bash
curl -s http://127.0.0.1:8000/generate/logo \
  -H 'Content-Type: application/json' \
  -d '{"description":"modern blue tech logo", "count":2, "width":256, "height":256}'
```

## 8. Configuration Options

### ML Service Backends
Set environment variables before starting ML service:

#### For Hosted Generation (Replicate)
```bash
export GEN_BACKEND=hosted
export REPLICATE_API_TOKEN=your_token_here
export REPLICATE_VERSION=your_model_version_hash
```

#### For Local Generation
```bash
export GEN_BACKEND=local
# Models download automatically to ml/models/hf_cache/
```

#### For Placeholder Only
```bash
export GEN_BACKEND=placeholder
# No external dependencies needed
```

## Troubleshooting

### Common Issues

1. **ModuleNotFoundError: No module named 'ml'**
   - Run uvicorn from repo root, not from `ml/` directory

2. **ModuleNotFoundError: No module named 'httpx'**
   - Install missing dependency: `pip install httpx`

3. **Git index.lock error**
   - Remove lock file: `rm -f .git/index.lock`

4. **Large model files in git**
   - Ensure `.gitignore` includes `ml/models/` and `**/hf_cache/`

5. **Port already in use**
   - Kill existing processes or use different ports

### File Structure
```
CardGEN/
├── backend/           # Node.js Express API
│   ├── routes/
│   ├── package.json
│   └── .env          # Create this file
├── frontend/         # React + Vite UI
│   ├── src/
│   └── package.json
├── ml/              # Python FastAPI ML service
│   ├── .venv/       # Virtual environment
│   ├── models/      # Model cache (gitignored)
│   ├── requirements.txt
│   └── server.py
└── .gitignore       # Ignores models, .env, node_modules
```

## Success Indicators
- ML service responds at http://127.0.0.1:8000/docs
- Backend API responds at http://localhost:5000/api/health
- Frontend loads at http://localhost:5173
- All three services running simultaneously
- Git operations work without trying to add large model files
