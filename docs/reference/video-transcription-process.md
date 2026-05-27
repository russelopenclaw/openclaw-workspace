# Video Transcription Standard Process

When Kevin asks to transcribe a video, follow this process exactly.

## Step 1: Download & Extract

```bash
# Get video info
yt-dlp --print title --print duration "VIDEO_URL"

# Extract audio (compressed for API upload)
yt-dlp -x --audio-format mp3 -o "/tmp/youtube_transcript.%(ext)s" "VIDEO_URL"

# OR: download YouTube captions (faster, no API key needed)
yt-dlp --write-auto-sub --sub-lang en --skip-download --sub-format json3 -o "/tmp/youtube_transcript_subs" "VIDEO_URL"
```

**Priority order:**
1. YouTube auto-captions via `--write-auto-sub` (fastest, free, good enough)
2. OpenAI Whisper API `gpt-4o-transcribe-diarize` (best quality, costs money, 25MB limit)
3. Local Whisper (if available, free but slower)

## Step 2: Create Three Files

All files go in `/mnt/openclaw/workspace/transcriptions/` with naming pattern:
`YYYY-MM-DD_Display_Name_With_Underscores.{ext}`

### File 1: `.txt` — Raw Timestamped Transcript
- Every caption segment with `[MM:SS]` timestamp
- One segment per line
- This is the source-of-truth raw data

```
[00:00] This could be one of the biggest
[00:01] comebacks in the AI space.
[00:03] Over the past years, OpenAI went from
```

### File 2: `_READABLE.md` — Formatted Summary
This is the **primary deliverable** Kevin reads. Follow this format exactly:

```markdown
# Video Title Here

**Creator:** Channel/Creator Name  
**Source:** [YouTube](URL)  
**Duration:** MM:SS  
**Transcription:** YouTube auto-captions (full video coverage)

---

## Introduction

Full paragraph of clean, readable prose. Join raw caption fragments
into flowing sentences and paragraphs. Remove filler words, fix grammar,
make it read like an article.

## Topic Section Title

Continue with clean paragraphs organized by topic. Add `## Section` headers
at natural topic transitions in the video.

## Another Topic

- Use **bold** for key terms and takeaways
- Use bullet lists for comparisons or lists the speaker makes
- Use `code formatting` for technical terms, CLI commands, file names
- Use `> blockquote` for direct quotes or important callouts

## Final Verdict / Conclusion

End with the speaker's conclusions or takeaways.
```

**READABLE.md rules:**
- **NO raw timestamps** in the body (only in the header metadata)
- **NO mid-sentence line breaks** — merge caption fragments into flowing paragraphs
- **Section headers** (`##`) at every natural topic transition
- **Bold speaker labels** (`**Speaker:**`) for dialogue/interviews
- **Italic bracketed notes** (`*[Ad break]*`) for non-speech events
- **Fix obvious caption errors** (homophones, dropped words)
- **Preserve the speaker's voice** — don't rewrite their style, just clean it up
- **Include ALL content** — don't skip sections. If video is 30 min, transcript covers 30 min

### File 3: `.meta.json` — Metadata

```json
{
  "displayName": "Full Video Title",
  "originalName": "youtube_VIDEO_ID",
  "sourceUrl": "https://youtu.be/VIDEO_ID",
  "createdAt": "2026-05-26T19:30:00-05:00",
  "duration": 1594,
  "language": "en",
  "model": "youtube-captions",
  "type": "youtube-video"
}
```

Fields:
- `displayName`: Human-readable title (shown in MC UI)
- `originalName`: Source identifier (`youtube_ID` or filename)
- `sourceUrl`: Original video URL
- `createdAt`: ISO timestamp
- `duration`: Duration in seconds
- `language`: Language code
- `model`: Transcription method used
- `type`: `youtube-video`, `podcast`, `audio-file`, etc.

## Step 3: Verify in Mission Control

```bash
# Check it appears in the API
curl -s http://localhost:8765/api/transcriptions | python3 -c "
import sys,json
d = json.load(sys.stdin)
for t in d.get('transcriptions', []):
    if 'YOUR_TITLE' in t.get('displayName',''):
        print(json.dumps(t, indent=2))
"
```

## Quick Reference

| Task | Command |
|------|---------|
| Download captions | `yt-dlp --write-auto-sub --sub-lang en --skip-download --sub-format json3 -o "/tmp/youtube_transcript_subs" "URL"` |
| Download audio | `yt-dlp -x --audio-format mp3 -o "/tmp/youtube_transcript.%(ext)s" "URL"` |
| Transcribe via API | `bash ~/.npm-global/lib/node_modules/openclaw/skills/openai-whisper-api/scripts/transcribe.sh FILE --model gpt-4o-transcribe-diarize --json --out /tmp/transcript.json` |
| Storage dir | `/mnt/openclaw/workspace/transcriptions/` |
| Naming pattern | `YYYY-MM-DD_Title_With_Underscores.{txt,meta.json,_READABLE.md}` |