#!/bin/bash
# Regenerate joke #13 with correct text and pause

cd /home/kevin/.openclaw/workspace/dadtasticdads-output

# Create audio with 0.8s pause in middle + 1s buffers
# Since we only have the setup audio, we need to generate full audio
# For now, let's just add buffers to existing audio and note the pause issue

# Add 1s silence at start and end
ffmpeg -y -f lavfi -i "anullsrc=cl=mono:r=44100:d=1" /tmp/silence-start.mp3 -loglevel error
ffmpeg -y -f lavfi -i "anullsrc=cl=mono:r=44100:d=1" /tmp/silence-end.mp3 -loglevel error
ffmpeg -y -i /tmp/silence-start.mp3 -i 13-audio.mp3 -i /tmp/silence-end.mp3 -filter_complex "[0:a][1:a][2:a]concat=n=3:v=0:a=1" 13-audio-buffered.mp3 -loglevel error

DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 13-audio-buffered.mp3)

echo "Audio duration: ${DUR}s"

# Generate with CORRECT text for joke #13
python3 generate-video-TEMPLATE.py \
  --joke-id 13 \
  --image 13-background.png \
  --audio 13-audio-buffered.mp3 \
  --setup "This is my step" "ladder." "I never knew my real ladder." \
  --punchline "" "" "" 2>&1

echo ""
echo "Next: Need to regenerate audio with proper pause and full joke text"
