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

## 2. ML Service (removed)

The local Python-based ML service (Stable Diffusion / FastAPI) has been removed from this repository. ML-related features such as local text-to-image and hosted model proxies are disabled. The codebase now contains lightweight, non-ML fallbacks so the frontend and backend continue to function without heavy ML dependencies.

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

### Step 1: (ML removed)
The ML service step has been removed. Proceed to start the backend and frontend as described below.

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

### Step 4: Verify Backend & Frontend
```bash
# Test backend API
curl http://localhost:5000/api/health

# Test frontend
# Open browser to http://localhost:5173
# Should show the CardGEN interface
```

## 7. Verification

### Check Backend and Frontend
```bash
# Backend API
curl http://localhost:5000/api/health

# Frontend
# Open http://localhost:5173 in browser
```

### Test Logo Generation (fallback)
Logo generation via the previous ML service is no longer available. The backend provides non-ML placeholder/logo helpers; use the web UI or API endpoints under `/api/logos` and `/api/cards` for design features.

## 8. Configuration Options

*ML configuration options were removed with the ML service.*

## Troubleshooting

### Common Issues

1. **ModuleNotFoundError: No module named 'ml'**
   - The ML service has been removed; references to `ml/` are no longer valid.

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
```
└── .gitignore       # Ignores models, .env, node_modules
```

## Success Indicators
- ML service responds at http://127.0.0.1:8000/docs
- Backend API responds at http://localhost:5000/api/health
- Frontend loads at http://localhost:5173
- All three services running simultaneously
- Git operations work without trying to add large model files
