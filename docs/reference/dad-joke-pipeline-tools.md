### Dad Joke Video Pipeline (Updated 2026-03-11 - Production Ready ✅)

**Joke Structure Detection:**
- **One-liner**: Single sentence (may have comma break)
  - Example: "I'm so good at sleeping I can do it with my eyes closed!"
  - Treatment: Text appears once, no pause, continuous audio
  
- **Setup-Punchline**: Two sentences or comma-separated parts
  - Example: "This is my step ladder. I never knew my real ladder."
  - Treatment: Setup shows first, pause, punchline reveals
  
- **Multi-line**: 3+ sentences
  - LLM identifies setup vs punchline structure
  - Pause before punchline reveal

**Key Rules:**
- Text NEVER repeats in video (was bug in #15)
- Use grammar parsing (sentence count) + LLM analysis
- Comma may indicate setup/punchline break — always confirm with LLM
- Audio timing: slight pause for multi-segment, continuous for one-liner

**File Naming (Versioned):**
- Format: `{joke_id}-V{n}.mp4` (e.g., `dadjoke-15-V1.mp4`, `dadjoke-15-V2.mp4`)
- Increment version on each regeneration
- Keep HQ (uncompressed) — compression degrades quality significantly

**Network Config:**
- Use `msi` hostname (not hardcoded IPs like `192.168.1.33`)
- Fallback: `100.124.40.24` (tailscale) if msi unreachable

**Quality Settings:**
- Video: H.264 High Profile, ~1.8 Mbps (uncompressed)
- Audio: AAC LC, ~320 kbps
- Expected size: ~1.5-2MB for 720x1280 @ 7s
- Compression to 100KB degrades quality — avoid unless explicitly requested

**MinIO Upload:**
- Bucket: `dadjokes` (not `dadtasticdads`)
- Path: `hp1/dadjokes/{id}/dadjoke-{id}-{date}.mp4`

**Verification (Required):**
- ALWAYS use **qwen3.5:cloud** vision to verify before sending:
- Check: Text correct? Background generated (not solid color)? AI artifacts (ghosting, weird text, etc.)?

**Vision Model - CRITICAL:**
- **ALWAYS use:** `qwen3.5:cloud` via Ollama (NOT OpenAI/Claude/other)
- **Why:** AI-generated images from SD need qwen3.5 for accurate artifact detection
- **DO NOT USE:** OpenClaw `image` tool (uses wrong provider)

**Validation Command:**
```bash
# Extract frames
ffmpeg -y -i video.mp4 -ss 2 -vframes 1 -update 1 setup.png
ffmpeg -y -i video.mp4 -ss 4 -vframes 1 -update 1 punchline.png

# Verify with qwen3.5:cloud (NOT openclaw image tool)
curl -s http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.5:cloud",
    "prompt": "Analyze this AI-generated image for artifacts: text hallucination, ghosting, distorted shapes, weird geometry. Describe what you see.",
    "images": ["'"$(base64 -w0 setup.png)"'"],
    "stream": false
  }' | jq -r '.response'
```

**In Auto-Runner:**
```javascript
// Use qwen3.5:cloud for vision validation (NOT openclaw image)
const visionResult = await ollamaGenerate({
  model: 'qwen3.5:cloud',
  prompt: 'Analyze for AI artifacts...',
  images: [base64Image]
});
```

**Common Bugs & Fixes:**
| Issue | Symptom | Fix |
|-------|---------|-----|
| Props escaping | Text shows "text" literal | Use `--props-file` flag, not inline JSON |
| **"Loading joke..." text** | Default props used instead of passed props | Use absolute path for `--props-file=/full/path/props.json` |
| Missing image | Solid blue background | Check `msi:7860` reachable, increase SD timeout |
| Wrong host | Ollama/SD unreachable | Use `msi` hostname, not `192.168.1.33` |
| Text repetition | Setup + punchline both show | One-liner: single segment at 0% |
| File too large | 1.9MB vs 150KB expected | Remotion renders HQ by default — don't compress |
| **Audio starts immediately** | No silence buffer at start | Pad audio: `1s silence + audio + 1s silence` (total ~5.7s) |
| **'Ian' reads as 'Jan'** | Sans-serif fonts (I↔J confusion) | Use serif font: `Georgia, serif` (distinct capital I) |
| **Text not rendering** | Blank video, no overlay | Check `SegmentText.tsx` props, clear `.remotion` cache |
| **Wrong color** | Punchline not orange | Verify `textColor = '#FF8A2B'` in SegmentText |
| **ElevenLabs not working** | Silent audio | Use direct curl API, props file has correct `audio.mp3` path |

**Production Pipeline (Tested 2026-03-11 - Joke #22 ✅, Updated 2026-03-23 - n8n Image Gen):**

1. **Fetch joke from Dadabase** (n8n webhook preferred):
   ```bash
   curl -X POST "https://n8n.wolfeinkc.uk/webhook/b33fd5b7-e682-4309-a454-3c4180029743" \
     -H "Content-Type: application/json" \
     -d '{"action": "next_unused_joke"}' \
     -o /tmp/next-joke.json
   # Parse: {"id": 32, "joke": "text", "used": false}
   ```

2. **Classify structure** (setup-punchline vs one-liner):
   ```bash
   # 2 sentences = setup-punchline, 1 sentence = one-liner
   # Confirm with LLM: "Split this joke into setup and punchline"
   ```

3. **Generate ElevenLabs audio** (George voice, warm male):
   ```bash
   curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb" \
     -H "xi-api-key: $ELEVENLABS_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"text": "JOKETEXT", "model_id": "eleven_multilingual_v2"}' \
     --output audio.mp3
   ```

4. **Pad audio** (1s start + 1s end silence):
   ```bash
   ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 1 silence_start.mp3
   ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 1 silence_end.mp3
   ffmpeg -i silence_start.mp3 -i audio.mp3 -i silence_end.mp3 \
     -filter_complex "[0][1][2]concat=n=3:v=0:a=1" padded_audio.mp3
   # Total duration: ~5.7s (3.7s joke + 2s buffers)
   ```

5. **Generate image via n8n webhook** (Step 4 - NEW 2026-03-23):
   ```bash
   curl -X POST "https://n8n.w⚠️olfeinkc.uk/webhook/generate-image" \
     -H "Content-Type: application/json" \
     -d '{"prompt": "WHIMSICAL_3D_CARTOON_PROMPT", "width": 512, "height": 768, "steps": 25}' \
     -o /tmp/n8n-image-response.json
   
   # CRITICAL: Response is {"images":["base64data"]} - use .images[0] NOT .image
   cat /tmp/n8n-image-response.json | jq -r '.images[0]' | base64 -d > {id}-background.png
   
   # Upload to MinIO
   mc cp {id}-background.png minio-hp1/dadjokes/{id}/{id}-background.png
   ```
   **Gotcha:** JSON field is `.images` (array), not `.image` - wrong field = 3-byte corrupt file
   **Steps:** Optional, defaults to 20, use 25 for better quality
   **Dimensions:** 512x768 portrait
   **Prompt:** Use "whimsical 3D cartoon, no text, family-friendly" style

**VALIDATION (Step 4a - MANDATORY):**
```bash
# Check image for AI visual artifacts before rendering
# MUST use Qwen3.5:cloud (has vision capabilities) - Do NOT use OpenAI or other providers
curl -s http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.5:cloud",
    "prompt": "Analyze this image for AI artifacts: text hallucination (random letters/words), ghosting/doubling, distorted shapes, weird geometry, inconsistent lighting, color bleeding, or semantic confusion (objects merging incorrectly). Describe what you see.",
    "images": ["'"$(base64 -w0 {id}-background.png)"'"],
    "stream": false
  }' | jq -r '.response'

# If artifacts detected, regenerate image with stronger negative prompt
# Expected: "Clean cartoon illustration, no text visible, no artifacts, consistent lighting"
```

**AI Image Artifacts to Check For:**

| Artifact Type | What to Look For | Example |
|---------------|------------------|---------|
| **Text hallucination** | Random letters, words, symbols in background | "BANK" appearing on building |
| **Ghosting/doubling** | Blurry duplicate shapes or objects | Two overlapping tree trunks |
| **Distorted anatomy** | Warped faces, extra limbs, melted objects | Columns that bend unnaturally |
| **Inconsistent lighting** | Multiple shadow directions, unnatural highlights | Shadows pointing different ways |
| **Weird geometry** | Impossible angles, warped perspective | Building corners at wrong angles |
| **Pattern repetition** | Tiled/clone-stamped areas | Identical leaves repeated |
| **Color bleeding** | Colors seeping into wrong areas | Green dollar bills bleeding into sky |
| **Semantic confusion** | Objects merging incorrectly | Tree branches becoming money |

**Critical:** Use `qwen3.5:cloud` model ONLY - it has vision capabilities. Do NOT use OpenAI or other providers.

6. **Copy assets to Remotion public/**:
   ```bash
   cp padded_audio.mp4 dadtasticdads-remotion/public/audio.mp3
   cp background.png dadtasticdads-remotion/public/background.png
   ```

7. **Render with Remotion** (duration from audio, not hardcoded):
   ```bash
   # Calculate duration from audio file
   AUDIO_DURATION=$(ffprobe -v error -show_entries format=duration -of default=nw=1 audio.mp3)
   DURATION_FRAMES=$(python3 -c "print(int(float('$AUDIO_DURATION') * 30))")
   
   # Create props.json with correct segments
   PROPS_FILE=$(pwd)/props.json
   cat > $PROPS_FILE << EOF
   {"joke":"JOKETEXT","format":"setup-punchline","segments":[
     {"text":"SETUP","atPercent":0.175,"display":"fade-in"},
     {"text":"PUNCHLINE","atPercent":0.73,"display":"pop-in"}
   ]}
   EOF
   
   # Clear cache and render (use absolute path for props file)
   rm -rf .remotion
   npx remotion render "DadJokeVideo" "DadJokeVideo" \
     "../output/{id}-video.mp4" \
     --props-file=$PROPS_FILE \
     --duration-in-frames=$DURATION_FRAMES
   ```
   **Critical:** Use absolute path for `--props-file` (not relative) and clear `.remotion` cache

8. **Validate video text** (MANDATORY - extract frames, verify with vision):
   ```bash
   # Extract setup frame (at 35% of video)
   ffmpeg -y -ss 2 -i {id}-video.mp4 -vframes 1 setup-frame.png 2>&1 | tail -2
   
   # Extract punchline frame (at 73% of video)
   ffmpeg -y -ss 4.5 -i {id}-video.mp4 -vframes 1 punchline-frame.png 2>&1 | tail -2
   
   # Verify text with Qwen3.5:cloud vision model - Do NOT use OpenAI or other providers
   curl -s http://localhost:11434/api/generate \
     -H "Content-Type: application/json" \
     -d '{
       "model": "qwen3.5:cloud",
       "prompt": "What text is visible in these frames? Read it exactly. Also check for any AI visual artifacts like ghosting or distorted shapes.",
       "images": ["'"$(base64 -w0 setup-frame.png)"'", "'"$(base64 -w0 punchline-frame.png)"'"],
       "stream": false
     }' | jq -r '.response'
   
   # Expected: Setup shows first part, punchline shows second part
   # If "Loading joke..." appears, props weren't passed correctly - re-render with --props-file
   ```
   **Critical:** Use `qwen3.5:cloud` ONLY - has vision capabilities. Do NOT use OpenAI or other providers. Don't proceed to upload until validation passes.

9. **Upload to MinIO** (versioned: joke-22-V15.mp4):
   ```bash
   mc cp video.mp4 hp1/dadjokes/22/joke-22-V15.mp4
   ```

10. **Upload to YouTube** (Private, auto-generated title):
    ```bash
    python3 skills/youtube-uploader/scripts/youtube-upload.py upload \
      --file video.mp4 --title "Dad Joke #22 - ..."\ 
      --privacy private
    ```

11. **Update Dadabase** (Used=TRUE, Posted=TRUE):
    ```bash
    gog sheets update SHEET_ID "Sheet1!C22" "TRUE"  # Used
    gog sheets update SHEET_ID "Sheet1!D22" "TRUE"  # Posted
    ```

**Files:**
- Script: `dadtasticdads-remotion/scripts/generate-dadjoke-video-v3.js`
- Output: `dadtasticdads-output/`
- Docs: `dadtasticdads-remotion/PRODUCTION-RUNBOOK.md`
- Auto-runner: `tools/auto-dadjoke-runner.js` (scheduled 6 AM daily via `cron/auto-dadjoke.json`)
