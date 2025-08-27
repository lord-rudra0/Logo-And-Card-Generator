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
