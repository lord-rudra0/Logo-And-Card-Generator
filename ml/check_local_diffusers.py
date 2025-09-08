#!/usr/bin/env python3
"""
Check local diffusers/torch availability and print installation hints.
"""
import sys
def check():
    ok = True
    try:
        import diffusers
    except Exception as e:
        print('diffusers import failed:', e)
        ok = False
    try:
        import torch
    except Exception as e:
        print('torch import failed:', e)
        ok = False
    try:
        import transformers
    except Exception as e:
        print('transformers import failed:', e)
        ok = False
    if ok:
        print('Local diffusers environment looks OK')
    else:
        print('\nRecommended install (conda recommended for GPU):')
        print('pip install --upgrade pip')
        print('pip install diffusers[torch] accelerate safetensors transformers')
        print('For GPU: pip install torch --index-url https://download.pytorch.org/whl/cu118')

if __name__ == "__main__":
    check()
