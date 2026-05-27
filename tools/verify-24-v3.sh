#!/bin/bash
# Quick validation of joke #24 V3
VIDEO=$1
OUT_DIR="/home/kevin/.openclaw/workspace/dadtasticdads-output"

echo "=== Validation for 24-video-V3.mp4 ==="

# Extract frame at 2s (text should be visible)
ffmpeg -y -ss 2 -i "$VIDEO" -vframes 1 -q:v 2 "$OUT_DIR/24-v3-setup.jpg" 2>/dev/null

# Extract frame at 4.5s (punchline or continuation)
ffmpeg -y -ss 4.5 -i "$VIDEO" -vframes 1 -q:v 2 "$OUT_DIR/24-v3-punch.jpg" 2>/dev/null

# Check video duration
DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$VIDEO")
echo "Duration: ${DURATION}s (should be ~5.7s)"

# Check file size
SIZE=$(ls -h "$VIDEO" | awk '{print $5}')
echo "File size: $SIZE"

# Verify audio exists
HAS_AUDIO=$(ffprobe -v error -show_entries stream=codec_type -select_streams a -of default=noprint_wrappers=1:nokey=1 "$VIDEO")
echo "Has audio: $HAS_AUDIO"

# List extracted frames
echo "Frames extracted:"
ls -lh "$OUT_DIR/24-v3-"*.jpg

echo ""
echo "Manual check: Open these frames to verify text is correct"
echo "  Setup (2s):  $OUT_DIR/24-v3-setup.jpg"
echo "  End (4.5s):  $OUT_DIR/24-v3-punch.jpg"
