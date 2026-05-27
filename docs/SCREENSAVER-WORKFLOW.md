# Screensaver Video Pipeline - Workflow System

**Created:** 2026-03-17  
**Updated:** 2026-03-20 (n8n automation added)  
**Status:** ✅ Production ready with full automation

---

## Overview

**400 prompts** across **10 video concepts** tracked in PostgreSQL with automated n8n pipeline:

### Full Pipeline (6 Steps)

| Step | Flow | Type | Purpose |
|------|------|------|---------|
| 1 | CLI | Manual | Pick next pending prompt from DB |
| 2 | `screensaver-step2-image-gen.json` | n8n | Generate image via Stable Diffusion |
| **2b** | **Alfred (manual)** | **Human** | **Validate image with Qwen3.5 vision + judgment** |
| 3 | `screensaver-step3-complete.json` | n8n | Convert image → video with effects |
| 4 | `screensaver-step4-cycle.json` | n8n | Stitch 40 clips → 20-min cycle |
| 5 | `screensaver-step5-8hour.json` | n8n | Loop cycle → 8-hour final video |

| Video | Title | Model | Prompts |
|-------|-------|-------|---------|
| 1 | Cherry Blossom Meditation Garden | juggernautXL | 40 |
| 2 | Bamboo Forest Serenity | realvisXL | 40 |
| 3 | Ocean Sunset Calm | realvisXL | 40 |
| 4 | Rainy Japanese Tea Garden | juggernautXL | 40 |
| 5 | Zen Temple Courtyard | juggernautXL | 40 |
| 6 | Mountain Lake Reflection | realvisXL | 40 |
| 7 | Cozy Rainy Cafe Window | realvisXL | 40 |
| 8 | Lantern Forest Path | juggernautXL | 40 |
| 9 | Japanese Water Garden | juggernautXL | 40 |
| 10 | Snowy Zen Garden | realvisXL | 40 |

---

## Database Schema

```sql
CREATE TABLE screensaver_prompts (
  id              VARCHAR(50) PRIMARY KEY,        -- Format: video-{N}-prompt-{N}
  video_number    INTEGER NOT NULL,
  video_title     VARCHAR(200) NOT NULL,
  prompt_number   INTEGER NOT NULL,
  model           VARCHAR(50) NOT NULL,
  prompt_text     TEXT NOT NULL,
  negative_prompt TEXT DEFAULT 'blurry, low quality, distorted, deformed objects, watermark, text',
  status          VARCHAR(20) DEFAULT 'pending',
  image_path      VARCHAR(500),
  video_path      VARCHAR(500),
  validation_result TEXT,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  completed_at    TIMESTAMP,
  UNIQUE(video_number, prompt_number)
);
```

**ID Format:** `video-{video_number}-prompt-{prompt_number}`  
**Examples:** `video-1-prompt-1`, `video-1-prompt-2`, `video-2-prompt-1`

**Status workflow:**
`pending` → `generating` → `validating` → `complete` (or `failed`)

---

## n8n Automation Pipeline

### Step 1: Trigger (Manual or Automated)
```bash
# Get next pending from DB
node tools/screensaver-workflow.js --next
# Returns: { id: 'ss-cherry-blossom-1', theme, prompt_number, prompt_text, model }
```

### Step 2: Generate Image (n8n Flow)
**Flow:** `n8n/screensaver-step2-image-gen.json`  
**Webhook:** `POST https://n8n.wolfeinkc.uk/webhook/screensaver-generate-image`

**What it does:**
1. Receives prompt data from webhook
2. Calls Stable Diffusion API (`http://192.168.1.33:7860/sdapi/v1/txt2img`)
3. Decodes base64 image response
4. Saves to MinIO (`hp1/screensavers/{theme}/raw/img_{N}.png`)
5. Updates PostgreSQL status to `'generating'`
6. Returns image path

**Payload:**
```json
{
  "id": "video-1-prompt-1",
  "video_number": 1,
  "prompt_number": 1,
  "theme": "cherry-blossom",
  "prompt": "Japanese cherry blossom meditation garden, stone path, spring",
  "negative_prompt": "blurry, low quality, distorted, deformed objects, watermark, text",
  "model": "juggernautXL",
  "sampler_name": "DPM++ 2M Karras",
  "steps": 30,
  "width": 1920,
  "height": 1080
}
```

**ID Format:** `video-{video_number}-prompt-{prompt_number}` (e.g., `video-1-prompt-1`)

### Step 2b: Validate Image (Manual - Alfred) ⭐

**Who:** Alfred (you) - requires judgment, not automation  
**Tool:** Qwen3.5:cloud via Ollama (image analysis)  
**Files:** Image in `screensavers/{theme}/raw/img_{N}.png`  
**ID Format:** `video-{video_number}-prompt-{prompt_number}` (e.g., `video-1-prompt-1`)

**What you do:**
1. **Fetch the generated image** from Step 2
2. **Analyze with Qwen3.5 vision** - Use the `image` tool
3. **Apply judgment** - Don't just trust the AI; verify yourself
4. **Update DB** - Mark as `'complete'` or `'failed'`
5. **Document** - Log validation reasoning

---

## Step 2b: Manual Validation Process (Alfred)

### Step 1: Get the Image

After Step 2 completes, get the image path from DB:

```sql
SELECT id, image_path, prompt_text 
FROM screensaver_prompts 
WHERE status = 'generating' 
ORDER BY updated_at DESC 
LIMIT 1;
```

Or use the workflow tool:
```bash
node tools/screensaver-workflow.js --next
# Returns: { id: 'video-1-prompt-1', video_number, prompt_number, theme, image_path, prompt_text }
```

### Step 2: Analyze with Qwen3.5 Vision

**Use the `image` tool** (not n8n, not automated):

```javascript
// In your session
const result = await image({
  prompt: `Analyze this image for a screensaver video. Check:
1. Is there ANY text, watermark, signature, or writing visible? Be specific about location.
2. Does the image match this prompt: "${prompt_text}"?
3. Is the quality acceptable (no blur, distortion, weird artifacts)?

Describe what you see in detail.`,
  image: '/home/kevin/.openclaw/workspace/screensavers/cherry-blossom/raw/img_01.png'
});
```

**Wait for Qwen3.5 response** - it will describe the image.

### Step 3: Apply Your Judgment

**Don't just accept the AI output.** Look at the image yourself if needed. Ask:

- **Text check:** Did Qwen see any text? If yes, where? Is it a watermark, signature, random letters?
- **Prompt match:** Does the image actually show what the prompt describes?
- **Quality:** Is it blurry? Distorted? Weird colors? Missing key elements?

**Examples:**

✅ **PASS** - "Cherry blossoms in foreground, stone path leading back, soft pink/green colors, no text visible, sharp focus"

❌ **FAIL** - "I see 'Sample' text in upper-left corner" or "Image is very blurry" or "No stone path visible, just water"

### Step 4: Update Database

**If PASS:**
```sql
UPDATE screensaver_prompts 
SET status = 'complete', 
    validation_result = 'PASS: Cherry blossoms visible, stone path in foreground, no text detected, quality good',
    completed_at = NOW(),
    updated_at = NOW() 
WHERE id = 'video-1-prompt-1';
```

**If FAIL:**
```sql
UPDATE screensaver_prompts 
SET status = 'failed', 
    validation_result = 'FAIL: Text "Sample" detected in upper-left corner',
    updated_at = NOW() 
WHERE id = 'video-1-prompt-1';
```

### Step 5: Document Validation

Log your reasoning in `.learnings/SCREENSAVER-VALIDATION.md`:

```markdown
## Validation: video-1-prompt-1 (2026-03-20)

**Image:** `screensavers/cherry-blossom/raw/img_01.png`  
**Prompt:** "Japanese cherry blossom meditation garden, stone path, spring"  
**Model:** Qwen3.5:cloud

**Analysis:**
- Text: None detected
- Content: Cherry blossoms (pink/white), stone path (gray), green moss, soft lighting
- Quality: Sharp, good contrast, no artifacts

**Verdict:** ✅ PASS

**Notes:** Image matches prompt well. Stone path clearly visible in lower third.
```

---

## Retry Process for Failed Images

**When validation fails:**

1. **Identify the issue:**
   - Text detected → Note exact text and location
   - Quality issue → Describe the problem (blur, distortion, etc.)
   - Prompt mismatch → What's missing or wrong?

2. **Adjust generation parameters:**
   - **Text**: Add specific terms to negative prompt ("text", "writing", "signature", "watermark", "letters")
   - **Quality**: Increase steps (30→40), change sampler, try different model
   - **Mismatch**: Rewrite prompt more specifically

3. **Regenerate (Step 2 again):**
   ```bash
   # Update DB to pending
   UPDATE screensaver_prompts 
   SET status = 'pending', updated_at = NOW() 
   WHERE id = 'ss-cherry-blossom-1';
   
   # Trigger Step 2 n8n flow with stronger negative prompt
   curl -X POST https://n8n.wolfeinkc.uk/webhook/screensaver-generate-image \
     -H "Content-Type: application/json" \
     -d '{
       "theme": "cherry-blossom",
       "prompt_number": 1,
       "prompt": "Japanese cherry blossom meditation garden, stone path, spring",
       "negative_prompt": "blurry, low quality, distorted, deformed, watermark, text, writing, signature, letters, words, typography",
       "steps": 40
     }'
   ```

4. **Re-validate (Step 2b again)** - Same process as above

5. **Max 3 retries** - After 3 failures, mark as `'blocked'` and escalate

---

## Validation Criteria

### PASS When:
- ✅ **No text** - Zero text, watermarks, signatures, writing, letters
- ✅ **Prompt match** - Key elements from prompt are visible
- ✅ **Quality OK** - Sharp focus, good colors, no distortion/artifacts

### FAIL When:
- ❌ **Text detected** - Any text anywhere (corner, background, overlay)
- ❌ **Quality issues** - Blur, distortion, weird artifacts, bad colors
- ❌ **Prompt mismatch** - Missing key elements, wrong subject

### Borderline Cases (Use Judgment):

| Situation | Verdict | Reasoning |
|-----------|---------|-----------|
| Faint texture that looks like text | **FAIL** | Could be interpreted as text |
| Prompt says "stone path" but path is barely visible | **FAIL** | Key element missing |
| Slight blur in background | **PASS** | Focus is on foreground subject |
| Colors slightly different than expected | **PASS** | Artistic interpretation OK |
| Small artifact in corner | **FAIL** | Will be visible in video |

---

## Success Gate

**Step 3 (video generation) ONLY triggers when:**
- ✅ You (Alfred) have validated the image
- ✅ PostgreSQL `status = 'complete'`
- ✅ You've logged validation reasoning

**Never proceed to video generation without your manual validation.**

### Step 3: Image → Video (n8n Flow)
**Flow:** `n8n/screensaver-step3-complete.json`  
**Webhook:** `POST https://n8n.wolfeinkc.uk/webhook/screensaver-image-video`

**Trigger:** Only after Step 2b validation returns `status: 'complete'`

**What it does:**
1. Downloads image from MinIO
2. Applies effect (zoom_in, zoom_out, pan_left, pan_right, pan_up, pan_down)
3. Generates 27-second video with ffmpeg
4. Adds optional audio track
5. Uploads to MinIO (`hp1/screensavers/{theme}/clips/clip_{N}.mp4`)
6. Validates duration (27s)
7. Creates share URL
8. Updates PostgreSQL with video path + share URL
9. Cleans up temp files

**Payload:**
```json
{
  "theme": "cherry-blossom",
  "clip_number": 1,
  "image_path": "screensavers/cherry-blossom/raw/img_01.png",
  "effect_type": "zoom_in",
  "effect_duration": 27,
  "audio_track": null,
  "audio_volume": 0.5
}
```

**Effect filters:**
- `zoom_in`: Slow zoom (1.0→1.1x over 27s)
- `zoom_out`: Slow zoom out (1.1→1.0x)
- `pan_left`: Pan left across 90% crop
- `pan_right`: Pan right across 90% crop
- `pan_up`: Pan upward
- `pan_down`: Pan downward

---

## Validation & Retry Process

### Validation Criteria (Step 2b)

**PASS** (status = `'complete'`) when:
- ✅ `has_text: false` - No text, watermarks, or writing
- ✅ `matches_prompt: true` - Visual content matches prompt
- ✅ `quality_ok: true` - No blur, distortion, or artifacts

**FAIL** (status = `'failed'`) when:
- ❌ `has_text: true` - Any text detected (location specified)
- ❌ `quality_ok: false` - Blur, distortion, or artifacts
- ❌ `matches_prompt: false` - Content doesn't match prompt

### Retry Process for Failed Images

**When Step 2b fails:**

1. **Review validation_result** - Check what failed:
   ```json
   {
     "status": "failed",
     "validation": {
       "has_text": true,
       "text_location": "upper-left corner",
       "details": "Text 'Sample' detected"
     }
   }
   ```

2. **Determine fix strategy:**
   - **Text detected**: Strengthen negative prompt, add specific text terms
   - **Quality issues**: Increase steps, change sampler, adjust model
   - **Prompt mismatch**: Rewrite prompt more specifically

3. **Retry with modified parameters:**
   ```bash
   # Update prompt with stronger negative terms
   curl -X POST https://n8n.wolfeinkc.uk/webhook/screensaver-generate-image \
     -H "Content-Type: application/json" \
     -d '{
       "theme": "cherry-blossom",
       "prompt_number": 1,
       "prompt": "Japanese cherry blossom meditation garden, stone path, spring",
       "negative_prompt": "blurry, low quality, distorted, deformed, watermark, text, writing, signature, letters, words",
       "model": "juggernautXL",
       "steps": 40
     }'
   ```

4. **Re-validate:** Trigger Step 2b again on new image

5. **Max retries:** 3 attempts per prompt before manual review

### Manual Review Threshold

**After 3 failed retries:**
- Mark prompt as `status: 'blocked'`
- Log to `.learnings/SCREENSAVER-FAILURES.md`
- Manual intervention required:
  - Rewrite prompt entirely
  - Try different model
  - Skip this prompt number, continue pipeline

### Success Gate

**Step 3 (video generation) only triggers when:**
- Step 2b returns `status: 'complete'`
- PostgreSQL `screensaver_prompts.status = 'complete'`

**Never proceed to video generation with failed validation.**

### Step 4: Cycle Assembly (n8n Flow)
**Flow:** `n8n/screensaver-step4-cycle.json`  
**Webhook:** `POST https://n8n.wolfeinkc.uk/webhook/screensaver-cycle`

**What it does:**
1. Downloads all 40 clips from MinIO
2. Validates clip count (must be exactly 40)
3. Uses ffmpeg xfade filter to stitch with 3-second transitions
4. Creates seamless loop (last clip → first clip)
5. Outputs 20-minute cycle video
6. Uploads to MinIO (`hp1/screensavers/{theme}/cycles/{theme}_20min_cycle.mp4`)

**Math:**
- 40 clips × 27s = 1080s (18 min)
- 39 transitions × 3s overlap = 117s
- Total: ~20 minutes

### Step 5: 8-Hour Compilation (n8n Flow)
**Flow:** `n8n/screensaver-step5-8hour.json`  
**Webhook:** `POST https://n8n.w1olfeinkc.uk/webhook/screensaver-8hour`

**What it does:**
1. Downloads 20-min cycle video
2. Loops 24 times (20 min × 24 = 8 hours)
3. Adds zen audio track (rain, stream, forest ambience)
4. Outputs 8-hour final video
5. Uploads to MinIO + network share
6. Updates PostgreSQL as complete

**Audio sources:**
- Rain on Leaves (Freesound CC0)
- Gentle Stream (Freesound CC0)
- Forest Ambience (Freesound CC0)

---

## Manual Commands (CLI)

### Show Progress Dashboard
```bash
node tools/screensaver-workflow.js --dashboard
```

### Trigger n8n Flows Manually
```bash
# Step 2: Generate image
curl -X POST https://n8n.wolfeinkc.uk/webhook/screensaver-generate-image \
  -H "Content-Type: application/json" \
  -d '{"theme":"cherry-blossom","prompt_number":1,"prompt":"...","model":"juggernautXL"}'

# Step 3: Create video
curl -X POST https://n8n.wolfeinkc.uk/webhook/screensaver-image-video \
  -H "Content-Type: application/json" \
  -d '{"theme":"cherry-blossom","clip_number":1,"image_path":"screensavers/cherry-blossom/raw/img_01.png","effect_type":"zoom_in"}'

# Step 4: Assemble cycle (after all 40 clips complete)
curl -X POST https://n8n.wolfeinkc.uk/webhook/screensaver-cycle \
  -H "Content-Type: application/json" \
  -d '{"theme":"cherry-blossom"}'

# Step 5: Create 8-hour final
curl -X POST https://n8n.wolfeinkc.uk/webhook/screensaver-8hour \
  -H "Content-Type: application/json" \
  -d '{"theme":"cherry-blossom","audio_url":"https://freesound.org/..."}'
```

### Retry All Failed
```bash
node tools/screensaver-workflow.js --retry
```

---

## SQL Queries

### View Progress by Video
```sql
SELECT video_number, video_title, status, COUNT(*) 
FROM screensaver_prompts 
GROUP BY video_number, video_title, status 
ORDER BY video_number, status;
```

### Get Next Pending
```sql
SELECT * FROM screensaver_prompts 
WHERE status = 'pending' 
ORDER BY video_number, prompt_number 
LIMIT 1;
-- ID format: video-{video_number}-prompt-{prompt_number}
```

### Migration: Convert Existing IDs to New Format

If you have existing records with `ss-{theme}-{N}` format:

```sql
-- Backup first
CREATE TABLE screensaver_prompts_backup AS SELECT * FROM screensaver_prompts;

-- Update IDs to new format
UPDATE screensaver_prompts sp
SET id = 'video-' || video_number || '-prompt-' || prompt_number
WHERE id LIKE 'ss-%';

-- Verify
SELECT id, video_number, prompt_number FROM screensaver_prompts ORDER BY id LIMIT 10;
```

### Retry Failed
```sql
UPDATE screensaver_prompts 
SET status = 'pending', updated_at = NOW() 
WHERE status = 'failed';
```

### Export Complete Prompts
```sql
SELECT video_title, prompt_number, prompt_text, image_path, video_path
FROM screensaver_prompts
WHERE status = 'complete'
ORDER BY video_number, prompt_number;
```

---

## Files

### n8n Flows
| File | Step | Purpose |
|------|------|---------|
| `n8n/screensaver-step2-image-gen.json` | 2 | Generate image from prompt via Stable Diffusion |
| `n8n/screensaver-step3-complete.json` | 3 | Convert image → 27s video with effects |
| `n8n/screensaver-step4-cycle.json` | 4 | Stitch 40 clips → 20-min cycle |
| `n8n/screensaver-step5-8hour.json` | 5 | Loop cycle → 8-hour final video |

### Manual Steps (Alfred)
| Step | Purpose | Tool |
|------|---------|------|
| 1 | Pick next pending prompt | CLI / SQL |
| **2b** | **Validate image with judgment** | **`image` tool + Qwen3.5 vision** |
| Retry | Regenerate failed images | CLI + n8n Step 2 |

### CLI Tools
| File | Purpose |
|------|---------|
| `tools/import-screensaver-prompts.js` | Parse markdown, import 400 prompts to DB |
| `tools/screensaver-workflow.js` | Workflow manager (next/dashboard/retry) |
| `tools/screensaver-stitch-cycle.js` | Manual cycle assembly (ffmpeg xfade) |
| `tools/screensaver-effects.js` | Effect filter definitions |
| `tools/update-screensaver-effects.js` | Batch update effects in DB |

---

## Integration Points

### Stable Diffusion
Use existing skill: `skills/stable-diffusion/SKILL.md`
```javascript
// From workflow.js:
const sdSkill = require('../skills/stable-diffusion/SKILL.md');
await sdSkill.generate({
  prompt: next.promptText,
  negative_prompt: next.negative_prompt,
  model: next.model,
  output: `/workspace/screensavers/${next.videoTitle}/prompt-${next.promptNumber}.png`
});
```

### Image Validation
Use Qwen 3.5 vision:
```bash
# Extract frame, analyze with Qwen
python3 tools/verify-video.py /path/to/image.png
# Returns: "No text detected, prompt matches content"
```

### Video Generation
After image validation, create video frames → video file (existing pipeline)

---

## Best Practices

1. **One at a time** - Don't batch process; validate each before next
2. **Fail fast** - Mark failed quickly, review patterns
3. **Track everything** - PostgreSQL is single source of truth
4. **Dashboard first** - Always check progress before starting
5. **Retry strategically** - Fix prompt issues before retrying

---

## Future Enhancements

- [ ] Auto-retry failed prompts with modified parameters
- [ ] Parallel processing (2-3 at once) with rate limiting
- [ ] Batch upload to here.now when video complete
- [ ] A/B test prompt variations
- [ ] Export manifest.json for gallery

---

**Status:** ✅ Production Ready (tested 2026-03-17)  
**Next step:** Run `node tools/screensaver-workflow.js --next` to start processing!
