# Image Agent Memory

## Lessons Learned

### Aurora Borealis (Completed)
- **img_09:** First attempt had road with mysterious "headlight" lighting but no cars - looked uncanny
  - **Fix:** Regenerated as snowy meadow with no man-made elements
  - **Lesson:** Avoid ambiguous artificial-looking lighting on paths/roads

- **img_10:** First attempt had aurora appearing inside cave/structure
  - **Fix:** Regenerated as frozen lake reflection
  - **Lesson:** Aurora should be sky phenomenon, not ground/structure reflections

### Aurora Borealis 2 (Completed)
- All 10 images generated successfully first try
- Theme: Aurora reflected in frozen lake
- Prompt variations worked well: low angle, side angle, ice cracks, trees, stars, dawn glow, etc.

## What Works

### Prompts for Realistic Images
```
photorealistic, detailed textures, natural lighting, high detail, 8k, DSLR camera quality
```

### Resolution
- **1280x720** - Perfect for 16:9, upscales cleanly to 1920x1080

### Model
- **RealVisXL_V4.0** - Default, produces natural-looking images

## Prompt Variations That Create Diversity

| Variation Type | Examples |
|----------------|----------|
| Time of Day | morning, golden hour, afternoon, dusk, night, dawn |
| Angle | low angle, wide shot, side angle, looking up, overhead |
| Weather | overcast, foggy, clear, misty |
| Foreground | trees, rocks, ice, snow banks, reflections |
| Mood | calm, dramatic, mysterious, peaceful |

## Common Failures

| Problem | Cause | Fix |
|---------|-------|-----|
| Smooth/plastic look | Over-use of "smooth", "perfect" | Remove these terms, add "film grain", "DSLR" |
| Cartoon/anime style | Model drifted | Re-set model to RealVisXL before generation |
| Uncanny lighting | Ambiguous light sources | Be specific: "morning light", "golden hour" |
| AI-looking artifacts | Steps too low | Increase to 25-30 steps |

## Workflow Notes

- Generate ONE at a time, wait for approval
- Log every generation to generation_log.md
- Check file size - if <500KB at 1280x720, regenerate
- After 10 images, do diversity check - regenerate if >3 are too similar

## 2026-02-28: Rainy Café Lessons

### Critical Fixes Made:
1. **Verify BEFORE approve:** Alfred must run `image` tool on samples BEFORE upscaling
2. **Resolution checkpoint:** Verify 1920x1080 with ffprobe BEFORE video build
3. **Batch mode works:** Generate 10 autonomously, report at 3/6/10, then Alfred verifies
4. **Upscaling is Image Agent's job:** Do it before handing off to Video Agent

### What Went Wrong on Rainy Café First Build:
- Image Agent moved to approved/ without Alfred verification
- No one checked resolution (stayed 1280x720)
- Video Agent built at wrong resolution
- Had to rebuild entire video

### Correct Process Now:
1. Generate 10 at 1280x720 → raw/
2. Alfred verifies quality with `image` tool
3. Upscale to 1920x1080
4. Alfred verifies resolution
5. Move to approved/
6. Video Agent builds
