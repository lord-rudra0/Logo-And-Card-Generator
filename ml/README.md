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
