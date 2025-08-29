import os
import base64
import io
from typing import List

import torch
from PIL import Image
from diffusers import StableDiffusionPipeline

# Singleton pipeline holder
_PIPE = None


def _get_cache_dir() -> str | None:
    # Prefer project-local cache if set
    return os.getenv("HF_HOME") or os.getenv("ML_HF_CACHE") or None


def _init_pipe() -> StableDiffusionPipeline:
    global _PIPE
    if _PIPE is not None:
        return _PIPE

    os.environ.setdefault("TRANSFORMERS_NO_TORCHVISION", "1")
    cache_dir = _get_cache_dir()

    pipe = StableDiffusionPipeline.from_pretrained(
        "runwayml/stable-diffusion-v1-5",
        torch_dtype=torch.float16,
        safety_checker=None,
        cache_dir=cache_dir,
    )
    pipe = pipe.to("cuda")

    # Memory savers for 4GB-class GPUs
    pipe.enable_attention_slicing()
    pipe.enable_vae_slicing()
    # xformers is optional; ignore if not installed
    try:
        pipe.enable_xformers_memory_efficient_attention()
    except Exception:
        pass

    _PIPE = pipe
    return _PIPE


def generate_logo(
    prompt: str,
    count: int = 1,
    width: int = 384,
    height: int = 384,
    num_inference_steps: int = 14,
    guidance_scale: float = 7.0,
) -> List[str]:
    """
    Generate logos using a local SD 1.5 pipeline and return base64 PNG data URLs.
    """
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA is not available for local generation")

    pipe = _init_pipe()

    # Clamp sizes to safe values for low VRAM
    width = max(64, min(width, 768))
    height = max(64, min(height, 768))

    images: List[str] = []
    for _ in range(count):
        out = pipe(
            prompt,
            width=width,
            height=height,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
        )
        img: Image.Image = out.images[0]
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        images.append("data:image/png;base64," + b64)
    return images


def generate_text_to_image(
    prompt: str,
    negative_prompt: str = None,
    count: int = 1,
    width: int = 512,
    height: int = 512,
    num_inference_steps: int = 20,
    guidance_scale: float = 7.5,
) -> List[str]:
    """
    Generate images from text prompt using local SD 1.5 pipeline and return base64 PNG data URLs.
    """
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA is not available for local generation")

    pipe = _init_pipe()

    # Clamp sizes to safe values for low VRAM
    width = max(64, min(width, 768))
    height = max(64, min(height, 768))

    images: List[str] = []
    for _ in range(count):
        out = pipe(
            prompt,
            negative_prompt=negative_prompt,
            width=width,
            height=height,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
        )
        img: Image.Image = out.images[0]
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        images.append("data:image/png;base64," + b64)
    return images
