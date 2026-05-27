# Screensaver Effects & Tracking Guide

**Created:** 2026-03-17  
**Updated:** 2026-03-17

---

## Quick Answers

### 1. Does Sampler Matter? **YES!**

**Significant impact on:**
- Quality (fewer artifacts, better convergence)
- Speed (some samplers are 2x faster)
- Character (soft/dreamy vs sharp/detailed)

**Recommended defaults:**
| Use Case | Sampler | Steps | Why |
|----------|---------|-------|-----|
| **General screensavers** | `DPM++ 2M Karras` | 30 | Clean, reliable, fast |
| **Dreamy/soft scenes** | `Euler a` | 25-30 | Softer, more artistic |
| **Highly detailed** | `DPM++ SDE Karras` | 30-35 | Rich detail, better convergence |
| **Fast iteration** | `UniPC` | 20 | Quick, good quality |

**Tracked in DB:** `sampler` and `steps` columns added ✅

---

### 2. Video Effects - Ken Burns Style

**Your 4 effects are perfect** for relaxing videos:
1. ✅ **Zoom In** - Draws viewer into scene
2. ✅ **Zoom Out** - Reveals landscape
3. ✅ **Pan Left** - Mimics horizon movement
4. ✅ **Pan Right** - Follows paths/lines

**Plus 2 bonus effects:**
5. **Pan Up** - Reveal sky/trees
6. **Pan Down** - Focus on foreground details

**ffmpeg makes this EASY** - all effects implemented in `tools/screensaver-effects.js` ✅

---

### 3. Recommended Effect per Video Type

| Video | Recommended Effect | Why |
|-------|-------------------|-----|
| Cherry Blossom Garden | `zoom_in` | Draw into the blossoms |
| Bamboo Forest | `pan_right` | Follow the path |
| Ocean Sunset | `pan_left` | Mimic wave motion |
| Rainy Tea Garden | `zoom_in` | Focus on lanterns |
| Zen Temple | `zoom_out` | Reveal courtyard |
| Mountain Lake | `pan_left` | Sweep across reflections |
| Rainy Cafe | `zoom_in` | Cozy interior focus |
| Lantern Forest | `pan_right` | Follow the path |
| Koi Pond | `pan_down` | Focus on water/fish |
| Snowy Zen Garden | `zoom_out` | Reveal full garden |

**Auto-recommendation function included** - analyzes filename to suggest effect!

---

## Database Schema (Updated)

```sql
screensaver_prompts (400 rows)
├─ id, video_number, video_title, prompt_number
├─ model, prompt_text, negative_prompt
├─ status (pending → generating → validating → complete/failed)
├─ image_path, video_path
├─ validation_result
├─ **sampler** (default: 'DPM++ 2M Karras')
├─ **steps** (default: 30)
├─ **effect_type** (default: 'zoom_in')
├─ **effect_duration** (default: 24 seconds)
├─ **audio_track** (optional path)
├─ **audio_volume** (default: 0.5)
└─ **seed** (for reproducibility)
```

---

## Effect Implementation

### Zoom In (Slow, Subtle)
```bash
ffmpeg -i image.png -vf "zoompan=z='min(zoom+0.0015,1.15)':d=720:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080" \
  -c:v libx264 -t 24 -pix_fmt yuv420p output.mp4
```

**Parameters:**
- Speed: 0.0015 per frame (very slow)
- Max zoom: 1.15 (15% increase)
- Duration: 24 seconds (720 frames @ 30fps)
- Fade in/out: 2 seconds each

### Pan Left
```bash
ffmpeg -i image.png -vf "crop=iw*0.9:ih*0.9:x='if(gte(t,0),iw*0.1*(t/24),0)':y=ih*0.05,scale=1920:1080" \
  -c:v libx264 -t 24 output.mp4
```

**Parameters:**
- Crop: 90% of original (10% movement room)
- Speed: Full width over 24 seconds
- Vertical position: 5% from top

---

## Usage Examples

### Generate Single Video
```bash
node tools/screensaver-effects.js \
  --input cherry-blossom-01.png \
  --effect zoom_in \
  --duration 24 \
  --output cherry-blossom-01-zoom_in.mp4
```

### Generate All 4 Effects
```bash
node tools/screensaver-effects.js \
  --input cherry-blossom-01.png \
  --all \
  --output-dir ./videos/ \
  --duration 30
```

**Output:**
- `cherry-blossom-01-zoom_in.mp4`
- `cherry-blossom-01-zoom_out.mp4`
- `cherry-blossom-01-pan_left.mp4`
- `cherry-blossom-01-pan_right.mp4`

### Get Effect Recommendation
```bash
node tools/screensaver-effects.js \
  --input cherry-blossom-garden.png \
  --recommend
# Output: 📊 Recommended effect: zoom_in
```

### With Audio
```bash
node tools/screensaver-effects.js \
  --input ocean-sunset.png \
  --effect pan_left \
  --duration 30 \
  --audio rain-ambience.mp3 \
  --volume 0.4 \
  --output ocean-sunset.mp4
```

---

## Audio Recommendations

### For Relaxing Videos

| Type | Source | Volume | Notes |
|------|--------|--------|-------|
| **Nature ambience** | Rain, ocean, forest | 0.3-0.5 | Loop short clips |
| **Drone/ambient** | Synthesized pads | 0.2-0.4 | Low frequencies |
| **Singing bowls** | Tibetan bowls | 0.3-0.5 | Sparse, occasional |
| **Silence** | No audio | N/A | Sometimes best! |

**Audio tips:**
- Keep volume **low** (0.3-0.5 max) - it's background
- Use **high-quality** sources (no compressed MP3 artifacts)
- **Loop seamlessly** - crossfade loop points
- Consider **no audio** for some videos (purely visual)

---

## Workflow Integration

### Step-by-Step Process

1. **Pick next pending prompt**
   ```javascript
   const workflow = require('./tools/screensaver-workflow.js');
   const next = workflow.getNextPending();
   ```

2. **Generate image (Stable Diffusion)**
   ```javascript
   // Use skills/stable-diffusion/SKILL.md
   // Save to: /workspace/screensavers/{video}/prompt-{N}.png
   workflow.updateStatus(next.id, 'generating', {
     sampler: 'DPM++ 2M Karras',
     steps: 30,
     effect_type: 'zoom_in'
   });
   ```

3. **Validate image (Qwen vision)**
   ```javascript
   // Check: no text, matches prompt, quality OK
   workflow.updateStatus(next.id, 'validating', {
     image_path: '/path/to/image.png'
   });
   ```

4. **Generate video with effect**
   ```javascript
   const effects = require('./tools/screensaver-effects.js');
   await effects.generateVideo({
     input: imagePath,
     output: videoPath,
     effect: 'zoom_in',
     duration: 24,
     audio: null,  // or path to audio file
     audioVolume: 0.5
   });
   ```

5. **Mark complete**
   ```javascript
   workflow.updateStatus(next.id, 'complete', {
     video_path: videoPath,
     completed_at: new Date().toISOString()
   });
   ```

---

## Files Created

| File | Purpose |
|------|---------|
| `tools/screensaver-effects.js` | ffmpeg effects generator |
| `tools/screensaver-workflow.js` | Updated with effect tracking |
| `docs/SCREENSAVER-EFFECTS-GUIDE.md` | This documentation |
| `tools/import-screensaver-prompts.js` | Imported 400 prompts |

---

## Best Practices

### For Relaxing Videos

1. **Slow movement** - 0.001-0.0015 zoom increment per frame
2. **Subtle range** - Max 10-15% zoom, not dramatic
3. **Long duration** - 24-30 seconds per image
4. **Smooth fades** - 2 second fade in/out
5. **Low audio** - 0.3-0.5 volume max
6. **Consistent FPS** - 30fps for smooth motion

### Effect Selection

- **Match movement to subject** - Paths → pan, landscapes → zoom out
- **Vary effects** - Don't use same effect for all 40 prompts in a video
- **Test first** - Generate 2-3 effects, pick best
- **Auto-recommend** - Use `--recommend` flag for suggestions

---

## Next Steps

1. **Test effects** - Pick one image, generate all 4 effects
   ```bash
   node tools/screensaver-effects.js --input test.png --all --output-dir ./test-videos/
   ```

2. **Pick sampler** - Test 2-3 samplers, compare quality/speed

3. **Start pipeline** - Run first prompt through full workflow

4. **Iterate** - Adjust effect speed, duration based on results

---

**Status:** ✅ Ready to test!  
**Recommendation:** Start with `DPM++ 2M Karras` @ 30 steps, `zoom_in` effect, 24 seconds, no audio.
