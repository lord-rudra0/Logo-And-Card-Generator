from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import math
import os
import base64
import json
import httpx
import httpcore
import asyncio
from io import BytesIO
try:
    from PIL import Image, ImageFilter, ImageOps
    PIL_AVAILABLE = True
except Exception:
    PIL_AVAILABLE = False
try:
    from .sr import super_resolve, ocr_text_from_bytes, _decode_data_url
except Exception:
    try:
        from sr import super_resolve, ocr_text_from_bytes, _decode_data_url
    except Exception:
        super_resolve = None
        ocr_text_from_bytes = None
        _decode_data_url = None

# Attempt to import inpaint helpers regardless of whether sr imported successfully.
try:
    from .inpaint import detect_text_bboxes, make_mask_from_boxes, expand_boxes_by_ratio
except Exception:
    try:
        from inpaint import detect_text_bboxes, make_mask_from_boxes, expand_boxes_by_ratio
    except Exception:
        detect_text_bboxes = None
        make_mask_from_boxes = None
        expand_boxes_by_ratio = None

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


def _postprocess_image_bytes(
    img_bytes: bytes,
    enabled: Optional[bool] = None,
    upscale: Optional[float] = None,
    unsharp_radius: Optional[float] = None,
    unsharp_percent: Optional[float] = None,
    unsharp_threshold: Optional[int] = None,
    autocontrast: Optional[bool] = None,
) -> bytes:
    """Lightweight post-processing to improve legibility of small card text.
    Parameters are per-call and if left None, fall back to environment defaults.
    Returns PNG bytes.
    """
    # resolve enabled flag
    if enabled is None:
        enabled_raw = os.environ.get('POSTPROCESS_ENABLED', '1')
        enabled = not (str(enabled_raw).lower() in ('0', 'false', 'no'))
    if not enabled:
        return img_bytes
    if not PIL_AVAILABLE:
        print('Pillow not available; skipping post-processing')
        return img_bytes

    try:
        # resolve numeric params with env fallbacks
        try:
            if upscale is None:
                upscale = float(os.environ.get('POSTPROCESS_UPSCALE', 1.5))
        except Exception:
            upscale = 1.5
        try:
            if unsharp_radius is None:
                unsharp_radius = float(os.environ.get('POSTPROCESS_UNSHARP_RADIUS', 1.0))
        except Exception:
            unsharp_radius = 1.0
        try:
            if unsharp_percent is None:
                unsharp_percent = float(os.environ.get('POSTPROCESS_UNSHARP_PERCENT', 150.0))
        except Exception:
            unsharp_percent = 150.0
        try:
            if unsharp_threshold is None:
                unsharp_threshold = int(os.environ.get('POSTPROCESS_UNSHARP_THRESHOLD', 3))
        except Exception:
            unsharp_threshold = 3
        if autocontrast is None:
            ac_raw = os.environ.get('POSTPROCESS_AUTOCONTRAST', '1')
            autocontrast = not (str(ac_raw).lower() in ('0', 'false', 'no'))

        buf = BytesIO(img_bytes)
        img = Image.open(buf).convert('RGBA')

        # upscale preserving aspect ratio
        if upscale and float(upscale) > 1.01:
            new_w = int(img.width * float(upscale))
            new_h = int(img.height * float(upscale))
            img = img.resize((new_w, new_h), resample=Image.LANCZOS)

        # apply unsharp mask to emphasize text edges
        try:
            img = img.filter(ImageFilter.UnsharpMask(radius=float(unsharp_radius), percent=int(unsharp_percent), threshold=int(unsharp_threshold)))
        except Exception as e:
            print('Unsharp failed:', e)

        # optional autocontrast to improve contrast on low-contrast renders
        try:
            if autocontrast:
                img = ImageOps.autocontrast(img)
        except Exception:
            pass

        out_buf = BytesIO()
        img.save(out_buf, format='PNG')
        out_buf.seek(0)
        return out_buf.read()
    except Exception as e:
        print('Post-processing failed:', e)
        return img_bytes


def _local_text_boost(img_bytes: bytes) -> bytes:
    """Lightweight local enhancement to improve small text legibility without ML models.
    Uses PIL autocontrast, binarization, and max-filter dilation to thicken strokes.
    Returns PNG bytes.
    """
    if not PIL_AVAILABLE:
        return img_bytes
    try:
        buf = BytesIO(img_bytes)
        img = Image.open(buf).convert('L')
        # increase contrast
        img = ImageOps.autocontrast(img)
        # simple threshold to b/w
        img = img.point(lambda p: 255 if p > 128 else 0)
        # apply a couple of MaxFilter passes to thicken strokes
        try:
            img = img.filter(ImageFilter.MaxFilter(3))
            img = img.filter(ImageFilter.MaxFilter(3))
        except Exception:
            pass
        out = img.convert('RGBA')
        out_buf = BytesIO()
        out.save(out_buf, format='PNG')
        out_buf.seek(0)
        return out_buf.read()
    except Exception as e:
        print('local_text_boost failed:', e)
        return img_bytes

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
    # optional postprocess flags forwarded from backend
    postprocess: Optional[bool] = None
    postprocess_sr: Optional[bool] = None
    postprocess_upscale: Optional[float] = None
    postprocess_unsharp_radius: Optional[float] = None
    postprocess_unsharp_percent: Optional[float] = None
    postprocess_unsharp_threshold: Optional[int] = None
    postprocess_autocontrast: Optional[bool] = None


class ComposePromptRequest(BaseModel):
    name: Optional[str]
    title: Optional[str]
    company: Optional[str]
    industry: Optional[str]
    mood: Optional[str]
    keywords: Optional[List[str]] = []


@app.post('/compose-prompt')
async def compose_prompt(req: ComposePromptRequest):
    """Compose a rich text-to-image prompt from structured card fields.
    Attempts to call a text-inference LLM (Hugging Face text-generation) if
    HUGGINGFACE_API_TOKEN is present; otherwise falls back to a deterministic
    template-based prompt.
    """
    # deterministic template fallback
    def template():
        parts = []
        if req.name:
            parts.append(f"business card for {req.name}")
        if req.title:
            parts.append(req.title)
        if req.company:
            parts.append(f"at {req.company}")
        if req.industry:
            parts.append(f"industry: {req.industry}")
        if req.mood:
            parts.append(f"mood: {req.mood}")
        if req.keywords:
            parts.append(', '.join(req.keywords))
        base = ', '.join(parts) if parts else 'business card, minimalist, clean'
        # add useful defaults for legibility and logo placement
        base += ", high-resolution, clear legible text, centered logo area, simple color palette"
        return base

    hf_token = os.environ.get('HUGGINGFACE_API_TOKEN') or os.environ.get('HF_TOKEN')
    hf_model = os.environ.get('HUGGINGFACE_TEXT_MODEL') or os.environ.get('HUGGINGFACE_MODEL') or 'gpt2'
    if not hf_token:
        return { 'prompt': template(), 'source': 'template' }

    # Call HF text-generation endpoint for a richer prompt
    try:
        url = f'https://api-inference.huggingface.co/models/{hf_model}'
        headers = {'Authorization': f'Bearer {hf_token}'}
        # craft a short instruction
        instr = (
            f"Compose a detailed, descriptive text-to-image prompt for a business card. "
            f"Include layout hints: logo area, name prominence, readable contact text, color palette suggestions.\n\n"
            f"Fields:\nName: {req.name or ''}\nTitle: {req.title or ''}\nCompany: {req.company or ''}\n"
            f"Industry: {req.industry or ''}\nMood: {req.mood or ''}\nKeywords: {', '.join(req.keywords or [])}\n\n"
            "Provide a single concise prompt optimized for image generation with emphasis on legibility."
        )
        payload = { 'inputs': instr, 'options': { 'wait_for_model': True }, 'parameters': { 'max_new_tokens': 200 } }
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0)) as client:
            r = await client.post(url, headers=headers, json=payload)
            if r.status_code == 200:
                data = r.json()
                # HF text endpoints sometimes return a list of generations
                if isinstance(data, list) and data:
                    text = data[0].get('generated_text') or data[0].get('text') or str(data[0])
                elif isinstance(data, dict):
                    text = data.get('generated_text') or data.get('text') or str(data)
                else:
                    text = str(data)
                return { 'prompt': text.strip(), 'source': 'huggingface' }
            else:
                return { 'prompt': template(), 'source': 'template', 'warning': f'HF text-gen status {r.status_code}' }
    except Exception as e:
        return { 'prompt': template(), 'source': 'template', 'warning': str(e) }


@app.post('/generate/multi')
async def generate_multi(req: GenerateLogoRequest):
    """Run the same prompt across available providers: Stability, HuggingFace, and local diffusers.
    Returns an ordered list of results with metadata.
    """
    results = []

    # 1) Try Stability (best-effort)
    if generate_stability_image:
        try:
            sreq = StabilityRequest(prompt=req.prompt, width=req.width, height=req.height, steps=req.steps)
            sres = await generate_stability(sreq)
            if isinstance(sres, dict):
                sres.setdefault('provider', 'stability')
            results.append(sres)
        except Exception as e:
            results.append({ 'error': 'stability_failed', 'details': str(e), 'provider': 'stability' })

    # 2) Hugging Face
    try:
        hres = await generate_logo(req)
        if isinstance(hres, dict):
            hres.setdefault('provider', 'huggingface')
        results.append(hres)
    except Exception as e:
        results.append({ 'error': 'hf_failed', 'details': str(e), 'provider': 'huggingface' })

    # 3) local diffusers
    if USE_LOCAL_DIFFUSION:
        try:
            lreq = GenerateLogoRequest(prompt=req.prompt, width=req.width, height=req.height, steps=req.steps)
            lres = await generate_logo(lreq)
            if isinstance(lres, dict):
                lres.setdefault('provider', 'local')
            results.append(lres)
        except Exception as e:
            results.append({ 'error': 'local_failed', 'details': str(e), 'provider': 'local' })

    return { 'results': results }


@app.post('/generate/with-score')
async def generate_with_score(req: GenerateLogoRequest):
    """Run multi-provider generation, optionally super-resolve each image, perform OCR scoring,
    and return all results plus the best-picked image according to OCR length.
    """
    # Run multi-provider generation to get candidate images
    multi = await generate_multi(req)
    results = multi.get('results', []) if isinstance(multi, dict) else []

    scored = []
    for item in results:
        # item can be dict with images list or an error dict
        if not isinstance(item, dict) or 'images' not in item:
            scored.append({ 'provider': item.get('provider') if isinstance(item, dict) else 'unknown', 'error': item.get('error') if isinstance(item, dict) else 'invalid' })
            continue
        try:
            img_dataurl = item['images'][0]
            img_bytes = _decode_data_url(img_dataurl) if img_dataurl.startswith('data:') else base64.b64decode(img_dataurl)
        except Exception as e:
            scored.append({ 'provider': item.get('provider','unknown'), 'error': 'invalid_image', 'details': str(e) })
            continue

        # optional SR (use per-item meta if available)
        try:
            meta = item if isinstance(item, dict) else {}
            do_sr = meta.get('postprocess_sr', None)
            if do_sr is None:
                do_sr_env = os.environ.get('POSTPROCESS_SR', '0')
                do_sr = str(do_sr_env).lower() in ('1', 'true', 'yes')
            if do_sr and super_resolve:
                try:
                    sr_mode = meta.get('postprocess_sr_mode') or os.environ.get('POSTPROCESS_SR_MODE','hf')
                    img_bytes = await super_resolve(img_bytes, mode=sr_mode)
                except Exception as e:
                    print('SR failed for provider', item.get('provider'), str(e))
        except Exception:
            pass

        # OCR scoring
        score = 0
        text = ''
        if ocr_text_from_bytes:
            try:
                text = ocr_text_from_bytes(img_bytes)
                score = len(text.strip())
            except Exception as e:
                print('OCR failed:', e)

        scored.append({
            'provider': item.get('provider','unknown'),
            'image': 'data:image/png;base64,' + base64.b64encode(img_bytes).decode('utf-8'),
            'ocr_text': text,
            'score': score,
            'meta': { k: v for k, v in item.items() if k != 'images' }
        })

    # pick best by score (highest OCR length); tiebreaker: prefer stability then huggingface then local
    def provider_rank(p):
        order = { 'stability': 0, 'huggingface': 1, 'local': 2 }
        return order.get(p, 99)

    best = None
    for s in scored:
        if 'score' not in s:
            continue
        if best is None:
            best = s
            continue
        if s['score'] > best['score'] or (s['score'] == best['score'] and provider_rank(s.get('provider','')) < provider_rank(best.get('provider',''))):
            best = s

    return { 'candidates': scored, 'best': best }


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



class SRRequest(BaseModel):
    imageBase64: str
    mode: Optional[str] = 'auto'  # 'hf' | 'local' | 'auto'


@app.post('/super-resolve')
async def super_resolve_endpoint(req: SRRequest):
    if not super_resolve:
        raise HTTPException(status_code=501, detail='Super-resolution helper not available on this server')
    try:
        img_b = _decode_data_url(req.imageBase64) if req.imageBase64.startswith('data:') else base64.b64decode(req.imageBase64)
    except Exception:
        raise HTTPException(status_code=400, detail='invalid imageBase64')
    try:
        out_bytes = await super_resolve(img_b, mode=req.mode or 'auto')
        return { 'image': 'data:image/png;base64,' + base64.b64encode(out_bytes).decode('utf-8') }
    except Exception as e:
        raise HTTPException(status_code=502, detail='Super-resolve failed: ' + str(e))


@app.post('/score')
async def score_endpoint(req: SRRequest):
    # returns OCR text and a naive score (length of extracted text)
    if not ocr_text_from_bytes:
        raise HTTPException(status_code=501, detail='OCR helper not available')
    try:
        img_b = _decode_data_url(req.imageBase64) if req.imageBase64.startswith('data:') else base64.b64decode(req.imageBase64)
    except Exception:
        raise HTTPException(status_code=400, detail='invalid imageBase64')
    try:
        text = ocr_text_from_bytes(img_b)
        score = len(text.strip())
        return { 'text': text, 'score': score }
    except Exception as e:
        raise HTTPException(status_code=502, detail='OCR failed: ' + str(e))


@app.post('/generate/logo')
async def generate_logo(req: GenerateLogoRequest):
    # If local diffusers is requested and available, prefer it
    if USE_LOCAL_DIFFUSION:
        try:
            # run CPU->GPU-suitable synchronous code in threadpool
            steps = req.steps or 40
            high_noise_frac = float(os.environ.get('LOCAL_HIGH_NOISE_FRAC', 0.8))
            img_bytes = await asyncio.to_thread(_generate_local_image_sync, req.prompt, steps, high_noise_frac, req.width, req.height, os.environ.get('LOCAL_DEVICE','cuda'))
            # apply postprocess if requested in payload
            try:
                do_post_flag = req.postprocess if req.postprocess is not None else None
                # call per-request postprocess with request-provided params (fallback to env inside helper)
                if do_post_flag is None:
                    # determine enabled state from env inside helper
                    img_bytes = _postprocess_image_bytes(
                        img_bytes,
                        enabled=None,
                        upscale=req.postprocess_upscale,
                        unsharp_radius=req.postprocess_unsharp_radius,
                        unsharp_percent=req.postprocess_unsharp_percent,
                        unsharp_threshold=req.postprocess_unsharp_threshold,
                        autocontrast=req.postprocess_autocontrast,
                    )
                else:
                    img_bytes = _postprocess_image_bytes(
                        img_bytes,
                        enabled=bool(do_post_flag),
                        upscale=req.postprocess_upscale,
                        unsharp_radius=req.postprocess_unsharp_radius,
                        unsharp_percent=req.postprocess_unsharp_percent,
                        unsharp_threshold=req.postprocess_unsharp_threshold,
                        autocontrast=req.postprocess_autocontrast,
                    )
            except Exception as e:
                print('Local postprocess failed:', e)

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
                # inspect incoming request-level postprocess flags (fall back to env)
                try:
                    # per-request postprocess
                    do_post_flag = getattr(req, 'postprocess', None)
                    if do_post_flag is None:
                        img_bytes = _postprocess_image_bytes(
                            img_bytes,
                            enabled=None,
                            upscale=getattr(req, 'postprocess_upscale', None),
                            unsharp_radius=getattr(req, 'postprocess_unsharp_radius', None),
                            unsharp_percent=getattr(req, 'postprocess_unsharp_percent', None),
                            unsharp_threshold=getattr(req, 'postprocess_unsharp_threshold', None),
                            autocontrast=getattr(req, 'postprocess_autocontrast', None),
                        )
                    else:
                        img_bytes = _postprocess_image_bytes(
                            img_bytes,
                            enabled=bool(do_post_flag),
                            upscale=getattr(req, 'postprocess_upscale', None),
                            unsharp_radius=getattr(req, 'postprocess_unsharp_radius', None),
                            unsharp_percent=getattr(req, 'postprocess_unsharp_percent', None),
                            unsharp_threshold=getattr(req, 'postprocess_unsharp_threshold', None),
                            autocontrast=getattr(req, 'postprocess_autocontrast', None),
                        )
                except Exception as e:
                    print('Postprocess failed:', e)

                # optional super-resolution (request-level then env)
                try:
                    do_sr = getattr(req, 'postprocess_sr', None)
                    if do_sr is None:
                        do_sr_env = os.environ.get('POSTPROCESS_SR', '0')
                        do_sr = str(do_sr_env).lower() in ('1', 'true', 'yes')
                    if do_sr and super_resolve:
                        try:
                            sr_mode = getattr(req, 'postprocess_sr_mode', None) or os.environ.get('POSTPROCESS_SR_MODE','hf')
                            img_bytes = await super_resolve(img_bytes, mode=sr_mode)
                        except Exception as e:
                            print('Super-resolve failed:', e)
                except Exception:
                    pass
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
    # Enforce card-specific defaults server-side in case the backend didn't
    # attach them. This ensures card images are generated at sufficient
    # resolution and with legibility-focused prompt hints and postprocess
    # defaults.
    def ensure_card_defaults(request: GenerateLogoRequest) -> GenerateLogoRequest:
        # copy to avoid mutating caller's object
        n = GenerateLogoRequest(
            prompt=request.prompt,
            style=getattr(request, 'style', None),
            count=getattr(request, 'count', 1),
            width=getattr(request, 'width', None),
            height=getattr(request, 'height', None),
            steps=getattr(request, 'steps', None),
            guidance_scale=getattr(request, 'guidance_scale', None),
            postprocess=getattr(request, 'postprocess', None),
            postprocess_sr=getattr(request, 'postprocess_sr', None),
            postprocess_upscale=getattr(request, 'postprocess_upscale', None),
            postprocess_unsharp_radius=getattr(request, 'postprocess_unsharp_radius', None),
            postprocess_unsharp_percent=getattr(request, 'postprocess_unsharp_percent', None),
            postprocess_unsharp_threshold=getattr(request, 'postprocess_unsharp_threshold', None),
            postprocess_autocontrast=getattr(request, 'postprocess_autocontrast', None),
        )

        # Enforce minimums
        min_w = int(os.environ.get('CARD_MIN_WIDTH', 1024))
        min_h = int(os.environ.get('CARD_MIN_HEIGHT', 640))
        try:
            w = int(n.width or min_w)
            h = int(n.height or min_h)
        except Exception:
            w, h = min_w, min_h
        if w < min_w or h < min_h:
            scale_x = float(min_w) / float(w)
            scale_y = float(min_h) / float(h)
            scale = max(scale_x, scale_y)
            w = int(math.ceil(w * scale))
            h = int(math.ceil(h * scale))
        n.width = w
        n.height = h

        # Append legibility hints if not present
        leg_instr = (' High-resolution, sharp, legible sans-serif typography; large readable name and contact text; '
                    'render any text exactly as provided; avoid random glyphs or distorted typography; '
                    'flat vector-style logo placement; avoid metallic reflections or busy photoreal style.')
        try:
            if n.prompt and isinstance(n.prompt, str):
                low = n.prompt.lower()
                if 'legible' not in low and 'no random glyphs' not in low:
                    n.prompt = n.prompt.strip() + ' ' + leg_instr
            else:
                n.prompt = 'Business card, clean, high-resolution, legible typography.' + leg_instr
        except Exception:
            n.prompt = (n.prompt or '') + ' Business card, legible text.' + leg_instr

        # Default postprocess flags to enabled for cards
        if n.postprocess is None:
            n.postprocess = True
        if n.postprocess_sr is None:
            n.postprocess_sr = True
        if n.postprocess_upscale is None:
            n.postprocess_upscale = float(os.environ.get('POSTPROCESS_UPSCALE', 1.5))
        if n.postprocess_unsharp_radius is None:
            n.postprocess_unsharp_radius = float(os.environ.get('POSTPROCESS_UNSHARP_RADIUS', 1.0))
        if n.postprocess_unsharp_percent is None:
            n.postprocess_unsharp_percent = float(os.environ.get('POSTPROCESS_UNSHARP_PERCENT', 150.0))
        if n.postprocess_unsharp_threshold is None:
            n.postprocess_unsharp_threshold = int(os.environ.get('POSTPROCESS_UNSHARP_THRESHOLD', 3))
        if n.postprocess_autocontrast is None:
            n.postprocess_autocontrast = True

        return n

    enforced = ensure_card_defaults(req)
    result = await generate_logo(enforced)
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
        # If Stability fails due to payment/engine entitlement errors, fall
        # back to Hugging Face inference (if configured). Be defensive and
        # only trigger fallback for likely payment/engine issues to avoid
        # masking other runtime errors.
        err_text = str(e)
        low = err_text.lower()
        is_engine_or_payment = (
            '402' in err_text or 'payment' in low or 'insufficient' in low and 'credit' in low
            or ('engine' in low and ('not found' in low or 'notfound' in low))
        )

        hf_token = os.environ.get('HUGGINGFACE_API_TOKEN') or os.environ.get('HF_TOKEN')
        if is_engine_or_payment and hf_token:
            try:
                print(f"Stability failed with engine/payment error, falling back to HF: {err_text[:200]}")
                # Construct a compatible GenerateLogoRequest and call the HF path
                hf_req = GenerateLogoRequest(
                    prompt=req.prompt,
                    width=req.width or 512,
                    height=req.height or 512,
                    steps=req.steps or 20,
                    guidance_scale=req.cfg_scale or 7.5
                )
                hf_result = await generate_logo(hf_req)
                # annotate fallback and return
                if isinstance(hf_result, dict):
                    hf_result.setdefault('fallback_from', 'stability')
                    hf_result.setdefault('source', hf_result.get('source', 'huggingface'))
                return hf_result
            except HTTPException as he:
                # HF fallback produced an HTTPException; surface combined info
                raise HTTPException(status_code=502, detail=f'Stability failed: {err_text}; HF fallback failed: {str(he)}')
            except Exception as he:
                raise HTTPException(status_code=502, detail=f'Stability failed: {err_text}; HF fallback exception: {str(he)}')

        # Not an engine/payment issue or no HF token available — surface original error
        raise HTTPException(status_code=502, detail=f'Stability generation failed: {err_text}')


class LayoutRequest(BaseModel):
    width: Optional[int] = 1050
    height: Optional[int] = 600
    name: Optional[str]
    title: Optional[str]
    company: Optional[str]
    logo_preference: Optional[str] = 'left'  # left|center|right


@app.post('/layout/suggest')
async def layout_suggest(req: LayoutRequest):
    # Simple rule-based layout suggestions: return bounding boxes as percentages
    w = int(req.width or 1050)
    h = int(req.height or 600)
    # Normalize to 0..1 box coords
    boxes = {}
    # logo box
    if req.logo_preference == 'left':
        boxes['logo'] = { 'x': 0.05, 'y': 0.2, 'w': 0.25, 'h': 0.6 }
        text_x = 0.33
    elif req.logo_preference == 'right':
        boxes['logo'] = { 'x': 0.70, 'y': 0.2, 'w': 0.25, 'h': 0.6 }
        text_x = 0.05
    else:
        boxes['logo'] = { 'x': 0.35, 'y': 0.05, 'w': 0.30, 'h': 0.30 }
        text_x = 0.05

    # name (prominent)
    boxes['name'] = { 'x': text_x, 'y': 0.08, 'w': 0.60, 'h': 0.18 }
    # title/company
    boxes['title'] = { 'x': text_x, 'y': 0.28, 'w': 0.60, 'h': 0.12 }
    boxes['company'] = { 'x': text_x, 'y': 0.42, 'w': 0.60, 'h': 0.10 }
    # contact block bottom-left
    boxes['contact'] = { 'x': 0.05, 'y': 0.65, 'w': 0.60, 'h': 0.25 }

    return { 'width': w, 'height': h, 'boxes': boxes }


class VectorizeRequest(BaseModel):
    imageBase64: str


@app.post('/vectorize')
async def vectorize(req: VectorizeRequest):
    # Try to call potrace via python bindings or cv2 + skimage fallback.
    try:
        data = _decode_data_url(req.imageBase64) if req.imageBase64.startswith('data:') else base64.b64decode(req.imageBase64)
    except Exception:
        raise HTTPException(status_code=400, detail='invalid imageBase64')

    # Try potrace (optional)
    try:
        import cv2
        import numpy as np
        # simple trace using OpenCV thresholds and contours -> convert to SVG path
        nparr = np.frombuffer(data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
        if img is None:
            raise Exception('cv2 failed to decode image')
        _, th = cv2.threshold(img, 250, 255, cv2.THRESH_BINARY_INV)
        contours, _ = cv2.findContours(th, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        # build a naive SVG
        h, w = img.shape[:2]
        paths = []
        for cnt in contours:
            pts = cnt.reshape(-1, 2)
            d = 'M ' + ' L '.join([f"{int(x)},{int(y)}" for x, y in pts]) + ' Z'
            paths.append(d)
        svg = f"<svg xmlns='http://www.w3.org/2000/svg' width='{w}' height='{h}'>" + ''.join([f"<path d='{p}' fill='black'/>" for p in paths]) + '</svg>'
        return { 'svg': svg }
    except Exception as e:
        # Fallback: return informative message with recommended tools
        return { 'error': 'vectorize_unavailable', 'details': str(e), 'note': 'Install opencv-python or potrace for vectorization; or export PNG and run external tracing.' }


class IconSearchRequest(BaseModel):
    q: str
    top_k: Optional[int] = 6


def _load_frontend_icons():
    # Best-effort parser for frontend/src/data/icons.js to extract id and label
    try:
        path = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'src', 'data', 'icons.js')
        path = os.path.abspath(path)
        if not os.path.exists(path):
            return []
        out = []
        with open(path, 'r', encoding='utf-8') as fh:
            txt = fh.read()
        # crude parsing: find "id: '...'" and "label: '...'" occurrences within ICONS array
        import re
        entries = re.findall(r"\{([^}]+)\}", txt, flags=re.DOTALL)
        for e in entries:
            m_id = re.search(r"id\s*:\s*['\"]([\w-]+)['\"]", e)
            m_label = re.search(r"label\s*:\s*['\"]([^'\"]+)['\"]", e)
            if m_id and m_label:
                out.append({ 'id': m_id.group(1), 'label': m_label.group(1) })
        return out
    except Exception:
        return []


@app.post('/icons/search')
async def icons_search(req: IconSearchRequest):
    q = (req.q or '').strip().lower()
    if not q:
        return { 'results': [] }

    icons = _load_frontend_icons()
    if not icons:
        return { 'results': [], 'warning': 'no frontend icons found' }

    # If HF embeddings available, use them to rank; otherwise fallback to substring/fuzzy score
    hf_token = os.environ.get('HUGGINGFACE_API_TOKEN') or os.environ.get('HF_TOKEN')
    try:
        if hf_token:
            # call embeddings endpoint for query and icon labels
            model = os.environ.get('HF_EMBEDDING_MODEL') or 'sentence-transformers/all-MiniLM-L6-v2'
            url = f'https://api-inference.huggingface.co/models/{model}'
            headers = {'Authorization': f'Bearer {hf_token}'}
            # prepare inputs: list of texts (first is query)
            texts = [q] + [i['label'] for i in icons]
            payload = { 'inputs': texts }
            async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0)) as client:
                r = await client.post(url, headers=headers, json=payload)
                if r.status_code == 200:
                    data = r.json()
                    # expect list of vectors
                    if isinstance(data, list) and len(data) >= 1:
                        qvec = data[0]
                        scores = []
                        from math import sqrt
                        def dot(a,b):
                            return sum(x*y for x,y in zip(a,b))
                        for i, lab in enumerate(icons):
                            vec = data[i+1]
                            # cosine similarity
                            denom = (sqrt(dot(qvec,qvec))*sqrt(dot(vec,vec))) or 1.0
                            sim = dot(qvec, vec) / denom
                            scores.append((sim, lab))
                        scores.sort(key=lambda x: x[0], reverse=True)
                        results = [ { 'id': l['id'], 'label': l['label'], 'score': float(s) } for s,l in scores[:req.top_k] ]
                        return { 'results': results }
    except Exception as e:
        print('Embeddings search failed:', e)

    # fallback fuzzy substring scoring
    def fuzzy_score(a, b):
        a = a.lower(); b = b.lower()
        if a == b: return 100
        if a in b: return 80
        if b in a: return 60
        # partial match
        import difflib
        return int(difflib.SequenceMatcher(None, a, b).ratio() * 100)

    scored = []
    for ic in icons:
        s = fuzzy_score(q, ic['label'])
        scored.append((s, ic))
    scored.sort(key=lambda x: x[0], reverse=True)
    results = [ { 'id': ic['id'], 'label': ic['label'], 'score': int(s) } for s, ic in scored[:req.top_k] ]
    return { 'results': results }


class RefineRequest(BaseModel):
    imageBase64: str
    style_prompt: str
    strength: Optional[float] = 0.6


@app.post('/refine-style')
async def refine_style(req: RefineRequest):
    # decode image
    try:
        img_b = _decode_data_url(req.imageBase64) if req.imageBase64.startswith('data:') else base64.b64decode(req.imageBase64)
    except Exception:
        raise HTTPException(status_code=400, detail='invalid imageBase64')

    # Prefer HF image-to-image or local refiner if available
    hf_token = os.environ.get('HUGGINGFACE_API_TOKEN') or os.environ.get('HF_TOKEN')
    hf_model = os.environ.get('HUGGINGFACE_REFINE_MODEL') or os.environ.get('HUGGINGFACE_MODEL')
    if hf_token and hf_model:
        try:
            url = f'https://api-inference.huggingface.co/models/{hf_model}'
            headers = {'Authorization': f'Bearer {hf_token}'}
            files = { 'image': ('input.png', img_b, 'image/png') }
            data = { 'parameters': json.dumps({ 'prompt': req.style_prompt, 'strength': req.strength }) }
            async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
                r = await client.post(url, headers=headers, files=files, data=data)
                if r.status_code == 200:
                    return { 'image': 'data:image/png;base64,' + base64.b64encode(r.content).decode('utf-8') }
                else:
                    raise Exception(f'HF refine status {r.status_code} {r.text[:200]}')
        except Exception as e:
            print('HF refine failed:', e)

    # Attempt local refine using diffusers refiner if available
    if USE_LOCAL_DIFFUSION:
        try:
            # run a simple local refiner call in thread
            def _local_refine():
                # this is a best-effort path; reuse loaded pipelines if available
                base, refiner = _load_local_pipelines(device=os.environ.get('LOCAL_DEVICE','cuda'))
                # load image into PIL
                from PIL import Image
                from io import BytesIO
                img = Image.open(BytesIO(img_b)).convert('RGB')
                out = refiner(image=img, prompt=req.style_prompt, strength=req.strength, num_inference_steps=30).images[0]
                buf = BytesIO()
                out.save(buf, format='PNG')
                return buf.getvalue()

            out_bytes = await asyncio.to_thread(_local_refine)
            return { 'image': 'data:image/png;base64,' + base64.b64encode(out_bytes).decode('utf-8') }
        except Exception as e:
            print('local refine failed:', e)

    raise HTTPException(status_code=501, detail='No available refine model configured (set HUGGINGFACE_API_TOKEN and HUGGINGFACE_REFINE_MODEL or enable USE_LOCAL_DIFFUSION)')


class RefineLoopRequest(BaseModel):
    prompt: str
    width: Optional[int] = 512
    height: Optional[int] = 512
    steps: Optional[int] = 20
    guidance_scale: Optional[float] = 7.5
    target_ocr_score: Optional[int] = 20
    max_iters: Optional[int] = 3
    init_imageBase64: Optional[str] = None
    # allow per-request SR control for refine loops
    postprocess_sr: Optional[bool] = None
    postprocess_sr_mode: Optional[str] = None


@app.post('/generate/refine-loop')
async def generate_refine_loop(req: RefineLoopRequest):
    """Orchestrate generate -> SR -> OCR -> inpaint loop to improve legibility.
    Best-effort: will use HF/local refine where available and return final candidates + logs.
    """
    # 1) basic input validation
    if not req.prompt:
        raise HTTPException(status_code=400, detail='prompt required')

    try:
        # If an initial image is provided, run the refinement loop on that image
        results = []
        if req.init_imageBase64:
            # Use the provided image as a single 'init' candidate
            results = [{ 'provider': 'init', 'images': [req.init_imageBase64] }]
        else:
            # Compose a GenerateLogoRequest to reuse existing generation paths
            greq = GenerateLogoRequest(prompt=req.prompt, width=req.width, height=req.height, steps=req.steps, guidance_scale=req.guidance_scale)

            # Run multi-provider generation to get candidates
            try:
                multi = await generate_multi(greq)
            except Exception as e:
                raise HTTPException(status_code=502, detail=f'multi generation failed: {str(e)}')

            results = multi.get('results', []) if isinstance(multi, dict) else []
    except Exception as debug_e:
        # Temporary: surface debug info in response body to aid local debugging
        import traceback
        tb = traceback.format_exc()
        return { 'detail': 'debug_error', 'error': str(debug_e), 'trace': tb }
    out_candidates = []

    # If multi-provider returned no usable images (e.g., HF HTTPError produced error entries),
    # attempt a Stability.ai fallback to ensure we have at least one image to refine.
    try:
        has_images = any(isinstance(it, dict) and it.get('images') for it in results)
    except Exception:
        has_images = False

    if not has_images:
        # If an init image was provided but providers failed, try a lightweight local text-boost and return it.
        if req.init_imageBase64:
            try:
                print('No provider images, using init image with local text-boost fallback')
                init_bytes = _decode_data_url(req.init_imageBase64) if req.init_imageBase64.startswith('data:') else base64.b64decode(req.init_imageBase64)
                boosted = _local_text_boost(init_bytes)
                data_url = 'data:image/png;base64,' + base64.b64encode(boosted).decode('utf-8')
                return { 'candidates': [{ 'provider': 'init_boost', 'result_image': data_url, 'final_ocr_len': 0 }] }
            except Exception as e:
                print('Init image boost failed:', e)

        # Try Stability fallback if available
        try:
            if generate_stability_image:
                print('No images from HF/local; attempting Stability.ai fallback inside refine-loop')
                sreq = StabilityRequest(prompt=req.prompt, width=req.width or 512, height=req.height or 512, steps=req.steps or 20)
                stab = await generate_stability(sreq)
                # normalize into expected results list
                if isinstance(stab, dict) and stab.get('images'):
                    results = [{ 'provider': 'stability', 'images': stab.get('images') }]
                else:
                    print('Stability fallback returned no images:', stab)
        except Exception as se:
            print('Stability fallback inside refine-loop failed:', se)

    for item in results:
        candidate_log = { 'provider': item.get('provider') if isinstance(item, dict) else 'unknown', 'attempts': [] }
        # decode image bytes
        try:
            img_dataurl = item.get('images', [None])[0] if isinstance(item, dict) else None
            if not img_dataurl:
                candidate_log['error'] = 'no_image'
                out_candidates.append(candidate_log)
                continue
            img_bytes = _decode_data_url(img_dataurl) if img_dataurl.startswith('data:') else base64.b64decode(img_dataurl)
        except Exception as e:
            candidate_log['error'] = 'invalid_image'
            candidate_log['details'] = str(e)
            out_candidates.append(candidate_log)
            continue

        # iterative loop
        cur_bytes = img_bytes
        final_bytes = cur_bytes
        achieved_score = 0
        for itr in range(int(req.max_iters or 1)):
            step_log = { 'iteration': itr+1 }
            # optional SR (use per-request flags if provided)
            try:
                do_sr = req.postprocess_sr if getattr(req, 'postprocess_sr', None) is not None else None
                if do_sr is None:
                    do_sr_env = os.environ.get('POSTPROCESS_SR', '0')
                    do_sr = str(do_sr_env).lower() in ('1', 'true', 'yes')
                if do_sr and super_resolve:
                    try:
                        sr_mode = req.postprocess_sr_mode or os.environ.get('POSTPROCESS_SR_MODE','hf')
                        cur_bytes = await super_resolve(cur_bytes, mode=sr_mode)
                        step_log['sr'] = 'applied'
                    except Exception as e:
                        step_log['sr_error'] = str(e)
            except Exception:
                pass

            # OCR
            ocr_text = ''
            try:
                if ocr_text_from_bytes:
                    ocr_text = ocr_text_from_bytes(cur_bytes)
                    step_log['ocr_text'] = ocr_text
                    step_log['ocr_len'] = len(ocr_text.strip())
            except Exception as e:
                step_log['ocr_error'] = str(e)

            achieved_score = len((ocr_text or '').strip())
            # check threshold
            if achieved_score >= int(req.target_ocr_score or 0):
                step_log['status'] = 'ok'
                candidate_log['attempts'].append(step_log)
                final_bytes = cur_bytes
                break

            # else attempt inpainting refinement around low-confidence text boxes
            if detect_text_bboxes and make_mask_from_boxes:
                try:
                    boxes = detect_text_bboxes(cur_bytes, min_confidence=15)
                    if boxes:
                        boxes = expand_boxes_by_ratio(boxes, ratio=0.25)
                        mask_png = make_mask_from_boxes(cur_bytes, boxes, pad=8)
                        # call HF image-to-image refine if available
                        hf_token = os.environ.get('HUGGINGFACE_API_TOKEN') or os.environ.get('HF_TOKEN')
                        hf_model = os.environ.get('HUGGINGFACE_REFINE_MODEL') or os.environ.get('HUGGINGFACE_MODEL')
                        refined = None
                        if hf_token and hf_model:
                            try:
                                url = f'https://api-inference.huggingface.co/models/{hf_model}'
                                headers = {'Authorization': f'Bearer {hf_token}'}
                                files = {
                                    'image': ('input.png', cur_bytes, 'image/png'),
                                    'mask': ('mask.png', mask_png, 'image/png')
                                }
                                data = { 'parameters': json.dumps({ 'prompt': req.prompt + ' Improve text legibility and make text crisp and high-contrast.', 'strength': 0.8 }) }
                                async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
                                    r = await client.post(url, headers=headers, files=files, data=data)
                                    if r.status_code == 200:
                                        refined = r.content
                                        step_log['inpaint'] = 'hf'                    
                            except Exception as e:
                                step_log['inpaint_error'] = f'hf:{str(e)}'

                        # Attempt local refine fallback
                        if refined is None and USE_LOCAL_DIFFUSION:
                            try:
                                def _local_inpaint():
                                    base, refiner = _load_local_pipelines(device=os.environ.get('LOCAL_DEVICE','cuda'))
                                    from PIL import Image
                                    from io import BytesIO
                                    img = Image.open(BytesIO(cur_bytes)).convert('RGB')
                                    mask = Image.open(BytesIO(mask_png)).convert('L')
                                    out = refiner(image=img, mask_image=mask, prompt=req.prompt + ' Improve text legibility and make text crisp and high-contrast.', strength=0.8, num_inference_steps=25).images[0]
                                    buf = BytesIO()
                                    out.save(buf, format='PNG')
                                    return buf.getvalue()

                                refined = await asyncio.to_thread(_local_inpaint)
                                step_log['inpaint'] = 'local'
                            except Exception as e:
                                step_log['inpaint_error_local'] = str(e)

                        if refined:
                            cur_bytes = refined
                            step_log['inpaint_applied'] = True
                        else:
                            step_log['inpaint_applied'] = False
                    else:
                        step_log['inpaint'] = 'no_boxes'
                except Exception as e:
                    step_log['inpaint_error'] = str(e)

            candidate_log['attempts'].append(step_log)
            final_bytes = cur_bytes

        # end iterations for this candidate
        candidate_log['final_ocr_len'] = achieved_score
        candidate_log['result_image'] = 'data:image/png;base64,' + base64.b64encode(final_bytes).decode('utf-8')
        out_candidates.append(candidate_log)

    # Normalize output: include a top-level 'images' list (data-urls) for callers that expect it.
    images = []
    try:
        for c in out_candidates:
            if isinstance(c, dict) and c.get('result_image'):
                images.append(c.get('result_image'))
            elif isinstance(c, dict) and c.get('images') and isinstance(c.get('images'), list) and c.get('images')[0]:
                images.append(c.get('images')[0])
    except Exception:
        images = []

    out = { 'candidates': out_candidates }
    if images:
        out['images'] = images
        # also include a convenience 'best' pointing to first image
        out['best'] = images[0]
    return out
