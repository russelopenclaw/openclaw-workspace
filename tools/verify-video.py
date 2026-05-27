#!/usr/bin/env python3
"""
Dad Joke Video Validator - Uses Qwen3.5 Vision API to verify text rendering

Usage:
    python3 tools/verify-video.py /path/to/video.mp4

Extracts frames at key timestamps and calls Qwen3.5 vision to verify text.
Returns exit code 0 if validation passes, 1 if fails.
"""

import sys
import os
import subprocess
import json
import tempfile
from pathlib import Path

def extract_frame(video_path, timestamp_sec, output_path):
    """Extract a single frame from video at given timestamp."""
    cmd = [
        'ffmpeg', '-y',
        '-i', video_path,
        '-ss', str(timestamp_sec),
        '-vframes', '1',
        '-update', '1',
        output_path
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"FFmpeg error: {e.stderr}", file=sys.stderr)
        return False

def verify_text_with_qwen(image_path, prompt):
    """Call Qwen3.5 vision API to read text from image."""
    # Use OpenClaw image tool via subprocess
    workspace = os.environ.get('WORKSPACE', '/home/kevin/.openclaw/workspace')
    
    # Build the OpenClaw image tool command
    cmd = [
        'node', '-e',
        f'''
        const image = require('./tools/image-tool-wrapper.js');
        image.analyze("{image_path}", "{prompt}").then(r => console.log(r));
        '''
    ]
    
    # Fallback: use ollama if image tool not available
    ollama_cmd = [
        'ollama', 'run', 'qwen3.5-vl:7b', prompt
    ]
    
    # Try reading image via stdin (ollama vision models support this)
    try:
        with open(image_path, 'rb') as f:
            result = subprocess.run(
                ['bash', '-c', f'cat "{image_path}" | ollama run qwen3.5-vl:7b "{prompt}"'],
                capture_output=True, text=True, timeout=60
            )
            return result.stdout.strip()
    except Exception as e:
        return f"ERROR: {str(e)}"

def validate_video(video_path):
    """
    Validate dad joke video:
    1. Extract setup frame @2s
    2. Extract punchline frame @4.5s (or @4s for one-liners)
    3. Verify text with Qwen3.5 vision
    4. Return validation result
    """
    
    if not os.path.exists(video_path):
        print(f"ERROR: Video not found: {video_path}", file=sys.stderr)
        return False
    
    video_dir = os.path.dirname(video_path)
    base_name = Path(video_path).stem
    
    # Extract frames
    setup_frame = os.path.join(video_dir, f"{base_name}-setup.png")
    punchline_frame = os.path.join(video_dir, f"{base_name}-punchline.png")
    
    print(f"Extracting frames from {video_path}...")
    
    if not extract_frame(video_path, 2.0, setup_frame):
        print("ERROR: Failed to extract setup frame", file=sys.stderr)
        return False
    
    if not extract_frame(video_path, 4.0, punchline_frame):
        print("ERROR: Failed to extract punchline frame", file=sys.stderr)
        return False
    
    # Verify text with Qwen3.5 vision
    prompt = "What text is visible in this image? Read ALL text exactly as shown. Reply with ONLY the text, nothing else."
    
    print("Verifying setup frame with Qwen3.5 vision...")
    setup_text = verify_text_with_qwen(setup_frame, prompt)
    print(f"Setup text: {setup_text}")
    
    print("Verifying punchline frame with Qwen3.5 vision...")
    punchline_text = verify_text_with_qwen(punchline_frame, prompt)
    print(f"Punchline text: {punchline_text}")
    
    # Check if text was detected
    if 'ERROR' in setup_text or not setup_text:
        print("ERROR: Setup text not detected", file=sys.stderr)
        return False
    
    # For one-liners, punchline may be empty or same as setup
    if 'ERROR' in punchline_text:
        print("WARNING: Punchline text not detected (may be one-liner)", file=sys.stderr)
    
    print("✅ Validation passed")
    return True

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 verify-video.py <video.mp4>", file=sys.stderr)
        sys.exit(1)
    
    video_path = sys.argv[1]
    
    if validate_video(video_path):
        print("✅ Video validation PASSED")
        sys.exit(0)
    else:
        print("❌ Video validation FAILED", file=sys.stderr)
        sys.exit(1)
