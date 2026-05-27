# Dad Joke Pipeline - Production Runbook (2026-03-11)

**Status:** ✅ PRODUCTION READY (Tested on Joke #22)

**Schedule:** Daily at 6:00 AM America/Chicago via `cron/auto-dadjoke.json`

---

## Overview

Auto-generates dad joke videos with:
- ElevenLabs TTS (George voice - warm male narrator)
- Stable Diffusion background (wizard/theme-related, no text)
- Remotion text overlays (Georgia serif font for I/J distinction)
- 1-second audio buffers at start/end (total 5.7s duration)
- **Auto-upload to YouTube (Private)**
- **Telegram notification after upload**
- **Version tracking with regeneration support**
- Dadabase tracking (Used/Posted flags)

**Workflow Change (2026-03-16):** Videos auto-upload to YouTube as Private. Kevin reviews via Telegram link. Regenerations delete previous YouTube video and upload new version.

---

## Pipeline Steps

### 1. Fetch Next Joke from Dadabase

```bash
glasses_id="1cXSGjCXleUK8iQweBAwLaa7j3QK2Sla-8v11CirQsuw"
gog sheets get $spreadsheet_id "Sheet1!A:D" | grep "FALSE" | head -1
# Look for first row where Column C (Used) = FALSE
# Extract: Joke ID (col A), Joke text (col B)
```

**Example output:**
```
22  What do you call a magician who has lost their magic? Ian.  FALSE  FALSE
```

---

### 2. Classify Joke Structure

**One-liner:** Single sentence
- Example: "I'm so good at sleeping I can do it with my eyes closed!"
- Text: Appears once, no pause, continuous audio

**Setup-Punchline:** Two sentences or question-answer
- Example: "What do you call a magician who has lost their magic? Ian."
- Setup: Appears at 17% (1s into video)
- Punchline: Appears at 73% (4.2s into video)

**Validation:**
```bash
python3 -c "
joke = 'YOUR_JOKETEXT'
sentences = joke.count('.') + joke.count('!') + joke.count('?')
print('SETUP_PUNCHLINE' if sentences >= 2 else 'ONE_LINER')
"
```

---

### 3. Generate ElevenLabs Audio

**API endpoint:** George voice (`JBFqnCBsd6RMkjVDRZzb`)

```bash
export ELEVENLABS_API_KEY="sk_2c86803a3f4ec344ea132627832d319bc3c7af64b339c103"
joke_text="What do you call a magician who has lost their magic? Ian."

curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"text\": \"$joke_text\",
    \"model_id\": \"eleven_multilingual_v2\",
    \"voice_settings\": {\"stability\": 0.5, \"similarity_boost\": 0.75}
  }" \
  --output audio-original.mp3

# Duration should be ~3.7s
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1 audio-original.mp3
```

---

### 4. Pad Audio (1s Start + 1s End)

**Critical:** Audio MUST have silence buffers for proper timing.

```bash
# Create 1s silence files
ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 1 silence_start.mp3 -y 2>/dev/null
ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 1 silence_end.mp3 -y 2>/dev/null

# Concatenate: silence + original + silence
ffmpeg -y \
  -i silence_start.mp3 \
  -i audio-original.mp3 \
  -i silence_end.mp3 \
  -filter_complex "[0][1][2]concat=n=3:v=0:a=1[a]" \
  -map "[a]" \
  audio-padded.mp3

# Verify: Should be ~5.7s (3.7s + 2s buffers)
ffprobe -v error -show_entries format=duration -of default=nw=1 audio-padded.mp3
# Expected: 5.715193
```

---

### 5. Generate Image via n8n Webhook (Step 4 - Updated 2026-03-23)

**Endpoint:** https://n8n.w⚠️olfeinkc.uk/webhook/generate-image

```bash
prompt="Whimsical 3D cartoon illustration of [SUBJECT], bright sunny day, vibrant colors, family-friendly, no text"

curl -X POST "https://n8n.w⚠️olfeinkc.uk/webhook/generate-image" \
  -H "Content-Type: application/json" \
  -d "{
    \"prompt\": \"$prompt\",
    \"width\": 512,
    \"height\": 768,
    \"steps\": 25
  }" \
  -o /tmp/n8n-image-response.json

# CRITICAL: Response is {"images":["base64data"]} - use .images[0] NOT .image
cat /tmp/n8n-image-response.json | jq -r '.images[0]' | base64 -d > background.png

# Verify: Should be 500KB-1MB PNG
ls -lh background.png
file background.png

# Upload to MinIO
mc cp background.png minio-hp1/dadjokes/{id}/{id}-background.png
```

**Gotcha:** JSON field is `.images` (array), not `.image` - wrong field = 3-byte corrupt file
**Steps:** Optional, defaults to 20, use 25 for better quality
**Dimensions:** 512x768 portrait

### 5a. Image Validation (MANDATORY - Before Rendering)

**Model:** MUST use `qwen3.5:cloud` - has vision capabilities. Do NOT use OpenAI or other providers.

```bash
# Check for AI visual artifacts using Qwen3.5:cloud
curl -s http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.5:cloud",
    "prompt": "Analyze this image for AI artifacts: text hallucination (random letters/words), ghosting/doubling, distorted shapes, weird geometry, inconsistent lighting, color bleeding, or semantic confusion (objects merging incorrectly). Describe what you see.",
    "images": ["'"$(base64 -w0 background.png)"'"],
    "stream": false
  }' | jq -r '.response'

# Expected: "Clean cartoon illustration, no text visible, no artifacts, consistent lighting"
# If artifacts detected: Regenerate with stronger negative prompt
```

**AI Image Artifacts to Check For:**

| Artifact Type | What to Look For | Example |
|---------------|------------------|---------|
| **Text hallucination** | Random letters, words, symbols | "BANK" appearing on building |
| **Ghosting/doubling** | Blurry duplicate shapes | Two overlapping tree trunks |
| **Distorted anatomy** | Warped faces, extra limbs | Columns that bend unnaturally |
| **Inconsistent lighting** | Multiple shadow directions | Shadows pointing different ways |
| **Weird geometry** | Impossible angles, warped perspective | Building corners at wrong angles |
| **Pattern repetition** | Tiled/clone-stamped areas | Identical leaves repeated |
| **Color bleeding** | Colors seeping into wrong areas | Green bills bleeding into sky |
| **Semantic confusion** | Objects merging incorrectly | Tree branches becoming money |

**Why:** SD often hallucinates text, ghosting, and warped geometry - catch before rendering video

---

### 6. Copy Assets to Remotion

```bash
cp audio-padded.mp3 dadtasticdads-remotion/public/audio.mp3
cp background.png dadtasticdads-remotion/public/background.png
```

**Important:** Remotion looks for these exact filenames in `public/` directory.

---

### 7. Create Props JSON

```bash
cat > props.json << EOF
{
  "joke": "What do you call a magician who has lost their magic? Ian.",
  "format": "setup-punchline",
  "segments": [
    {"text": "What do you call a magician who has lost their magic?", "atPercent": 0.175, "display": "fade-in"},
    {"text": "Ian.", "atPercent": 0.73, "display": "pop-in"}
  ],
  "audioUrl": "audio.mp3",
  "imageUrl": "background.png"
}
EOF
```

**Key fields:**
- `atPercent: 0.175` = Setup appears at 1s (17.5% of 5.7s)
- `atPercent: 0.73` = Punchline appears at 4.2s (73% of 5.7s)
- `display: "fade-in"` for setup, `"pop-in"` for punchline

---

### 8. Calculate Duration from Audio

**Duration must match audio, not hardcoded:**

```bash
AUDIO_DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 public/audio.mp3)
DURATION_FRAMES=$(python3 -c "print(int(float('$AUDIO_DURATION') * 30))")
echo "Duration: ${AUDIO_DURATION}s = ${DURATION_FRAMES} frames @30fps"
```

---

### 9. Render with Remotion

**Critical:** Use `--props-file` (not inline `--props`) and clear cache:

```bash
cd dadtasticdads-remotion
rm -rf .remotion  # Clear cache to ensure rebuild

npx remotion render \
  "DadJokeVideo" \
  "DadJokeVideo" \
  "../dadtasticdads-output/{id}-video.mp4" \
  --props-file=props.json \
  --duration-in-frames=$DURATION_FRAMES \
  --fps=30 \
  --width=720 \
  --height=1280

# Output: ~2MB H.264 video
ls -lh ../dadtasticdads-output/{id}-video.mp4
```

**If text shows "Loading joke...":** Props weren't passed - check `--props-file` path

**SegmentText.tsx must have:**
```typescript
const fontFamily = 'Georgia, serif'; // Serif fonts have distinct I vs J
const textColor = position === 'setup' ? '#FFFFFF' : '#FF8A2B'; // Orange punchline
const fontWeight = '900';
const fontSize = position === 'setup' ? '56px' : '80px'; // Larger punchline
```

---

### 9. Validate Video Text (MANDATORY - Before Upload)

**Extract frames:**
```bash
# Setup frame (at 35% of video)
ffmpeg -y -ss 2 -i {id}-video.mp4 -vframes 1 setup-frame.png 2>&1 | tail -2

# Punchline frame (at 73% of video)
ffmpeg -y -ss 4.5 -i {id}-video.mp4 -vframes 1 punchline-frame.png 2>&1 | tail -2
```

**Validate with Qwen3.5:cloud vision model - Do NOT use OpenAI or other providers:**
```bash
curl -s http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.5:cloud",
    "prompt": "What text is visible in these frames? Read it exactly. Also check for any AI visual artifacts like ghosting or distorted shapes.",
    "images": ["'"$(base64 -w0 setup-frame.png)"'", "'"$(base64 -w0 punchline-frame.png)"'"],
    "stream": false
  }' | jq -r '.response'
```

**Expected:**
- Setup: First part of joke text
- Punchline: Second part (or full text for one-liners)
- No visual artifacts (ghosting, distortion, etc.)

**If "Loading joke..." appears:** Props weren't passed - re-render with `--props-file=$(pwd)/props.json`

**Don't proceed to upload until validation passes!**

---

### 10. Upload to MinIO

```bash
mc cp joke-22-V1.mp4 hp1/dadjokes/22/joke-22-V1.mp4

# Verify
mc ls hp1/dadjokes/22/
# Should show: background.png, audio.mp3, video.mp4
```

---

### 11. Send to Kevin for Approval (REQUIRED)

**DO NOT upload to YouTube without explicit approval.**

```bash
# Send video to Kevin via Telegram for review
python3 skills/youtube-uploader/scripts/youtube-upload.py review \
  --file dadtasticdads-output/joke-22-V1.mp4 \
  --joke-text "What do you call a magician who has lost their magic? Ian." \
  --target telegram:8177470832

# Wait for Kevin's approval reply before proceeding
# Kevin should reply with "approve", "yes", or "publish"
```

**Workflow:**
1. Video generated → Send to Kevin via Telegram
2. Kevin reviews (can watch, verify text/audio/quality)
3. Kevin replies "approve" / "yes" / "publish"
4. THEN upload to YouTube (Private initially, then Public)
5. Mark as Posted=TRUE in Dadabase

**Auto-runner integration:**
The `auto-dadjoke-runner.js` should:
- Generate video
- Send preview to Kevin (Telegram)
- **STOP and wait** for approval
- Only proceed to YouTube upload after approval received

---

### 12. Telegram Notification (Automatic)

Pipeline sends notification after every upload:

```
🆕 Dad Joke #22 Published

📝 "What do you call a magician who has lost their magic? Ian."

📺 YouTube: https://www.youtube.com/watch?v=VIDEO_ID
🔒 Privacy: Private (ready for review)
```

For regenerations:
```
🔄 (V2) Dad Joke #22 Published

📝 "What do you call a magician who has lost their magic? Ian."

📺 YouTube: https://www.youtube.com/watch?v=NEW_VIDEO_ID
🔒 Privacy: Private (ready for review)
Previous version deleted.
```

---

### 13. Update Dadabase

```bash
spreadsheet_id="1cXSGjCXleUK8iQweBAwLaa7j3QK2Sla-8v11CirQsuw"

# Mark Used=TRUE (column C, row 23 for joke 22)
gog sheets update $spreadsheet_id "Sheet1!C23" "TRUE"

# Mark Posted=TRUE (column D, row 23)
gills sheets update $spreadsheet_id "Sheet1!D23" "TRUE"

# Verify
glasses sheets get $spreadsheet_id "Sheet1!A23:D23"
# Should show: 22 | JOKETEXT | TRUE | TRUE
```

---

### 13. Log to Memory

```bash
cat >> memory/$(date +%Y-%m-%d).md << EOF

## Dad Joke #22 - PUBLISHED ($(date '+%Y-%m-%d %H:%M %p'))

**Joke:** "What do you call a magician who has lost their magic? Ian."

**Final Version:** V15 (Georgia font, 1s buffers, 5.7s)

**Published:**
- YouTube (Private): https://www.youtube.com/watch?v=VIDEO_ID
- Dadabase: Used=TRUE, Posted=TRUE
- MinIO: hp1/dadjokes/22/

**Next:** Joke #23 scheduled for 6 AM tomorrow
EOF
```

---

## Troubleshooting

### Text reads as "Jan" instead of "Ian."

**Cause:** Sans-serif fonts make capital I look like J.

**Fix:** Use serif font in SegmentText.tsx:
```typescript
const fontFamily = 'Georgia, serif';
```

### Audio starts immediately (no buffer)

**Cause:** Audio wasn't padded with silence.

**Fix:** Re-create padded audio:
```bash
ffmpeg -f lavfi -i anullsrc=...,silence_start.mp3
ffmpeg -i silence_start.mp3 -i audio.mp3 ...audio-padded.mp3
```

### Duration is 7.3s instead of 5.7s

**Cause:** Remotion using default 218 frames.

**Fix:** Update DadJokeVideo.tsx:
```typescript
durationInFrames={171} // 5.7s at 30fps
```

### Text not rendering

**Cause:** `.remotion` cache serving old bundle.

**Fix:** Clear cache before render:
```bash
rm -rf dadtasticdads-remotion/.remotion
```

### ElevenLabs silent audio

**Cause:** API key expired or wrong voice ID.

**Fix:** Re-test API call directly:
```bash
curl -X POST "https://api.elevenlabs.io/..." -H "xi-api-key: $KEY" ...
# Should return audio bytes, not error
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `tools/auto-dadjoke-runner.js` | Main automation script |
| `cron/auto-dadjoke.json` | 6 AM daily schedule |
| `dadtasticdads-remotion/src/SegmentText.tsx` | Text rendering component |
| `dadtasticdads-remotion/src/Dadjestotape` | Main composition (durationInFrames) |
| `dadtasticdads-remotion/public/audio.mp3` | Padded audio (5.7s) |
| `dadtasticdads-remotion/public/background.png` | SD background (720x1280) |
| `dadtasticdads-output/` | Rendered videos |
| `.learnings/DADJOKE-AUTO.log` | Runtime logs |

---

**Tested:** Joke #22 (2026-03-11) - All steps verified ✅
ified ✅
