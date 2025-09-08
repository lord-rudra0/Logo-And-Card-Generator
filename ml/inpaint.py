from typing import List, Tuple
from io import BytesIO
try:
    from PIL import Image, ImageDraw
    PIL_AVAILABLE = True
except Exception:
    PIL_AVAILABLE = False

try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except Exception:
    pytesseract = None
    TESSERACT_AVAILABLE = False

try:
    import cv2
    import numpy as np
    CV2_AVAILABLE = True
except Exception:
    cv2 = None
    np = None
    CV2_AVAILABLE = False

def detect_text_bboxes(img_bytes: bytes, min_confidence: int = 20) -> List[Tuple[int,int,int,int,str]]:
    """Return list of (x, y, w, h, text) for detected OCR text boxes using pytesseract.
    If pytesseract not available, return empty list.
    """
    if not PIL_AVAILABLE or not TESSERACT_AVAILABLE:
        return []
    try:
        img = Image.open(BytesIO(img_bytes)).convert('RGB')
        data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
        boxes = []
        n = len(data.get('level', []))
        for i in range(n):
            conf = data.get('conf', [])[i]
            try:
                conf_v = int(float(conf))
            except Exception:
                conf_v = -1
            text = (data.get('text', [''])[i] or '').strip()
            if text and conf_v >= min_confidence:
                x = int(data.get('left', [0])[i])
                y = int(data.get('top', [0])[i])
                w = int(data.get('width', [0])[i])
                h = int(data.get('height', [0])[i])
                boxes.append((x, y, w, h, text))
        return boxes
    except Exception:
        return []


def make_mask_from_boxes(img_bytes: bytes, boxes: List[Tuple[int,int,int,int,str]], pad: int = 6) -> bytes:
    """Create a binary mask PNG where text boxes are white (to be inpainted) and background is black.
    Returns PNG bytes. If PIL not available or no boxes, returns empty bytes.
    """
    if not PIL_AVAILABLE:
        return b''
    try:
        img = Image.open(BytesIO(img_bytes)).convert('RGBA')
        w, h = img.size
        mask = Image.new('L', (w, h), 0)
        draw = ImageDraw.Draw(mask)
        for (x, y, bw, bh, txt) in boxes:
            x0 = max(0, x - pad)
            y0 = max(0, y - pad)
            x1 = min(w, x + bw + pad)
            y1 = min(h, y + bh + pad)
            draw.rectangle([x0, y0, x1, y1], fill=255)
        out = BytesIO()
        mask.save(out, format='PNG')
        return out.getvalue()
    except Exception:
        return b''


def expand_boxes_by_ratio(boxes: List[Tuple[int,int,int,int,str]], ratio: float = 0.15) -> List[Tuple[int,int,int,int,str]]:
    # utility: expand box dims by ratio
    res = []
    for (x,y,w,h,t) in boxes:
        dx = int(w * ratio)
        dy = int(h * ratio)
        res.append((max(0, x-dx), max(0, y-dy), w+dx*2, h+dy*2, t))
    return res
