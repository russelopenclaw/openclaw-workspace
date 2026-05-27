# Video Delivery Agent - Steps 7-8 Only

## Purpose
Take the ~300s seamless video, loop it to 3600s (60 min), and deliver to network storage.

## Why Split?
Looping 12x creates a ~900MB file and takes 5-10 minutes. This causes timeouts in the full video agent.
By separating delivery, the Build Agent can finish fast (~5 min), and Delivery handles the heavy lifting.

## Input
- `seamless.mp4` (~300s, ~30MB) in `/path/to/work/`
- Target deliver path: `/mnt/openclaw/workspace/screensavers/{theme}/`
- Copy source images: `/path/to/approved/*.png`

## 2 Steps

### Step 7: Loop to 3600s
```bash
cd /path/to/work/

# Create concat list
rm -f loops.txt
for i in $(seq 1 12); do echo "file 'seamless.mp4'" >> loops.txt; done

# Loop 12x (fast, -c copy)
ffmpeg -y -f concat -safe 0 -i loops.txt -c copy loop_12x.mp4

# Trim to exactly 3600s (60 min)
ffmpeg -y -t 3600 -i loop_12x.mp4 -c copy {theme}_60min.mp4
```

### Step 8: Deliver to Network
```bash
# Copy video
cp {theme}_60min.mp4 /mnt/openclaw/workspace/screensavers/{theme}/

# Copy images
cp /path/to/approved/*.png /mnt/openclaw/workspace/screensavers/{theme}/
```

## Verification
After delivery, verify:
```bash
VIDEO="/mnt/openclaw/workspace/screensavers/{theme}/{theme}_60min.mp4"
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $VIDEO
  # Should be: 3600.000000
ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 $VIDEO
  # Should be: 1920,1080
ls -lh $VIDEO
  # Should be: 800MB-1.2GB depending on content
```

## Report
```
✅ Delivery Complete
- Video: {path}
- Duration: 3600s (60 min)
- Resolution: 1920x1080
- Size: {size}MB
- Images: 10 PNGs copied
```

## Expected Timing
- Loop 12x: ~2-3 min
- Trim: ~5-10 sec
- Copy: ~30 sec
- **Total: ~3-4 minutes**

## Spawn Previous
This agent should be spawned AFTER **Video Build Agent** completes Build Steps 1-6.
