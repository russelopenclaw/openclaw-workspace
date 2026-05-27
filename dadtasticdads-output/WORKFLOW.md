# Dad Joke Video Creation Workflow
**Last Updated:** 2026-03-09  
**Status:** Production Ready ✅

---

## Quick Reference

```bash
# 1. Generate with verified template
python3 generate-video-TEMPLATE.py --joke-id 13

# 2. Verify frames (automatic, but analyze output)
# Script extracts frames to frame-verify-{id}-setup.png and punchline.png
# Use image tool to confirm ALL text visible

# 3. Send to Kevin (ONLY after verification passes)
# Send via Telegram with video file

# 4. Upload to YouTube (after Kevin approves)
python3 youtube-upload.py upload \
  --file dadjoke-{id}-final.mp4 \
  --title "Dad Joke #{id}: {SHORT_TITLE} #Shorts" \
  --description "See description template below" \
  --tags "dad jokes,comedy,funny,shorts" \
  --category 23 \
  --privacy private
```

---

## Complete Workflow

### Phase 1: Preparation

**1.1 Fetch Joke from Dadabase**
```bash
# Get next unused joke from Google Sheets
gog sheets get {SPREADSHEET_ID} "Sheet1!A1:D200" --json
```

**1.2 Download Assets from MinIO**
```bash
# Get background image
mc cp hp1/dadjokes/{id}/{id}-background.png /workspace/dadtasticdads-output/

# Get audio (or generate with ElevenLabs if needed)
mc cp hp1/dadjokes/{id}/{id}-audio-padded.mp3 /workspace/dadtasticdads-output/
```

---

### Phase 2: Video Generation

**2.1 Generate with Template**
```bash
cd /workspace/dadtasticdads-output
python3 generate-video-TEMPLATE.py --joke-id {id}
```

**2.2 Verify Frames** (AUTOMATIC - DO NOT SKIP)
Script automatically extracts:
- `frame-verify-{id}-setup.png` (at 2.5s)
- `frame-verify-{id}-punchline.png` (at 5.0s)

**2.3 Analyze Frames**
```bash
# Use image analysis tool
image analyze frame-verify-{id}-setup.png --prompt="Is ALL text fully visible? Check every letter bottom."
image analyze frame-verify-{id}-punchline.png --prompt="Is ALL text fully visible? Check every letter bottom."
```

**CRITICAL:** If ANY text is truncated:
- ❌ DO NOT SEND TO KEVIN
- ❌ DO NOT UPLOAD
- ✅ Fix the issue (check text Y positions in TEMPLATE)
- ✅ Re-generate and re-verify

---

### Phase 3: Review

**3.1 Send to Kevin** (ONLY after verification passes)
```
🎬 Dad Joke #{id} - [VERIFIED ✅]

"{FULL_JOKE_TEXT}"

✅ All text 100% visible (verified at pixel level)
✅ Verified frames: frame-verify-{id}-setup.png, punchline.png
✅ Specs: {duration}s, {size}MB, 720x1280

Uploaded to MinIO: {id}/video-{version}.mp4
```

**3.2 Kevin Reviews**
- Watches on Telegram
- Replies with feedback or approval

**3.3 If Feedback Given**
- Fix the specific issue
- Re-generate with new version number
- RE-VERIFY FRAMES
- Send again

**3.4 If Approved**
Proceed to Phase 4

---

### Phase 4: YouTube Upload

**4.1 Upload to YouTube (Private)**
```bash
python3 /workspace/skills/youtube-uploader/scripts/youtube-upload.py upload \
  --file /workspace/dadtasticdads-output/dadjoke-{id}-final.mp4 \
  --title "Dad Joke #{id}: {SHORT_TITLE} 🚲 #Shorts" \
  --description "{DESCRIPTION_TEMPLATE}" \
  --tags "dad jokes,comedy,funny,jokes,dad joke,humor,shorts,youtube shorts,joke of the day,dad humor,puns,family friendly,clean comedy" \
  --category 23 \
  --privacy private
```

**4.2 Description Template**
```
{JOKE_TEXT}

#DadJokes #Comedy #Funny #JokeOfTheDay #DadJoke #Humor #Shorts #YouTubeShorts

💬 Subscribe for daily dad jokes!
🎬 DadtasticDads - Making you groan since 2026
```

**4.3 Kevin Makes Public**
- Kevin reviews in YouTube Studio
- Changes privacy from Private to Public
- OR schedules for future publish

---

## Description Templates

### Standard Dad Joke
```
{JOKE_TEXT}

#DadJokes #Comedy #Funny #JokeOfTheDay #DadJoke #Humor #Shorts #YouTubeShorts

💬 Subscribe for daily dad jokes!
🎬 DadtasticDads - Making you groan since 2026
```

### With Emoji (match joke content)
```
{JOKE_TEXT}

#DadJokes #Comedy #Funny #JokeOfTheDay #Shorts

😂 Follow for more!
🎬 DadtasticDads
```

---

## MinIO Naming Convention

```
dadjokes/{id}/
  {id}-background.png       # Source image
  {id}-audio.mp3            # Original audio
  {id}-audio-padded.mp3     # Audio with 1s buffers
  {id}-video-v1.mp4         # First version
  {id}-video-v2.mp4         # Second version
  {id}-video-FINAL.mp4      # Final approved version
```

---

## YouTube Title Patterns

```
Dad Joke #{id}: {5-7 word hook} #Shorts

Examples:
"Dad Joke #12: Bike-Chasing Dog 🚲 #Shorts"
"Dad Joke #13: Step Ladder Surprise 🪜 #Shorts"
"Dad Joke #14: Zoo Date Gone Wrong 🦁 #Shorts"
```

---

## Critical Parameters (DO NOT CHANGE)

```python
# Text rendering
method = "label"  # NOT "caption"
size = (700, 100)  # Explicit bounding box
font_size = 36
stroke_width = 2

# Text positions (Y from top)
setup_line1: y=280
setup_line2: y=330
setup_line3: y=380
punchline_line1: y=310
punchline_line2: y=360
punchline_line3: y=410
brand: y=1050

# Timing (seconds)
buffer_start: 1.0
setup_start: 1.0
punchline_start: 4.0
buffer_end: 1.0
```

---

## Anti-Patterns (NEVER DO THESE)

❌ Send video without frame verification  
❌ Use `method='caption'` in MoviePy TextClip  
❌ Change multiple variables between renders  
❌ Upload to YouTube before Kevin approves  
❌ Position text below y=700  
❌ Skip image analysis step  
❌ Assume "it probably works" without checking  

---

## Troubleshooting

### Text Still Cut Off?
1. Verify you're using `method='label'` (NOT 'caption')
2. Check `size=(700, 100)` is set
3. Move text UP (decrease Y value)
4. Reduce font_size to 32 or 30
5. Increase bounding box height to 120

### Render Too Slow?
- Use `preset='medium'` (not 'slow' or 'veryslow')
- Use `threads=4` or more
- Reduce resolution (not recommended for Shorts)

### Audio/Video Sync Issues?
- Verify audio file has proper padding
- Check `setup_start` and `punchline_start` timing
- Ensure audio duration matches expected (~7.3s for 5.3s joke + 2s buffers)

---

## Quality Checklist (BEFORE EVERY SEND)

```
□ Frame extracted at 2.5s (setup visible)
□ Frame extracted at 5.0s (punchline visible)
□ ALL text confirmed 100% visible in BOTH frames
□ No letters truncated at bottom (especially g, p, y, j, q)
□ Brand watermark fully visible
□ Audio duration correct (±0.1s)
□ Video resolution is 720x1280
□ MinIO backup created
□ Using generate-video-TEMPLATE.py (not experimental script)
```

**If ANY box is unchecked → DO NOT SEND → Fix and re-verify**

---

## Success Metrics (TARGET)

| Metric | Target | Joke #12 (failed) | Joke #13+ (goal) |
|--------|--------|-------------------|------------------|
| Iterations | 1-2 | 10+ | 1-2 |
| Time to working version | <10 min | 45+ min | <10 min |
| Verification before send | 100% | 0% | 100% |
| Root cause search time | <5 min | 40 min | <5 min |

---

*This workflow was created from post-mortem analysis on 2026-03-09. Follow it to avoid repeating past mistakes.*
