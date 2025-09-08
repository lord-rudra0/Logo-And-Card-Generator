import os
import base64
import httpx
from io import BytesIO
try:
    from PIL import Image
    PIL_AVAILABLE = True
except Exception:
    PIL_AVAILABLE = False


def _decode_data_url(data_url: str) -> bytes:
    if data_url.startswith('data:'):
        _, b64 = data_url.split(',', 1)
        return base64.b64decode(b64)
    return base64.b64decode(data_url)


def _encode_png_bytes_to_data_url(b: bytes) -> str:
    return 'data:image/png;base64,' + base64.b64encode(b).decode('utf-8')


async def super_resolve_via_hf(img_bytes: bytes, hf_token: str, hf_model: str = None) -> bytes:
    """Call a Hugging Face image-to-image / SR model via the Inference API.
    This is a simple wrapper: POST image bytes as multipart/form-data and
    return the raw image bytes from HF. Caller handles timeouts and errors.
    """
    if not hf_token:
        raise RuntimeError('Hugging Face token not configured')
    model = hf_model or os.environ.get('HF_SR_MODEL') or 'timbrooks/instruct-pix2pix'
    url = f'https://api-inference.huggingface.co/models/{model}'
    headers = {'Authorization': f'Bearer {hf_token}'}
    files = {'image': ('input.png', img_bytes, 'image/png')}
    data = {}
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(url, headers=headers, files=files, data=data)
        if r.status_code != 200:
            raise RuntimeError(f'HF SR failed: {r.status_code} {r.text[:200]}')
        return r.content


def super_resolve_local(img_bytes: bytes, scale: int = 2) -> bytes:
    """Attempt local Real-ESRGAN-based super-resolution if installed.
    This is a best-effort function and raises if dependencies are missing.
    """
    try:
        from realesrgan import RealESRGAN
    except Exception as e:
        raise RuntimeError('local Real-ESRGAN not available: ' + str(e))

    if not PIL_AVAILABLE:
        raise RuntimeError('Pillow required for local SR')

    img = Image.open(BytesIO(img_bytes)).convert('RGB')
    # default device; try cuda then cpu
    try:
        import torch
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
    except Exception:
        device = 'cpu'

    model = RealESRGAN(device, scale=scale)
    model.load_weights('RealESRGAN_x2plus.pth', download=True)
    out = model.predict(img)
    buf = BytesIO()
    out.save(buf, format='PNG')
    return buf.getvalue()


async def super_resolve(img_bytes: bytes, mode: str = 'hf') -> bytes:
    """Public helper: try local SR first (if mode=='local'), then HF fallback.
    mode: 'local' | 'hf' | 'auto'
    """
    if mode == 'local':
        return super_resolve_local(img_bytes)

    # default: prefer HF inference
    hf_token = os.environ.get('HUGGINGFACE_API_TOKEN') or os.environ.get('HF_TOKEN')
    try:
        return await super_resolve_via_hf(img_bytes, hf_token)
    except Exception:
        # fallback to local if available
        try:
            return super_resolve_local(img_bytes)
        except Exception as e:
            raise RuntimeError('Super-resolve failed (HF+local): ' + str(e))


def ocr_text_from_bytes(img_bytes: bytes) -> str:
    """Best-effort OCR using pytesseract if available."""
    try:
        from PIL import Image
        import pytesseract
    except Exception as e:
        raise RuntimeError('pytesseract not available: ' + str(e))

    img = Image.open(BytesIO(img_bytes)).convert('RGB')
    txt = pytesseract.image_to_string(img)
    return txt
