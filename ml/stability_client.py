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

    # First try the v2beta /stable-image/generate/ultra endpoint which returns
    # raw image bytes when Accept: image/* is used. This avoids parsing JSON
    # artifacts and works with the newer Stability API surface.
    v2_url = os.environ.get('STABILITY_V2_URL', 'https://api.stability.ai/v2beta/stable-image/generate/ultra')
    headers_v2 = {
        'Authorization': f'Bearer {key}',
        'Accept': 'image/*'
    }

    # data fields for v2beta; output_format may be 'png' or 'webp'
    data_v2 = {
        'prompt': prompt,
        'output_format': os.environ.get('STABILITY_OUTPUT_FORMAT', 'png')
    }
    # include dims/steps if caller provided them (some v2 endpoints accept these)
    try:
        data_v2['width'] = str(int(width))
        data_v2['height'] = str(int(height))
        data_v2['steps'] = str(int(steps))
        data_v2['samples'] = str(int(samples))
    except Exception:
        pass

    async with httpx.AsyncClient(timeout=httpx.Timeout(timeout_seconds, connect=10.0)) as client:
        try:
            # Use multipart form as in Stability examples; files param is required
            # by some Stability endpoints even if empty.
            files = { 'none': '' }
            r = await client.post(v2_url, headers=headers_v2, files=files, data=data_v2)
            if r.status_code == 200:
                # infer mime type from response header
                ct = r.headers.get('content-type', 'image/png')
                b64 = base64.b64encode(r.content).decode('utf-8')
                return [f'data:{ct};base64,{b64}']
            # if non-200, fall through to platform endpoint below
            # capture response for diagnostics
            v2_err = f'v2beta error {r.status_code}: {r.text[:1000]}'
        except Exception as e:
            v2_err = str(e)

    # Fallback to older Stability Platform text-to-image endpoint if v2beta
    # didn't work or is not available for this account.
    model_id = model or STABILITY_MODEL
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
            # include body for diagnostics, prefer v2 error if available
            msg = r.text[:1000]
            if 'v2_err' in locals():
                msg = f'v2_err={v2_err} ; platform_err={msg}'
            raise Exception(f'Stability API error {r.status_code}: {msg}')
        data = r.json()

    # extract base64 artifacts defensively (same as before)
    images = []
    try:
        arts = data.get('artifacts') or data.get('artifacts', [])
        if not arts and isinstance(data, dict):
            arts = data.get('output', {}).get('artifacts') or []
    except Exception:
        arts = []

    if not arts:
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
