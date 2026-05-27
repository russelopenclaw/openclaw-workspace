# Dad Joke Video Pipeline - Complete Workflow

**Authoritative Guide** - Single source of truth for end-to-end dad joke video generation

**Last Updated:** 2026-03-12  
**Status:** ✅ Production Ready (Tested on Jokes #22, #23, #24)

---

## Overview

Automated pipeline that generates dad joke videos daily:
- **Source:** Google Sheets "Dadabase" (joke repository)
- **Audio:** ElevenLabs TTS (George voice - warm male narrator)
- **Visual:** Stable Diffusion background + Remotion text overlays
- **Output:** 720x1280 MP4 (5.7s, ~1.5MB)
- **Storage:** MinIO + YouTube (Private) + Dadabase tracking

**Schedule:** Daily at 6:00 AM America/Chicago via cron

---

## Pipeline State Machine

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│   BACKLOG   │────▶│ IN PROGRESS  │────▶│ PENDING APPROVAL│
│ (Unused in  │     │ (Generating  │     │ (Video sent to │
│   Dadabase) │     │   assets)    │     │  Kevin, queued)│
└─────────────┘     └──────────────┘     └───────────────┘
                                                  │
                              ┌───────────────────┤
                              │                   │
                    ┌─────────▼──────┐    ┌───────┴──────────┐
                    │  APPROVED      │    │     REJECTED     │
                    │ (Kevin replies │    │  (Kevin says no) │
                    │  "approve")    │    │                  │
                    └────────┬───────┘    └───────┬──────────┘
                             │                   │
                             ▼                   ▼
                    ┌──────────────┐     ┌───────────────┐
                    │   PUBLISH    │     │    SKIPPED    │
                    │ (YouTube +   │     │ (Mark unused, │
                    │  Dadabase)   │     │  next joke)   │
                    └──────────────┘     └───────────────┘
                             
                             │
                             ▼
                    ┌──────────────┐
                    │   COMPLETE   │
                    │ (Logged,     │
                    │  archived)   │
                    └──────────────┘
```

**Key Principles:**
1. **Resumable:** Pipeline can continue from any stage if interrupted
2. **Persistent queue:** `.pending-approvals.json` survives restarts
3. **Auto-check:** Heartbeat polls for Kevin's replies every cycle
4. **Timeout:** 24h without reply → auto-skip to next joke

**Approval Queue:**
- Saved after sending video to Kevin
- Checked every heartbeat (typically every 30 min)
- Cleared after Kevin replies or timeout

---

## Step-by-Step Workflow

### Phase 1: Fetch Next Joke

**Goal:** Get next unused joke from Dadabase

```bash
# Query Google Sheets for first unused joke spread_id="1cXSGjCXleUK8iQweBAwLaa7j3QK2Sla-8v11CirQsuw"
gog sheets get $spread_id "Sheet1!A:D" | \
  awk -F'\t' '$3 == "FALSE" && $4 != "TRUE" { print; exit }'

# Expected output:
# 24    Doctor you've got to help me, I'm addicted to Twitter. Doctor: I don't follow you.    FALSE    (empty)
```

**Parse:**
- Column A: Joke ID (e.g., `24`)
- Column B: Joke text
- Column C: Used flag (must be `FALSE`)
- Column D: Posted flag (must be empty or `FALSE`)

**State Check:**
```sql
-- If automation interrupted, check what's in-progress
SELECT id, title, column_name, assignee, updated_at 
FROM tasks 
WHERE title LIKE '%dadjoke%' 
  AND column_name = 'in-progress'
ORDER BY updated_at DESC LIMIT 1;
```

**If joke already has assets** (audio/background exist in `dadtasticdads-output/{id}-*`), skip to **Phase 3**.

---

### Phase 2: Generate Assets

#### 2.1 Classify Joke Structure

```bash
# Count sentences - ? or . or !
echo "Your joke text" | python3 -c "
import sys
text = sys.stdin.read().strip()
marks = text.count('?') + text.count('.') + text.count('!')
print('SETUP_PUNCHLINE' if marks >= 2 else 'ONE_LINER')
"
```

**Classification:**
- **One-liner:** Single sentence (may have comma break)
  - Example: "I'm so good at sleeping I can do it with my eyes closed!"
  - Timing: Text shows once, continuous
  
- **Setup-Punchline:** Two parts (question + answer, or statement + twist)
  - Example: "What do you call a bear with no teeth? A gummy bear."
  - Timing: Setup at 0%, Punchline at 50-70%

#### 2.2 Generate Background (Stable Diffusion)

```bash
OUTPUT_DIR=/home/kevin/.openclaw/workspace/dadtasticdads-output
JOKE_ID=24
JOKE_TEXT="Doctor you've got to help me, I'm addicted to Twitter. Doctor: I don't follow you."

# Generate SD prompt via LLM
PROMPT=$(ollama run llama3.1 "Generate a 1-sentence SD prompt for this dad joke. Cartoon, whimsical, no text: $JOKE_TEXT")

# Call Stable Diffusion API (msi:7860)
curl -X POST "http://msi:7860/sdapi/v1/txt2img" \
  -H "Content-Type: application/json" \
  -d "{
    \"prompt\": \"masterpiece, best quality, $PROMPT, cartoon, whimsical, vibrant, no text\",
    \"negative_prompt\": \"text, words, letters, watermark\",
    \"width\": 512,
    \"height\": 768,
    \"steps\": 20,
    \"sampler_name\": \"EULER\",
    \"seed\": -1
  }" | jq -r '.images[0]' | base64 -d > "$OUTPUT_DIR/$JOKE_ID-background-V1.png"

# Verify
ls -lh "$OUTPUT_DIR/$JOKE_ID-background-V1.png"
# Should be ~400-500KB
```

**Fallback:** If SD times out (msi unreachable), use cached background:
```bash
# Use previous success background
cp /home/kevin/.openclaw/workspace/dadtasticdads-remotion/public/background.png \
   "$OUTPUT_DIR/$JOKE_ID-background-V1.png"
```

#### 2.3 Generate Audio (ElevenLabs)

```bash
AUDIO_FILE="$OUTPUT_DIR/$JOKE_ID-audio-V1.mp3"
ELEVENLABS_KEY="sk_2c86803a3f4ec344ea132627832d319bc3c7af64b339c103"

# Write JSON payload (avoid shell escaping issues)
echo "{\"text\": \"$JOKE_TEXT\", \"model_id\": \"eleven_multilingual_v2\"}" > /tmp/tts-body.json

curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb" \
  -H "xi-api-key: $ELEVENLABS_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/tts-body.json \
  --output "$AUDIO_FILE"

# Add padding (1s start + 1s end silence)
ffmpeg -i "$AUDIO_FILE" \
  -af "apad=pad_dur=2, aspectralpad=pad_dur=1" \
  "$OUTPUT_DIR/$JOKE_ID-audio-padded-V1.mp3"

# Verify duration (should be ~5-7s with padding)
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1 "$OUTPUT_DIR/$JOKE_ID-audio-padded-V1.mp3"
```

**Critical:** Audio MUST have 1s silence at start + 1s at end for proper video sync.

---

### Phase 3: Render Video

```bash
REMOTION_PROJECT=/home/kevin/.openclaw/workspace/dadtasticdads-remotion
PUBLIC_DIR="$REMOTION_PROJECT/public"
OUTPUT_DIR=/home/kevin/.openclaw/workspace/dadtasticdads-output

# Copy assets to public folder (webpack requires this)
cp "$OUTPUT_DIR/$JOKE_ID-audio-padded-V1.mp3" "$PUBLIC_DIR/audio.mp3"
cp "$OUTPUT_DIR/$JOKE_ID-background-V1.png" "$PUBLIC_DIR/background.png"

# Clear Remotion cache
rm -rf "$REMOTION_PROJECT/.remotion"

# Calculate frames (audio duration + 2s padding) × 30fps
DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1 "$PUBLIC_DIR/audio.mp3")
FRAMES=$(echo "$DURATION + 2" | bc | awk '{printf "%d", $1 * 30}')

# Build props JSON
cat > "$REMOTION_PROJECT/props.json" << PROPS_EOF
{
  "jokeId": "$JOKE_ID",
  "jokeText": "$JOKE_TEXT",
  "audioUrl": "audio.mp3",
  "imageUrl": "background.png",
  "format": "$(echo $JTYPE | tr 'A-Z' 'a-z')",
  "segments": [
    {"text": "SETUP_TEXT", "atPercent": 0},
    {"text": "PUNCHLINE_TEXT", "atPercent": 0.5}
  ]
}
PROPS_EOF

# Render
cd "$REMOTION_PROJECT" && npx remotion render \
  "DadJokeVideo" "DadJokeVideo" "out/dadjoke-$JOKE_ID.mp4" \
  --props-file props.json \
  --public-dir "$PUBLIC_DIR" \
  --duration-in-frames $FRAMES \
  --fps 30 \
  --width 720 \
  --height 1280

# Copy to output
cp "$REMOTION_PROJECT/out/dadjoke-$JOKE_ID.mp4" "$OUTPUT_DIR/$JOKE_ID-video-V1.mp4"

# Verify (should be ~1.5MB, 720x1280, 5-7s)
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1 "$OUTPUT_DIR/$JOKE_ID-video-V1.mp4"
ls -lh "$OUTPUT_DIR/$JOKE_ID-video-V1.mp4"
```

**Expected Output:**
- Size: 1.5-2.0 MB
- Resolution: 720x1280
- Duration: audio duration + ~2s padding
- Codec: H.264 + AAC

---

### Phase 4: Send for Approval (**CRITICAL**)

**⚠️ NEVER upload to YouTube without Kevin's approval.**

**Auto-runner does this automatically:**

1. **Sends video to Kevin via Telegram** with message:
   ```
   🎬 Dad Joke #24 Ready for Review
   
   **Joke:** "Doctor you've got to help me, I'm addicted to Twitter..."
   
   **Video:** 1.61MB, 720x1280, Remotion render
   📹 Video file attached
   
   Reply:
   ✅ "approve" / "yes" / "publish" → Upload to YouTube (Private)
   ❌ "reject" / "no" → Skip this joke
   🔧 "revise: [feedback]" → Regenerate with fixes
   ```

2. **Saves to pending queue** (`.pending-approvals.json`):
   ```json
   {
     "queue": [{
       "jokeId": "24",
       "videoPath": "/workspace/dadtasticdads-output/24-video-V1.mp4",
       "messageId": "3480",
       "sentAt": "2026-03-12T06:01:00Z",
       "status": "pending"
     }]
   }
   ```

3. **Pipeline PAUSES** - does not proceed to YouTube

4. **Heartbeat checks every ~30 min** via `tools/dadjoke-approval-checker.js`:
   - Fetches recent Telegram messages
   - Parses Kevin's reply for intent
   - Executes action (approve/reject/fix)
   - Removes from queue when complete

**Kevin's reply options:**
| Reply | Action |
|-------|--------|
| "approve" / "yes" / "publish" / "go" | Upload to YouTube (Private), mark Posted=TRUE |
| "reject" / "no" / "skip" | Log rejection, skip to next joke |
| "fix: text is cut off" | Regenerate with specified fix, resend |
| (no reply >24h) | Auto-timeout, skip to next joke |

**Manual check (if needed):**
```bash
# Run approval checker manually
node /workspace/tools/dadjoke-approval-checker.js
```

**State:** Task set to `pending_approval` in PostgreSQL

---

### Phase 5: Publish (After Approval)

```bash
# Upload to MinIO (permanent storage)
mc cp "$OUTPUT_DIR/$JOKE_ID-video-V1.mp4" \
   hp1/dadjokes/$JOKE_ID/joke-$JOKE_ID-V1.mp4

# Upload to YouTube (Private initially)
python3 /home/kevin/.openclaw/workspace/skills/youtube-uploader/scripts/youtube-upload.py upload \
  --file "$OUTPUT_DIR/$JOKE_ID-video-V1.mp4" \
  --title "Dad Joke #$JOKE_ID - $(echo $JOKE_TEXT | cut -c1-40)..." \
  --description "$JOKE_TEXT #dadjokes #comedy" \
  --privacy private \
  --tags "dad joke,comedy,funny"

# Extract video ID from output
VIDEO_ID=<from youtube upload output>

# Mark as Posted=TRUE in Dadabase
gletsheets update $spread_id "Sheet1!D$JOKE_ID" "TRUE"

# Update task to COMPLETE
UPDATE tasks SET column_name='complete', updated_at=NOW()
WHERE id = <task-id>;

# Log to memory
cat >> /home/kevin/.openclaw/workspace/memory/$(date +%Y-%m-%d).md << EOF

## Dad Joke #$JOKE_ID - PUBLISHED ($(date '+%Y-%m-%d %H:%M %p'))

**Joke:** "$JOKE_TEXT"
**Video:** $OUTPUT_DIR/$JOKE_ID-video-V1.mp4 ($(ls -lh "$OUTPUT_DIR/$JOKE_ID-video-V1.mp4" | awk '{print $5}'))
**YouTube:** https://www.youtube.com/watch?v=$VIDEO_ID (Private)
**MinIO:** hp1/dadjokes/$JOKE_ID/
**Dadabase:** Used=TRUE, Posted=TRUE
EOF
```

**Optional:** After Kevin manually sets YouTube to Public, mark as PUBLIC:
```sql
UPDATE tasks SET metadata = jsonb_set(metadata, '{public}', 'true')
WHERE id = <task-id>;
```

---

### Phase 6: Error Handling & Recovery

#### If Generation Fails

**Scenario A:** Background generation fails (SD timeout)
```bash
# Fallback to cached background
cp /home/kevin/.openclaw/workspace/dadtasticdads-remotion/public/background.png \
   "$OUTPUT_DIR/$JOKE_ID-background-V1.png"
# Continue to audio generation
```

**Scenario B:** Audio generation fails (API error)
```bash
# Retry with simpler text escaping
# Or use cached audio from previous joke
cp "$OUTPUT_DIR/22-audio-V1.mp3" "$OUTPUT_DIR/$JOKE_ID-audio-V1.mp3"
```

**Scenario C:** Video render fails
```bash
# Check Remotion output
ls -la /home/kevin/.openclaw/workspace/dadtasticdads-remotion/out/
ls -la /home/kevin/.openclaw/workspace/dadtasticdads-remotion/DadJokeVideo.mp4

# If partial output, use it
# If no output, increment version and retry
npx remotion render ... --props-file props.json # with V2
```

#### If Approval Rejected

```bash
# Mark joke as skipped in Dadabase
gletsheets update $spread_id "Sheet1!C$JOKE_ID" "FALSE"  # Keep as unused

# Log rejection reason
cat >> /home/kevin/.openclaw/workspace/.learnings/DADIOKE-REJECTIONS.md << EOF

## Joke #$JOKE_ID - Rejected ($(date))

**Reason:** Kevin rejected
**Feedback:** <Kevin's feedback>
**Action:** Regenerate with fixes OR skip to next joke
EOF

# Pick next unused joke and restart at Phase 1
```

#### If Pipeline Interrupted

**Resume Strategy:**
1. Check Dadabase for jokes with `Used=TRUE, Posted=FALSE`
2. Check `dadtasticdads-output/` for existing assets
3. Resume at the phase where assets are complete

```bash
# Find interrupted jokes
gletsheets get $spread_id "Sheet1!A:D" | \
  awk -F'\t' '$3 == "TRUE" && ($4 == "FALSE" || $4 == "") { print }'

# For each, check assets
for id in 24 25 26; do
  ls -lh "$OUTPUT_DIR/$id-"*.{mp3,mp4,png} 2>/dev/null || echo "Missing assets for $id"
done

# If video exists but not posted, send for approval again
# If audio exists but no video, resume at Phase 3
# If nothing exists, restart at Phase 1
```

---

## Quick Reference

### File Locations

| Asset | Path |
|-------|------|
| Scripts | `/workspace/tools/auto-dadjoke-runner.js` |
| Remotion | `/workspace/dadtasticdads-remotion/` |
| Output | `/workspace/dadtasticdads-output/{id}-*.mp4` |
| MinIO | `hp1/dadjokes/{id}/joke-{id}-V1.mp4` |
| Logs | `/workspace/.learnings/DADIOKE-AUTO.log` |
| Props | `/workspace/dadtasticdads-remotion/props.json` |

### Key Commands

```bash
# Run auto pipeline (stops at approval)
node /workspace/tools/auto-dadjoke-runner.js

# Manual render (if you have assets ready)
cd /workspace/dadtasticdads-remotion && \
  npx remotion render "DadJokeVideo" "DadJokeVideo" "out/test.mp4" \
  --props-file props.json --duration-in-frames 171 --fps 30

# Upload to YouTube (only after approval!)
python3 /workspace/skills/youtube-uploader/scripts/youtube-upload.py upload \
  --file /workspace/dadtasticdads-output/24-video-V1.mp4 \
  --title "Dad Joke #24" --privacy private

# Update Dadabase
gletsheets update $spread_id "Sheet1!C{id}" "TRUE"  # Used
gletsheets update $spread_id "Sheet1!D{id}" "TRUE"  # Posted
```

### Quality Checks

| Check | Expected | If Fail |
|-------|----------|---------|
| Video Size | 1.5-2.0 MB | Re-render with correct duration |
| Resolution | 720x1280 | Check Remotion params |
| Duration | 5.7s ±1s | Check audio padding |
| Text Visible | "Ian" not "Jan" | Use Georgia serif font |
| Background | Not solid color | Check msi:7860 reachable |
| Audio Present | AAC stream | ElevenLabs API success |

---

## Troubleshooting Matrix

| Symptom | Probable Cause | Fix |
|---------|---------------|-----|
| "Cannot find module ./public/audio.mp3" | Wrong path in props | Use just filename, not full path |
| Text "Ian" shows as "Jan" | Sans-serif font | Use Georgia, serif |
| Video 7.3s not 5.7s | Wrong frame count | duration-in-frames=171 (30fps × 5.7s) |
| SD timeout | msi:7860 unreachable | Use cached background fallback |
| ElevenLabs silent | API key scope | Use direct curl, check key |
| Remotion cache stale | Old build artifacts | `rm -rf .remotion` before render |
| Shell syntax error | Apostrophe in text | Write JSON to file, use `@file` |
| Video shorter than audio | Padding not added | Add 1s start + 1s end silence |

---

## Decision Tree

```
START
  │
  ▼
┌─────────────────────────────────┐
│ Check Dadabase for unused joke  │
│ (Used=FALSE, Posted=empty)      │
└─────────────────────────────────┘
  │
  ├─ Found → Parse ID + text
  │
  └─ None → Exit (all caught up)
  
  │
  ▼
┌─────────────────────────────────┐
│ Check if assets already exist   │
│ (ls {ID}-*.mp3, png, mp4)       │
└─────────────────────────────────┘
  │
  ├─ None → Phase 2: Generate assets
  │         ├─ Background (SD)
  │         ├─ Audio (ElevenLabs)
  │         └─ Video (Remotion)
  │
  └─ Exists → Skip to Phase 4
  
  │
  ▼
┌─────────────────────────────────┐
│ Phase 4: Send to Kevin          │
│ (Telegram with video attached)  │
└─────────────────────────────────┘
  │
  │  PAUSE - WAIT FOR APPROVAL
  │
  ▼
┌─────────────────────────────────┐
│ Kevin's reply?                  │
└─────────────────────────────────┘
  │
  ├─ "approve"/"yes" → Phase 5: Publish
  │                    ├─ MinIO upload
  │                    ├─ YouTube (Private)
  │                    └─ Dadabase Posted=TRUE
  │
  ├─ "reject"/"no" → Phase 6: Error handling
  │                   ├─ Log reason
  │                   ├─ Mark skipped
  │                   └─ Next joke
  │
  └─ "revise: X" → Regenerate with fix
                   → Phase 4 again
  
  │
  ▼
COMPLETE → Log to memory → EXIT
```

---

## Idempotency & Resumability Rules

1. **Never delete assets** until pipeline fully complete (MinIO + YouTube + Dadabase)
2. **Versioning:** Use `{id}-V{n}` suffix on regenerations (V1, V2, V3...)
3. **State tracking:** PostgreSQL `tasks` table + `.pending-approvals.json`
4. **Checks before action:** Always verify current state before proceeding
5. **Safe retries:** All steps can be re-run without side effects
6. **Persistent queue:** Pending approvals survive restarts/crashes

**Example: Resume interrupted pipeline**
```bash
# 1. Check PostgreSQL tasks
PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d mission_control \
  -c "SELECT id, title, column_name FROM tasks WHERE title LIKE '%dadjoke%' ORDER BY updated_at DESC LIMIT 1"

# 2. Check pending approvals queue
cat /workspace/.pending-approvals.json | jq

# 3. Check assets
ls /workspace/dadtasticdads-output/24-*.{mp3,mp4,png} 2>/dev/null || echo "No assets"

# 4. Manual approval check (if needed)
node /workspace/tools/dadjoke-approval-checker.js

# 5. Resume based on state:
# - pending_approval + video exists → Kevin needs to reply
# - in-progress + no video → Phase 3 (render)
# - nothing → Phase 1 (fetch joke)
```

## Approval System Details

**Files:**
- `.pending-approvals.json` - Queue of videos awaiting Kevin's reply
- `tools/dadjoke-approval-checker.js` - Polls for replies, processes actions
- `tools/heartbeat-runner.js` - Runs checker every heartbeat cycle

**Heartbeat Integration:**
Every heartbeat (typically every 30 min):
1. Loads pending queue
2. Fetches last 20 Telegram messages
3. Parses for approval intent (approve/reject/fix)
4. Executes corresponding action
5. Removes from queue when complete

**Timeouts:**
- No reply after 24 hours → Auto-skip to next joke
- Logged to `.learnings/DADIOKE-REJECTIONS.md`

**Manual Commands:**
```bash
# Check pending approvals
node tools/dadjoke-approval-checker.js

# View queue
cat .pending-approvals.json | jq '.queue[] | {jokeId, status, sentAt}'

# Clear stuck queue (emergency)
echo '{"queue":[]}' > .pending-approvals.json
```

---

## Success Criteria

Pipeline complete when ALL are true:
- ✅ Video file exists: `{id}-video-V1.mp4` (~1.5MB, 720x1280, 5-7s)
- ✅ MinIO uploaded: `hp1/dadjokes/{id}/`
- ✅ Dadabase: Used=TRUE, Posted=TRUE
- ✅ YouTube: Uploaded (Private, awaiting Kevin to make Public)
- ✅ Memory logged: `memory/YYYY-MM-DD.md`

**Not complete** until Kevin manually sets YouTube video to Public (his choice).
