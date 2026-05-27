#!/bin/bash
# Validate Dad Jokes #32, #33, #34 with Qwen3.5:cloud vision

WORKSPACE="/home/kevin/.openclaw/workspace"
OUTPUT_DIR="$WORKSPACE/dadtasticdads-output"

echo "=== Validating Dad Jokes #32, #33, #34 ==="
echo ""

for joke_id in 32 33 34; do
    echo "--- Joke #$joke_id ---"
    
    video="$OUTPUT_DIR/${joke_id}-video-V1.mp4"
    setup_frame="$OUTPUT_DIR/${joke_id}-setup-validate.png"
    punch_frame="$OUTPUT_DIR/${joke_id}-punch-validate.png"
    
    if [ ! -f "$video" ]; then
        echo "❌ Video not found: $video"
        continue
    fi
    
    # Extract frames
    echo "Extracting frames..."
    ffmpeg -y -i "$video" -ss 2 -vframes 1 -update 1 "$setup_frame" 2>/dev/null
    ffmpeg -y -i "$video" -ss 4 -vframes 1 -update 1 "$punch_frame" 2>/dev/null
    
    echo "Frames extracted: $setup_frame, $punch_frame"
    
    # Validate with qwen3.5:cloud via sessions_spawn
    echo "Validating with qwen3.5:cloud vision..."
    
    # Create validation request
    cat > /tmp/validate-$joke_id.json << EOF
{
  "jokeId": $joke_id,
  "setupFrame": "$setup_frame",
  "punchlineFrame": "$punch_frame"
}
EOF
    
    echo "Request saved to /tmp/validate-$joke_id.json"
    echo ""
done

echo "=== Validation requests created ==="
echo "Run sessions_spawn with qwen3.5:cloud to analyze each"
