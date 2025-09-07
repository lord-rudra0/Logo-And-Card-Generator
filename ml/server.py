from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import math
import os
import base64
import httpx
import httpcore
import asyncio

# Stability.ai fallback configuration (set STABILITY_API_KEY in environment; do NOT hardcode keys)
STABILITY_API_KEY = os.environ.get('STABILITY_API_KEY')
# Prefer an explicit STABILITY_MODEL; if absent, allow using HUGGINGFACE_MODEL
# (useful when HUGGINGFACE_MODEL is set to a Stability model slug like
# 'stabilityai/stable-diffusion-xl-base-1.0'). Fall back to a sensible default.
STABILITY_MODEL = os.environ.get('STABILITY_MODEL') or os.environ.get('HUGGINGFACE_MODEL') or 'stable-diffusion-v1'
HF_FALLBACK_AFTER = float(os.environ.get('HF_FALLBACK_AFTER', 60.0))

# Load environment from ml/.env if present. Attempts to use python-dotenv first,
# and falls back to a simple parser if python-dotenv isn't installed.
try:
    from dotenv import load_dotenv
    from pathlib import Path
    env_path = Path(__file__).resolve().parent / '.env'
    if env_path.exists():
        load_dotenv(dotenv_path=str(env_path))
    else:
        # fallback to any loaded environment
        load_dotenv()
except Exception:
    # Simple fallback: parse key=value lines from ml/.env
    try:
        env_path = os.path.join(os.path.dirname(__file__), '.env')
        if os.path.exists(env_path):
            with open(env_path, 'r') as fh:
                for ln in fh:
                    ln = ln.strip()
                    if not ln or ln.startswith('#'):
                        continue
                    if '=' in ln:
                        k, v = ln.split('=', 1)
                        v = v.strip().strip('"').strip("'")
                        os.environ.setdefault(k.strip(), v)
    except Exception:
        # best-effort; do not crash if dotenv not present
        print('Warning: could not load ml/.env — ensure env vars are set')

# Optional local Diffusers backend
USE_LOCAL_DIFFUSION = os.environ.get('USE_LOCAL_DIFFUSION', '') in ('1', 'true', 'True')
LOCAL_BASE_MODEL = os.environ.get('LOCAL_BASE_MODEL') or 'stabilityai/stable-diffusion-xl-base-1.0'
LOCAL_REFINER_MODEL = os.environ.get('LOCAL_REFINER_MODEL') or 'stabilityai/stable-diffusion-xl-refiner-1.0'

# Cache pipelines to avoid reloading every request
_LOCAL_PIPELINES = {}

def _load_local_pipelines(device='cuda'):
    global _LOCAL_PIPELINES
    if _LOCAL_PIPELINES.get('loaded'):
        return _LOCAL_PIPELINES['base'], _LOCAL_PIPELINES['refiner']

    try:
        # Local imports to keep server lightweight when not used
        from diffusers import DiffusionPipeline
        import torch
    except Exception as e:
        raise RuntimeError('diffusers/torch not available: ' + str(e))

    # load base
    base = DiffusionPipeline.from_pretrained(
        LOCAL_BASE_MODEL,
        torch_dtype=torch.float16,
        variant='fp16',
        use_safetensors=True,
    )
    base = base.to(device)

    # load refiner and reuse components
    refiner = DiffusionPipeline.from_pretrained(
        LOCAL_REFINER_MODEL,
        text_encoder_2=base.text_encoder_2,
        vae=base.vae,
        torch_dtype=torch.float16,
        use_safetensors=True,
        variant='fp16',
    )
    refiner = refiner.to(device)

    _LOCAL_PIPELINES['base'] = base
    _LOCAL_PIPELINES['refiner'] = refiner
    _LOCAL_PIPELINES['loaded'] = True
    return base, refiner

def _generate_local_image_sync(prompt, steps=40, high_noise_frac=0.8, width=512, height=512, device='cuda'):
    # synchronous helper using the provided two-stage pipeline
    from io import BytesIO
    from PIL import Image
    base, refiner = _load_local_pipelines(device=device)

    # run base to latents
    latents = base(
        prompt=prompt,
        num_inference_steps=steps,
        denoising_end=high_noise_frac,
        output_type='latent',
        width=width,
        height=height,
    ).images

    # refine latents into final image
    out = refiner(
        prompt=prompt,
        num_inference_steps=steps,
        denoising_start=high_noise_frac,
        image=latents,
    ).images[0]

    # ensure PIL image and convert to PNG bytes
    buf = BytesIO()
    if not isinstance(out, Image.Image):
        # attempt to convert tensor/array
        out = Image.fromarray(out)
    out.save(buf, format='PNG')
    buf.seek(0)
    return buf.read()

app = FastAPI(title='CardGEN ML PoC Service')


@app.get('/health')
async def health():
    # Lightweight health endpoint used by the Node backend to detect ML availability
    info = {
        'status': 'ok',
        'service': 'cardgen-ml',
        'use_local_diffusion': bool(USE_LOCAL_DIFFUSION),
        'model': os.environ.get('STABILITY_MODEL') or os.environ.get('HUGGINGFACE_MODEL') or ''
    }
    return info


class RecommendRequest(BaseModel):
    industry: Optional[str] = 'technology'
    mood: Optional[str] = 'professional'


class Element(BaseModel):
    id: Optional[str]
    textColor: Optional[str]
    bgColor: Optional[str]
    fontSize: Optional[float]


class AccessibilityRequest(BaseModel):
    elements: List[Element] = []


class OCRRequest(BaseModel):
    imageBase64: str


class GenerateLogoRequest(BaseModel):
    prompt: str
    style: Optional[str] = None
    count: Optional[int] = 1
    width: Optional[int] = 512
    height: Optional[int] = 512
    steps: Optional[int] = 20
    guidance_scale: Optional[float] = 7.5


def pick_palette(industry: str):
    map_ = {
        'technology': ['#3b82f6', '#6366f1', '#06b6d4', '#06b6d4'],
        'healthcare': ['#10b981', '#059669', '#34d399', '#ecfccb'],
        'finance': ['#0ea5e9', '#0284c7', '#7dd3fc', '#e6f6ff'],
        'creative': ['#f43f5e', '#fb7185', '#f59e0b', '#f97316'],
        'real_estate': ['#7c3aed', '#6d28d9', '#a78bfa', '#eef2ff']
    }
    return map_.get(industry, ['#111827', '#374151', '#6b7280', '#9ca3af'])


def pick_fonts(industry: str):
    map_ = {
        'technology': ['Inter', 'Montserrat', 'Roboto'],
        'healthcare': ['Nunito', 'Poppins', 'Inter'],
        'finance': ['Barlow', 'DM Sans', 'Lato'],
        'creative': ['Kanit', 'Playfair Display', 'Poppins'],
        'real_estate': ['Merriweather', 'Lora', 'Nunito']
    }
    return map_.get(industry, ['Inter', 'System UI'])


@app.post('/recommend-style')
async def recommend_style(req: RecommendRequest):
    palette = pick_palette(req.industry)[:4]
    fonts = pick_fonts(req.industry)
    accent = palette[1]
    if req.mood == 'warm':
        accent = '#f59e0b'
    if req.mood == 'cool':
        accent = palette[0]

    return {
        'industry': req.industry,
        'mood': req.mood,
        'palette': {
            'primary': palette[0],
            'secondary': palette[1],
            'accent': accent
        },
        'fonts': {
            'heading': fonts[0],
            'body': fonts[1] if len(fonts) > 1 else fonts[0]
        }
    }


def hex_to_rgb(hexstr: str):
    if not hexstr:
        return (0, 0, 0)
    h = hexstr.lstrip('#')
    if len(h) == 3:
        h = ''.join([c*2 for c in h])
    try:
        return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
    except Exception:
        return (0, 0, 0)


def luminance(rgb):
    srgb = [v/255.0 for v in rgb]
    lin = [c/12.92 if c <= 0.03928 else ((c+0.055)/1.055)**2.4 for c in srgb]
    return 0.2126*lin[0] + 0.7152*lin[1] + 0.0722*lin[2]


def contrast_ratio(a, b):
    la = luminance(hex_to_rgb(a))
    lb = luminance(hex_to_rgb(b))
    brighter = max(la, lb)
    darker = min(la, lb)
    return (brighter + 0.05) / (darker + 0.05)


@app.post('/check-accessibility')
async def check_accessibility(req: AccessibilityRequest):
    results = []
    for el in req.elements:
        ratio = contrast_ratio(el.textColor or '#000000', el.bgColor or '#ffffff')
        passAA = ratio >= 4.5
        passLarge = ratio >= 3.0
        results.append({
            'id': el.id,
            'contrast': round(ratio, 2),
            'passAA': passAA,
            'passLarge': passLarge,
            'recommendation': 'OK' if passAA else 'Increase contrast: use darker text or lighter background',
            'textColor': el.textColor,
            'bgColor': el.bgColor
        })
    return { 'results': results }


@app.post('/ocr')
async def ocr_endpoint(req: OCRRequest):
    # Try pytesseract if available, otherwise return informative message
    try:
        import base64
        from io import BytesIO
        from PIL import Image
        import pytesseract

        header, b64 = (req.imageBase64.split(',', 1) + [''])[:2]
        data = base64.b64decode(b64 or req.imageBase64)
        img = Image.open(BytesIO(data))
        text = pytesseract.image_to_string(img)
        return { 'text': text }
    except Exception as e:
        return { 'error': 'pytesseract not available or failed to run. Install pytesseract and Tesseract OCR binary.', 'details': str(e) }


@app.post('/generate/logo')
async def generate_logo(req: GenerateLogoRequest):
    # If local diffusers is requested and available, prefer it
    if USE_LOCAL_DIFFUSION:
        try:
            # run CPU->GPU-suitable synchronous code in threadpool
            steps = req.steps or 40
            high_noise_frac = float(os.environ.get('LOCAL_HIGH_NOISE_FRAC', 0.8))
            img_bytes = await asyncio.to_thread(_generate_local_image_sync, req.prompt, steps, high_noise_frac, req.width, req.height, os.environ.get('LOCAL_DEVICE','cuda'))
            b64 = base64.b64encode(img_bytes).decode('utf-8')
            data_url = f'data:image/png;base64,{b64}'
            print('Returning image from local diffusers')
            return { 'images': [data_url], 'source': 'local' }
        except Exception as e:
            # If local generation fails, surface informative error and fall back to HF inference path below
            raise HTTPException(status_code=500, detail='Local diffusion failed: ' + str(e))

    hf_token = os.environ.get('HUGGINGFACE_API_TOKEN') or os.environ.get('HF_TOKEN')
    model = os.environ.get('HUGGINGFACE_MODEL') or 'runwayml/stable-diffusion-v1-5'
    if not hf_token:
        raise HTTPException(status_code=400, detail='HUGGINGFACE_API_TOKEN not configured in environment')

    url = f'https://api-inference.huggingface.co/models/{model}'
    headers = {'Authorization': f'Bearer {hf_token}'}

    # Ensure HF-friendly dimensions: round/upscale to HF_DIM_STEP (default 64)
    try:
        hf_step = int(os.environ.get('HF_DIM_STEP', 64))
    except Exception:
        hf_step = 64

    try:
        orig_w = int(req.width or 512)
        orig_h = int(req.height or 512)
    except Exception:
        orig_w, orig_h = 512, 512

    hf_w = int(math.ceil(orig_w / float(hf_step)) * hf_step)
    hf_h = int(math.ceil(orig_h / float(hf_step)) * hf_step)
    if hf_w != orig_w or hf_h != orig_h:
        print(f"Adjusted HF dimensions {orig_w}x{orig_h} -> {hf_w}x{hf_h} using HF_DIM_STEP={hf_step}")

    payload = {
        'inputs': req.prompt,
        'options': { 'wait_for_model': True },
        'parameters': {
            'width': hf_w,
            'height': hf_h,
            'num_inference_steps': req.steps,
            'guidance_scale': req.guidance_scale
        }
    }

    # Resilient HF call with timeout, retries and mapped errors
    # HF_REQUEST_TIMEOUT may be a float (seconds) or a sentinel value to
    # indicate "no timeout" (for example during a long cold-start). We
    # accept values: 'none', 'infinite', '0' (or any <= 0) to disable the
    # total/read timeout. Keep a reasonable connect timeout.
    hf_timeout_raw = os.environ.get('HF_REQUEST_TIMEOUT', '180')
    try:
        raw = str(hf_timeout_raw).strip().lower()
        if raw in ('none', 'infinite', 'null') or raw == '' or float(raw) <= 0:
            hf_total = None
            hf_read = None
        else:
            hf_total = float(raw)
            hf_read = float(raw)
    except Exception:
        # fallback to sensible default
        hf_total = 180.0
        hf_read = 180.0

    max_retries = int(os.environ.get('HF_MAX_RETRIES', 3))
    backoff_base = float(os.environ.get('HF_BACKOFF_BASE', 1.5))

    # Use keyword args so we can pass None to disable read/total timeouts.
    timeout = httpx.Timeout(timeout=hf_total, connect=10.0, read=hf_read, write=30.0)
    last_exc = None
    async with httpx.AsyncClient(timeout=timeout) as client:
        for attempt in range(1, max_retries + 1):
            try:
                print(f"HF attempt {attempt}/{max_retries} for model {model} (prompt len={len(req.prompt or '')})")
                # Respect an initial fallback threshold: if HF takes longer than
                # HF_FALLBACK_AFTER seconds (read timeout), treat as a timeout and
                # attempt the Stability.ai fallback if configured.
                # We'll perform the POST with the same client but rely on the
                # client's configured read timeout.
                r = await client.post(url, headers=headers, json=payload)

                # surface transient HF statuses as retryable (include 504)
                if r.status_code in (429, 502, 503, 504, 524):
                    # capture response text for diagnostics (may be truncated)
                    try:
                        resp_text = r.text[:1000]
                    except Exception:
                        resp_text = '<unavailable>'
                    last_exc = Exception(f'Transient HF status {r.status_code}: {resp_text}')
                    if attempt < max_retries:
                        wait = backoff_base ** attempt
                        print(f"Transient HF status {r.status_code}, retrying in {wait}s; resp_excerpt={resp_text}")
                        await asyncio.sleep(wait)
                        continue
                    raise HTTPException(status_code=502, detail=f'HuggingFace transient error: {r.status_code}')

                if r.status_code != 200:
                    try:
                        data = r.json()
                        raise HTTPException(status_code=502, detail=str(data))
                    except Exception:
                        raise HTTPException(status_code=502, detail=f'HF inference error: {r.status_code}')

                content_type = r.headers.get('content-type', '')
                if content_type.startswith('application/json'):
                    data = r.json()
                    if isinstance(data, dict) and 'error' in data:
                        raise HTTPException(status_code=502, detail=data['error'])
                    # Best-effort: log and mark source for JSON responses
                    print('Returning JSON response from Hugging Face (application/json)')
                    if isinstance(data, dict):
                        data.setdefault('source', 'huggingface')
                    return data

                img_bytes = r.content
                b64 = base64.b64encode(img_bytes).decode('utf-8')
                data_url = f'data:image/png;base64,{b64}'
                print('Returning image from Hugging Face')
                return { 'images': [data_url], 'source': 'huggingface' }


    # end of HF-based generate_logo
            except (httpx.ReadTimeout, httpcore.ReadTimeout) as e:
                last_exc = e
                print(f"HF read timeout on attempt {attempt}: {e}")
                # If a Stability.ai API key is available, try fallback generation.
                if STABILITY_API_KEY:
                    try:
                        print("Attempting Stability.ai fallback...")
                        # call stability fallback with reasonable internal timeout
                        async def _stability_call():
                            s_url = f'https://api.stability.ai/v1/generation/{STABILITY_MODEL}/text-to-image'
                            s_headers = {
                                'Authorization': f'Bearer {STABILITY_API_KEY}',
                                'Content-Type': 'application/json'
                            }
                            s_payload = {
                                'text_prompts': [{ 'text': req.prompt }],
                                'width': req.width or 512,
                                'height': req.height or 512,
                                'steps': req.steps or 20,
                                'samples': 1,
                                'cfg_scale': req.guidance_scale or 7.5
                            }
                            # give Stability a generous timeout
                            async with httpx.AsyncClient(timeout=httpx.Timeout(600.0, connect=10.0)) as sclient:
                                sr = await sclient.post(s_url, headers=s_headers, json=s_payload)
                                if sr.status_code not in (200, 201):
                                    raise Exception(f'Stability API error: {sr.status_code} {sr.text[:500]}')
                                data = sr.json()
                                # extract base64 artifact (defensive)
                                b64 = None
                                if isinstance(data, dict):
                                    arts = data.get('artifacts') or data.get('artifacts', [])
                                    if arts and isinstance(arts, list):
                                        art0 = arts[0]
                                        b64 = art0.get('base64') or art0.get('b64') or art0.get('b64_data')
                                if not b64:
                                    # try common alternative key
                                    try:
                                        # some responses encode base64 in nested fields
                                        b64 = data['artifacts'][0]['base64']
                                    except Exception:
                                        raise Exception('Unexpected Stability response payload: ' + str(data)[:500])
                                data_url = f'data:image/png;base64,{b64}'
                                return { 'images': [data_url] }

                        stability_result = await _stability_call()
                        return stability_result
                    except Exception as se:
                        print(f"Stability fallback failed: {se}")
                        last_exc = se
                        # fall through to retry logic / final failure
                if attempt < max_retries:
                    wait = backoff_base ** attempt
                    await asyncio.sleep(wait)
                    continue
                raise HTTPException(status_code=504, detail=f'HuggingFace request timed out after {max_retries} attempts; last_err={str(last_exc)[:300]}')
            except httpx.HTTPError as e:
                last_exc = e
                print(f"HF HTTPError: {e}")
                raise HTTPException(status_code=502, detail=f'Error contacting HuggingFace inference API: {str(e)}')

        # exhausted retries
        raise HTTPException(status_code=502, detail=f'HuggingFace inference failed: {str(last_exc)}')


@app.post('/generate/card')
async def generate_card(req: GenerateLogoRequest):
    """Compatibility endpoint: generate a full business-card raster image using the
    same HF inference code as `/generate/logo`. We keep a separate route so the
    backend can clearly request "card" images (not logos).
    """
    # Reuse the existing generate_logo handler to avoid duplicating HF logic.
    result = await generate_logo(req)
    # Normalize the source name for clarity
    if isinstance(result, dict):
        result.setdefault('source', 'hf_card')
    return result


# New endpoint: direct Stability Platform generation using platform API key from ml/.env
try:
    from .stability_client import generate_stability_image
except Exception:
    # relative import fallback for direct execution
    try:
        from stability_client import generate_stability_image
    except Exception:
        generate_stability_image = None


class StabilityRequest(BaseModel):
    prompt: str
    width: Optional[int] = 512
    height: Optional[int] = 512
    steps: Optional[int] = 20
    cfg_scale: Optional[float] = 7.5
    samples: Optional[int] = 1


@app.post('/generate/stability')
async def generate_stability(req: StabilityRequest):
    if not generate_stability_image:
        raise HTTPException(status_code=501, detail='Stability client not available on this server')
    try:
        # Enforce Stability minimum pixel count (e.g. 512x512 = 262144 px). If
        # the client requests a smaller resolution, scale up proportionally to
        # meet the minimum while preserving aspect ratio. Round dimensions to
        # the model-required granularity (default 64 for newer Stability models).
        min_pixels = int(os.environ.get('STABILITY_MIN_PIXELS', 262144))
        req_w = int(req.width or 512)
        req_h = int(req.height or 512)
        cur_pixels = req_w * req_h
        out_w, out_h = req_w, req_h
        if cur_pixels < min_pixels:
            scale = (min_pixels / float(cur_pixels)) ** 0.5
            # Use granularity step (most Stability models require dims in
            # increments of 64; make it configurable via STABILITY_DIM_STEP).
            step = int(os.environ.get('STABILITY_DIM_STEP', 64))
            out_w = int(math.ceil((req_w * scale) / float(step)) * step)
            out_h = int(math.ceil((req_h * scale) / float(step)) * step)
            print(f"Scaling Stability request {req_w}x{req_h} -> {out_w}x{out_h} to meet min pixels={min_pixels}")

        images = await generate_stability_image(
            prompt=req.prompt,
            width=out_w,
            height=out_h,
            steps=req.steps or 20,
            cfg_scale=req.cfg_scale or 7.5,
            samples=req.samples or 1,
        )
        return { 'images': images, 'source': 'stability', 'width': out_w, 'height': out_h }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f'Stability generation failed: {str(e)}')
