# Video Agent Memory

## Learned Patterns

### What Works
- 10 images at 30s each = 300s base
- 9 transitions at 3s each (offset 27, 54, 81, 108, 135, 162, 189, 216, 243)
- Cycle duration: 273s (300 - 27)
- 15 cycles = ~60 minutes

### Verification Checklist (MUST DO)
1. Extract first and last frame, compare file sizes
2. If sizes match = seamless loop
3. If sizes differ = hard cut at loop point
4. Check internal transitions at offset-3, offset, offset+1

### Known Issues & Fixes

#### Hard Cut at Loop Boundary
- **Problem**: Video ends on image 10, starts on image 1 - hard cut
- **Attempted fix**: Add 10th transition (10→1) at offset 270 - didn't work reliably
- **Current solution**: Accept hard cut at loop, internal transitions work
- **Better approach needed**: Build entire video in single pass with all transitions

### Common FFmpeg Commands
- Image to 30s segment: `ffmpeg -y -loop 1 -i {img}.png -c:v libx264 -t 30 -r 25 -pix_fmt yuv420p {out}.mp4`
- Upscale: `ffmpeg -y -i {in}.png -vf "scale=1920:1080:flags=lanczos" {out}.png`

## 2026-02-28: Rainy Café Lessons

### Critical Fixes Made:
1. **6 explicit checkpoints** where Alfred verifies before proceeding
2. **Step 6: 10→1 transition** - cycle_seamless must be ~300s (not 273s)
3. **Step 8: Copy images** to network with video (11 files total)
4. **Final checklist mandatory** - resolution, duration, size, first/last frame match

### What Went Wrong:
- Video Agent built without Alfred checkpoints
- No verification of 10→1 transition
- Images not copied to network
- Resolution wrong (1280x720 instead of 1920x1080)

### Correct Process Now:
- Incremental build (segs→pairs→quads→octet→cycle→seamless→loop)
- Alfred verifies at steps 1, 3, 5, 6 (quality/duration checkpoints)
- Final checklist: resolution 1920x1080, duration 3600s, 11 files in folder
