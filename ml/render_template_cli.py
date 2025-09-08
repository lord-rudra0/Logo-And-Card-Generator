#!/usr/bin/env python3
import sys
import json
from pathlib import Path
from io import BytesIO
import base64
try:
    from local_templates import render_template, list_templates
except Exception:
    # try relative import when executed from repo root
    from ml.local_templates import render_template, list_templates

def calc_font_size(img_bytes):
    # simple heuristic: scale font by image width
    try:
        from PIL import Image
        img = Image.open(BytesIO(img_bytes))
        w, h = img.size
        # base size relative to width
        return max(16, int(w / 30))
    except Exception:
        return 24

def main():
    # read JSON payload from stdin
    try:
        payload = json.load(sys.stdin)
    except Exception:
        payload = {}

    template_name = payload.get('template_name') or payload.get('name')
    fields = payload.get('fields') or payload.get('fields', {}) or payload

    if not template_name:
        # try pick first template
        templates = list_templates()
        if not templates:
            print(json.dumps({'error':'no templates available'}))
            sys.exit(1)
        template_name = templates[0]

    # load template bytes to compute font size
    try:
        from ml.local_templates import load_template_bytes
        img_bytes = load_template_bytes(template_name)
    except Exception:
        try:
            img_bytes = None
        except Exception:
            img_bytes = None

    font_size = calc_font_size(img_bytes) if img_bytes else 24

    try:
        out = render_template(template_name, fields, font_size=font_size)
        b64 = base64.b64encode(out).decode('ascii')
        data_url = f'data:image/png;base64,{b64}'
        print(json.dumps({'images':[data_url], 'template': template_name}))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(2)

if __name__ == '__main__':
    main()
