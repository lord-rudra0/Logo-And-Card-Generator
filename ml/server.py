from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import math

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
"""
ML service removed

This file previously hosted a FastAPI-based ML service used for text-to-image
and logo generation. The ML components were removed from this repository.

If you need to re-enable ML features in the future, restore this file from
your previous VCS history or implement an external service and update the
backend proxies accordingly.
"""

# Intentionally left as a placeholder to keep the path available for history.
