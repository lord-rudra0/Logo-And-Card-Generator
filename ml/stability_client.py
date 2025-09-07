import os
import httpx
import asyncio
import base64
from typing import List, Optional

STABILITY_API_KEY = os.environ.get('STABILITY_API_KEY')
STABILITY_MODEL = os.environ.get('STABILITY_MODEL') or os.environ.get('HUGGINGFACE_MODEL', '').split('/')[-1] or 'stable-diffusion-xl-base-1.0'


async def generate_stability_image(
    prompt: str,
    width: int = 512,
    height: int = 512,
    steps: int = 20,
    cfg_scale: float = 7.5,
    samples: int = 1,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
    timeout_seconds: float = 600.0,
) -> List[str]:
    """Call Stability Platform text-to-image endpoint and return list of data URLs.

    Returns list of strings like 'data:image/png;base64,...'. Raises Exception on error.
    """
    key = api_key or STABILITY_API_KEY
    if not key:
        raise Exception('STABILITY_API_KEY not configured')

    model_id = model or STABILITY_MODEL
    # stability platform endpoint
    url = f'https://api.stability.ai/v1/generation/{model_id}/text-to-image'

    headers = {
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json'
    }

    payload = {
        'text_prompts': [{ 'text': prompt }],
        'width': width,
        'height': height,
        'steps': steps,
        'samples': samples,
        'cfg_scale': cfg_scale
    }

    async with httpx.AsyncClient(timeout=httpx.Timeout(timeout_seconds, connect=10.0)) as client:
        r = await client.post(url, headers=headers, json=payload)
        if r.status_code not in (200, 201):
            # include body for diagnostics
            raise Exception(f'Stability API error {r.status_code}: {r.text[:1000]}')
        data = r.json()

    # extract base64 artifacts defensively
    images = []
    try:
        arts = data.get('artifacts') or data.get('artifacts', [])
        if not arts and isinstance(data, dict):
            # Some responses nest artifacts differently
            arts = data.get('output', {}).get('artifacts') or []
    except Exception:
        arts = []

    if not arts:
        # fallback: try to locate first base64-like field in JSON
        def find_b64(obj):
            if isinstance(obj, dict):
                for k, v in obj.items():
                    if isinstance(v, str) and len(v) > 100 and all(c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n' for c in v[:4]):
                        return v
                    res = find_b64(v)
                    if res:
                        return res
            if isinstance(obj, list):
                for it in obj:
                    res = find_b64(it)
                    if res:
                        return res
            return None
        b64 = find_b64(data)
        if b64:
            images.append(f'data:image/png;base64,{b64}')

    else:
        for art in arts:
            b64 = art.get('base64') or art.get('b64') or art.get('b64_data') or art.get('base64_image')
            if not b64:
                # try common nested keys
                b64 = None
                for k in ('base64', 'b64', 'b64_data'):
                    if isinstance(art.get(k), str) and len(art.get(k)) > 50:
                        b64 = art.get(k)
                        break
            if not b64:
                continue
            images.append(f'data:image/png;base64,{b64}')

    if not images:
        raise Exception('No image artifacts found in Stability response')

    return images
