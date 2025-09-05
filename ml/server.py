from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import math
import os
import base64
import httpx
import asyncio

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
            return { 'images': [data_url] }
        except Exception as e:
            # If local generation fails, surface informative error and fall back to HF inference path below
            raise HTTPException(status_code=500, detail='Local diffusion failed: ' + str(e))

    hf_token = os.environ.get('HUGGINGFACE_API_TOKEN') or os.environ.get('HF_TOKEN')
    model = os.environ.get('HUGGINGFACE_MODEL') or 'runwayml/stable-diffusion-v1-5'
    if not hf_token:
        raise HTTPException(status_code=400, detail='HUGGINGFACE_API_TOKEN not configured in environment')

    url = f'https://api-inference.huggingface.co/models/{model}'
    headers = {'Authorization': f'Bearer {hf_token}'}
    payload = {
        'inputs': req.prompt,
        'options': { 'wait_for_model': True },
        'parameters': {
            'width': req.width,
            'height': req.height,
            'num_inference_steps': req.steps,
            'guidance_scale': req.guidance_scale
        }
    }

    async with httpx.AsyncClient(timeout=90.0) as client:
        r = await client.post(url, headers=headers, json=payload)
        if r.status_code != 200:
            # Try to surface error
            try:
                data = r.json()
                raise HTTPException(status_code=502, detail=str(data))
            except Exception:
                raise HTTPException(status_code=502, detail=f'HF inference error: {r.status_code}')

        content_type = r.headers.get('content-type', '')
        if content_type.startswith('application/json'):
            data = r.json()
            # some HF image endpoints return json with base64 in 'generated_images' or error
            if isinstance(data, dict) and 'error' in data:
                raise HTTPException(status_code=502, detail=data['error'])
            # otherwise return the json directly
            return data

        # Assume binary image content
        img_bytes = r.content
        b64 = base64.b64encode(img_bytes).decode('utf-8')
        data_url = f'data:image/png;base64,{b64}'
        return { 'images': [data_url] }
"""
ML service removed

This file previously hosted a FastAPI-based ML service used for text-to-image
and logo generation. The ML components were removed from this repository.

If you need to re-enable ML features in the future, restore this file from
your previous VCS history or implement an external service and update the
backend proxies accordingly.
"""

# Intentionally left as a placeholder to keep the path available for history.
