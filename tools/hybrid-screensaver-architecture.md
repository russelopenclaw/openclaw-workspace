# Hybrid Screensaver Video Process - Implementation Plan

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           n8n Webhooks                                   │
├─────────────────────────────────────────────────────────────────────────┤
│ GET screensaver/next      → Fetch next pending prompt                    │
│ POST screensaver/image    → Generate image (SD API)                      │
│ POST screensaver/validate → Validate image (Qwen vision)                 │
│ POST screensaver/clip     → Create 27s video (ffmpeg)                    │
│ POST screensaver/cycle    → Stitch 40 clips → 20-min cycle             │
│ POST screensaver/final    → Compile 8-hour with audio                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    Alfred's Orchestrator                                 │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. GET next pending prompt                                              │
│ 2. POST to generate image                                              │
│ 3. POST to validate image (retry up to 3x)                            │
│ 4. POST to create clip (parallel after validation)                       │
│ 5. When 40 clips done: POST to create cycle                            │
│ 6. POST to compile final 8-hour video                                  │
│ 7. Track everything in PostgreSQL                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

## Step 3: Image→Video N8N Flow (Needs Help)

**Input:**
```json
{
  "image_path": "hp1/screensavers/cherry-blossom/img_01.png",
  "effect_type": "zoom_in",
  "effect_duration": 27,
  "output_path": "hp1/screensavers/cherry-blossom/clips/clip_01.mp4"
}
```

**Process:**
1. Download image from MinIO
2. Run ffmpeg with Ken Burns effect
3. Upload clip to MinIO
4. Return clip metadata

**ffmpeg Command:**
```bash
ffmpeg -y -loop 1 -i input.png -vf "zoompan=z='min(zoom+0.0011,1.10)':d=810:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080,fade=t=in:st=0:d=0.5,fade=t=out:st=26.5:d=0.5" -c:v libx264 -preset fast -crf 23 -t 27 -pix_fmt yuv420p output.mp4
```

**TODO:** Build this n8n workflow

## Step 4: Full Cycle Assembly (Build Now)

**Input:** 40 clip paths, theme name
**Output:** 20-minute loopable cycle

**Process:**
1. Download all 40 clips
2. Stitch with 3s crossfade between each
3. Ensure loop point is seamless (clip_40 → clip_01)
4. Validate: duration, resolution, loop quality

## Step 5: 8-Hour Compilation (Build Now)

**Input:** 20-min cycle
**Output:** 8-hour video with zen music

**Process:**
1. Loop cycle 24x (20 min × 24 = 480 min = 8 hours)
2. Add zen background music
3. Final output to network storage

## Database Schema (Already Exists)

```sql
screensaver_prompts:
- id, video_number, video_title, prompt_number
- model, prompt_text, negative_prompt
- status (pending → generating → validating → complete/failed)
- image_path, video_path, validation_result
- sampler, steps, effect_type, effect_duration
```

## MinIO Structure

```
hp1/screensavers/
├── {theme}/
│   ├── raw/          # Generated images
│   ├── clips/        # 27-second clips
│   ├── cycles/       # 20-minute cycles
│   └── final/        # 8-hour videos
```

## Next Actions

1. ✅ Build Step 4: Full cycle stitcher (20-min with xfade)
2. ✅ Build Step 5: 8-hour compiler
3. ⏳ Help Kevin with Step 3: Image→video n8n flow
4. ⏳ Create n8n webhook endpoints

---

**Started:** 2026-03-18
**Status:** Building...
