# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

### Whisper Local Transcription (Free!)

- **Service**: `whisper-api` systemd user service (port 8777, auto-starts)
- **Model**: `base` (143MB, ~2-3x real-time on CPU)
- **Available models**: tiny (75MB), base (143MB), small (488MB), medium (1.5GB), large-v3 (3GB)
- **API**: POST `http://localhost:8777/transcribe` (send audio binary)
- **Health**: GET `http://localhost:8777/health`
- **CLI**: `node tools/whisper-transcribe.js <audio_file> [--model base] [--language en]`
- **Full Pipeline**: `node tools/whisper-transcribe-and-save.js <audio_file> [--name "Display Name"]`
- **YouTube**: `node tools/whisper-transcribe-and-save.js --youtube <url> [--name "Display Name"]`
- **Direct Python**: `whisper-env/bin/python3 tools/whisper-transcribe.py <audio_file>`
- **Venv**: `/home/kevin/.openclaw/workspace/whisper-env/`
- **Speed**: ~2-3x real-time on Optiplex (8-core i7, CPU only)
- **Cost**: FREE (local, no API calls)
- **Formats**: wav, mp3, m4a, ogg, webm, flac, mp4
- **Long files**: Auto-chunks files >30 min into 15-min segments
- **YouTube**: Downloads audio via yt-dlp, then transcribes locally
- **Transcriptions page**: http://192.168.1.56:8765/transcriptions
- **Storage**: `/mnt/openclaw/workspace/transcriptions/`
- **To change model**: Edit `~/.config/systemd/user/whisper-api.service` and restart

**Quick test**: `curl -s http://localhost:8777/health`

### Google Sheets

- **Dadabase**: 1cXSGjCXleUK8iQweBAwLaa7j3QK2Sla-8v11CirQsuw
  - Columns: Joke ID, Joke, Used, Posted
  - Service: gog (russelopenclaw@gmail.com)

### MinIO (hp1)

- Web UI: http://hp1:9001
- S3 API: http://hp1:9000
- Access Key: admin
- Secret Key: password123

### GitHub

- Token: saved in openclaw.json (env.GITHUB_TOKEN)
- Account: russelopenclaw (for code push)

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
- ALWAYS use Qwen 3.5 vision to verify before sending:
  ```bash
  python3 tools/verify-video.py {mp4_path}  # Extracts frame, calls Qwen 3.5
  ```
- Check: Text correct? Background generated (not solid color)?

**Common Bugs & Fixes:**
| Issue | Symptom | Fix |
|-------|---------|-----|
| Props escaping | Text shows "text" literal | Use `--props-file` flag, not inline JSON |
| Missing image | Solid blue background | Check `msi:7860` reachable, increase SD timeout |
| Wrong host | Ollama/SD unreachable | Use `msi` hostname, not `192.168.1.33` |
| Text repetition | Setup + punchline both show | One-liner: single segment at 0% |
| File too large | 1.9MB vs 150KB expected | Remotion renders HQ by default — don't compress |
| **Audio starts immediately** | No silence buffer at start | Pad audio: `1s silence + audio + 1s silence` (total ~5.7s) |
| **'Ian' reads as 'Jan'** | Sans-serif fonts (I↔J confusion) | Use serif font: `Georgia, serif` (distinct capital I) |
| **Text not rendering** | Blank video, no overlay | Check `SegmentText.tsx` props, clear `.remotion` cache |
| **Wrong color** | Punchline not orange | Verify `textColor = '#FF8A2B'` in SegmentText |
| **Duration wrong** | Video 7.3s not 5.7s | Update `durationInFrames={171}` in DadJokeVideo.tsx (30fps × 5.7s) |
| **ElevenLabs not working** | Silent audio | Use direct curl API, props file has correct `audio.mp3` path |

**Production Pipeline (Tested 2026-03-11 - Joke #22 ✅):**

1. **Fetch joke from Dadabase** (Google Sheets via `gog`):
   ```bash
   gog sheets get 1cXSGjCXleUK8iQweBAwLaa7j3QK2Sla-8v11CirQsuw "Sheet1!A:D"
   # Find first row where Used=FALSE (column C), extract joke text (column B)
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

5. **Generate SD background** (msi:7860, 720x1280 portrait):
   ```bash
   curl -X POST "http://msi:7860/sdapi/v1/txt2img" \
     -H "Content-Type: application/json" \
     -d '{"prompt": "Dad joke background, colorful cartoon, no text", "width": 512, "height": 768}' \
     | jq -r '.images[0]' | base64 -d > background.png
   ```

6. **Copy assets to Remotion public/**:
   ```bash
   cp padded_audio.mp4 dadtasticdads-remotion/public/audio.mp3
   cp background.png dadtasticdads-remotion/public/background.png
   ```

7. **Render with Remotion** (Georgia font, 171 frames @30fps = 5.7s):
   ```bash
   cat > props.json << EOF
   {"joke":"JOKETEXT","format":"setup-punchline","segments":[
     {"text":"SETUP","atPercent":0.175,"display":"fade-in"},
     {"text":"PUNCHLINE","atPercent":0.73,"display":"pop-in"}
   ]}
   EOF
   cd dadtasticdads-remotion && npx remotion render "DadJokeVideo" "DadJokeVideo" \
     "../output/video.mp4" --props=props.json --duration-in-frames=171
   ```

8. **Validate with llava** (extract frames, verify text):
   ```bash
   ffmpeg -ss 2 -i video.mp4 -vframes 1 setup_frame.png  # Should show setup text
   ffmpeg -ss 4.5 -i video.mp4 -vframes 1 punch_frame.png # Should show "Ian." not "Jan"
   # Use llava: "What text is visible?"
   ```

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

### Subagent Monitoring

- **Monitor**: `node tools/start-health-monitor.js`
- **Stop**: `node tools/stop-health-monitor.js`
- **Logs**: `.learnings/SUBAGENT-HEALTH.log`
- **Registry**: `.learnings/SUBAGENT-REGISTRY.json`
- **Respawn Queue**: `.learnings/SUBAGENT-RESPAWN-QUEUE.json`
- **Docs**: `tools/SUBAGENT-MONITORING.md`

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.
