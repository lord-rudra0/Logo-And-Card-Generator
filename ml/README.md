CardGEN ML microservice

Endpoints added by recent work:
- GET /health
- POST /compose-prompt  -> craft text-to-image prompt from structured card fields
- POST /generate/logo    -> HF image generation (with local-diffusers fallback)
- POST /generate/stability -> Stability.ai direct generation (with HF fallback)
- POST /generate/multi   -> run prompt across Stability, HF, local
- POST /generate/with-score -> multi + optional SR + OCR scoring, returns best
- POST /super-resolve    -> SR helper (HF or local Real-ESRGAN)
- POST /score            -> OCR scoring endpoint
- POST /layout/suggest   -> rule-based layout suggestions
- POST /vectorize        -> best-effort raster->SVG tracing (opencv fallback)
- POST /icons/search     -> icon semantic/substring search using frontend list
- POST /refine-style     -> image-to-image refinement (HF or local)

Env variables of interest:
- HUGGINGFACE_API_TOKEN / HF_TOKEN
- HUGGINGFACE_MODEL, HUGGINGFACE_REFINE_MODEL, HF_SR_MODEL
- STABILITY_API_KEY, STABILITY_MODEL
- USE_LOCAL_DIFFUSION (1/true to enable local pipeline)
- POSTPROCESS_SR (1 to enable SR postprocess), POSTPROCESS_SR_MODE ('hf'|'local'|'auto')

Notes:
- Many features are best-effort and require optional Python packages: pillow, httpx, pytesseract, diffusers, torch, realesrgan, opencv-python.
- If optional packages aren't installed, endpoints will return informative errors or fallbacks.
# ML service — CardGEN

Quick notes to run and test the ML FastAPI service used by the backend.

Required env vars (set in `ml/.env` or your shell):
- HUGGINGFACE_API_TOKEN (or HF_TOKEN)
- HUGGINGFACE_MODEL (e.g. `stabilityai/stable-diffusion-xl-base-1.0` or another HF-compatible model)
- STABILITY_API_KEY (optional, used as a fallback)
- STABILITY_MODEL (optional; falls back to HUGGINGFACE_MODEL when unset)

Dimension notes:
- The ML server now rounds/upscales image width/height to the env var `HF_DIM_STEP` (default 64) for HuggingFace calls to avoid model rejections.
- Stability generation uses `STABILITY_DIM_STEP` (default 64) and auto-scales to meet `STABILITY_MIN_PIXELS` (default 262144).
- Recommended card/test dims: 512x320 (landscape) or 1024x640 for a higher-resolution export. For print, export at 300 DPI (3.5"x2" -> 1050x600 px).

Smoke tests:
- `./test_smoke.sh` — runs `/health`, `/generate/stability`, and `/generate/card` with 512x320 dims and prints JSON responses.

If tests fail:
- Ensure the ML server is running and `BASE_URL` points to it.
- Verify tokens and model names are correct and that your account has access.
- Increase timeouts or check server logs for provider-specific errors.
