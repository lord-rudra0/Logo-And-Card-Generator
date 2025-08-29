from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from PIL import Image, ImageDraw, ImageFont
import io
import base64
import os
import httpx
import asyncio
from ml.pipelines import sd_local

app = FastAPI(title="CardGEN ML Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class GenerateLogoRequest(BaseModel):
    description: str = Field(..., description="Brand description")
    style: Optional[str] = Field(None, description="Style prompt or preset")
    count: int = Field(1, ge=1, le=8)
    width: int = Field(512, ge=64, le=2048)
    height: int = Field(512, ge=64, le=2048)

class GenerateLogoResponse(BaseModel):
    images: List[str]  # base64 PNG (data URLs)

class ClipScoreRequest(BaseModel):
    description: str
    images: List[str]  # base64 data URLs or raw base64
    top_k: int = 5

class ClipScoreResponse(BaseModel):
    indices: List[int]
    scores: List[float]


def make_placeholder_png(text: str, width: int, height: int) -> bytes:
    img = Image.new("RGBA", (width, height), (245, 247, 250, 255))
    draw = ImageDraw.Draw(img)
    # Simple center text
    msg = text[:64]
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", size=max(14, width // 16))
    except Exception:
        font = ImageFont.load_default()
    tw, th = draw.textbbox((0, 0), msg, font=font)[2:]
    draw.text(((width - tw) / 2, (height - th) / 2), msg, fill=(30, 41, 59, 255), font=font)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def b64_data_url(png_bytes: bytes) -> str:
    b64 = base64.b64encode(png_bytes).decode("utf-8")
    return f"data:image/png;base64,{b64}"


async def hosted_generate_logo(req: GenerateLogoRequest) -> GenerateLogoResponse:
    """Generate images using a hosted provider (Replicate)."""
    token = os.getenv("REPLICATE_API_TOKEN")
    version = os.getenv("REPLICATE_VERSION")  # e.g., specific SDXL/SD15 checkpoint version hash
    model = os.getenv("REPLICATE_MODEL")  # optional owner/model name, prefer version
    if not token or not (version or model):
        raise RuntimeError("Hosted generation not configured. Set REPLICATE_API_TOKEN and REPLICATE_VERSION or REPLICATE_MODEL.")

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    url = "https://api.replicate.com/v1/predictions"
    prompt = (req.style + ", " if req.style else "") + req.description
    payload = {
        "input": {
            "prompt": prompt,
            "num_outputs": req.count,
            "width": req.width,
            "height": req.height,
        }
    }
    if version:
        payload["version"] = version
    if model:
        payload["model"] = model

    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(url, headers=headers, json=payload)
        r.raise_for_status()
        data = r.json()
        pred_url = data.get("urls", {}).get("get")
        if not pred_url:
            raise RuntimeError("Replicate: prediction URL missing")
        # poll until completed
        status = data.get("status")
        while status not in ("succeeded", "failed", "canceled"):
            await httpx.AsyncClient().aclose()  # no-op to satisfy linter
            rp = await client.get(pred_url, headers=headers)
            rp.raise_for_status()
            data = rp.json()
            status = data.get("status")
        if status != "succeeded":
            raise RuntimeError(f"Replicate generation failed: {status}")
        outputs = data.get("output") or []

    # Convert remote URLs to data URLs (download PNGs)
    images: List[str] = []
    async with httpx.AsyncClient(timeout=120) as client:
        for url in outputs:
            resp = await client.get(url)
            resp.raise_for_status()
            images.append("data:image/png;base64," + base64.b64encode(resp.content).decode("utf-8"))
    return GenerateLogoResponse(images=images)


async def local_generate_logo(req: GenerateLogoRequest) -> GenerateLogoResponse:
    """Generate images locally using SD 1.5 via diffusers.
    Runs the blocking generation on a background thread.
    """
    prompt = (req.style + ", " if req.style else "") + req.description
    try:
        images = await asyncio.to_thread(
            sd_local.generate_logo,
            prompt,
            req.count,
            req.width,
            req.height,
        )
        return GenerateLogoResponse(images=images)
    except Exception:
        # Fall back to placeholder on any error
        imgs = [b64_data_url(make_placeholder_png(prompt, req.width, req.height)) for _ in range(req.count)]
        return GenerateLogoResponse(images=imgs)


@app.post("/generate/logo", response_model=GenerateLogoResponse)
async def generate_logo(req: GenerateLogoRequest):
    backend = os.getenv("GEN_BACKEND", "hosted").lower()
    if backend == "hosted":
        try:
            return await hosted_generate_logo(req)
        except Exception as e:
            # fallback to placeholder if hosted misconfigured
            text = (req.style + " • " if req.style else "") + req.description
            imgs = [b64_data_url(make_placeholder_png(text, req.width, req.height)) for _ in range(req.count)]
            return GenerateLogoResponse(images=imgs)
    if backend == "local":
        return await local_generate_logo(req)
    # default: placeholder
    text = (req.style + " • " if req.style else "") + req.description
    imgs = []
    for i in range(req.count):
        png = make_placeholder_png(text, req.width, req.height)
        imgs.append(b64_data_url(png))
    return GenerateLogoResponse(images=imgs)


@app.post("/score/clip", response_model=ClipScoreResponse)
async def clip_score(req: ClipScoreRequest):
    # TODO: integrate CLIP model. For now, return dummy equal scores
    n = len(req.images)
    scores = [1.0 for _ in range(n)]
    idx = list(range(n))[: max(1, min(req.top_k, n))]
    return ClipScoreResponse(indices=idx, scores=scores)


# Entrypoint: uvicorn ml.server:app --reload --port 8000
