#!/usr/bin/env python3
"""
Helper to download an HF model snapshot into a local directory using huggingface_hub.
This is optional and meant to help users set up local-diffusers for offline use.
"""
import os
import sys

def download(repo_id, dest_dir):
    try:
        from huggingface_hub import snapshot_download
    except Exception as e:
        print('Please pip install huggingface_hub. Error:', e)
        return 2
    os.makedirs(dest_dir, exist_ok=True)
    print('Downloading', repo_id, 'to', dest_dir)
    snapshot_download(repo_id=repo_id, cache_dir=dest_dir, local_dir=dest_dir)
    print('Done')
    return 0

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Usage: download_model.py <repo_id> <dest_dir>')
        sys.exit(1)
    repo_id = sys.argv[1]
    dest_dir = sys.argv[2]
    sys.exit(download(repo_id, dest_dir))
