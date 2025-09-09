# CardGEN — Windows quick start (PowerShell)

Use these commands to run the Python ML service and the Node backend.

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


