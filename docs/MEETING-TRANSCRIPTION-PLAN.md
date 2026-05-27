# Meeting Transcription — Implementation Plan

**Created:** 2026-05-14  
**Goal:** Transcribe meetings via phone (real-time or recorded), fully self-hosted

---

## What We Have

- **OpenAI API key** (cloud Whisper API, ~$0.006/min)
- **Ollama** on msi (192.168.1.33) — for LLM summarization
- **Optiplex server** — 8-core i7-4770S, 16GB RAM, no GPU
- **ffmpeg** installed
- **OpenClaw** with Whisper API skill + message delivery
- **Kevin's phone** — iOS (assumed based on Apple ecosystem)

---

## Option A: OpenAI Whisper API + Phone Voice Memo (Simplest)

**Workflow:**
1. Record meeting on phone (Voice Memos / Voice Recorder)
2. Send audio file to me (Telegram) or drop in a shared folder
3. I transcribe via OpenAI Whisper API (~$0.36/hour of audio)
4. I summarize with local Ollama model
5. Deliver transcript + summary to your Telegram

**Pros:** Zero setup, works today, highly accurate, cheap  
**Cons:** Not real-time, requires manual step to share audio  
**Cost:** ~$0.006/min ($0.36/hr)

**Setup time:** 5 minutes (script already exists)

---

## Option B: Self-Hosted WhisperLive Server (Real-Time Capable)

**Architecture:**
```
Phone (mic) → WebSocket → WhisperLive Docker → Transcript → Ollama → Summary
```

**Components:**
- **[docker-whisper-live](https://github.com/hwdsl2/docker-whisper-live)** — faster-whisper based, WebSocket streaming, OpenAI-compatible REST API
- Runs on Optiplex in Docker
- Phone connects via WebSocket client app
- ~730MB image, `base` model ~145MB

**Pros:** Real-time streaming, fully local, no API costs, privacy  
**Cons:** CPU-only = slower than GPU (base model OK, medium will lag), needs phone client app  
**Cost:** Free (electricity only)

**Hardware constraints:**
- No GPU → `base` or `small` model only for real-time
- `base.en` = ~74MB, ~10x real-time on CPU (fine for streaming)
- `medium` = too slow for real-time on CPU, OK for file transcription

**Setup time:** 30-60 min

---

## Option C: Meetily (Full Meeting Assistant)

**[Meetily](https://github.com/nickschad/Meetily)** — Open-source meeting companion

**Features:**
- Whisper.cpp for local transcription
- Ollama for local summarization
- Web UI for meeting management
- Google Meet + MS Teams integration
- Speaker diarization (who said what)

**Pros:** Full-featured, polished UI, local+private, active development  
**Cons:** Newer project (v0.0.5), Docker setup, needs more resources  
**Cost:** Free

**Setup time:** 1-2 hours

---

## Option D: Hybrid (Recommended 🏆)

**Best of both worlds — simple + powerful:**

### For Recorded Meetings (Quick & Easy)
1. Record on phone → share audio to Telegram
2. OpenClaw detects audio → auto-transcribe via Whisper API
3. Ollama summarizes → deliver to Telegram

### For Real-Time Meetings
1. Deploy `docker-whisper-live` on Optiplex
2. Phone app streams mic via WebSocket
3. Live transcript appears in real-time
4. After meeting: Ollama generates summary + action items

### Cost
- Recorded: ~$0.36/hr (Whisper API)
- Real-time: Free (self-hosted)

---

## Implementation Steps (Hybrid — Option D)

### Phase 1: Recorded Transcription (Day 1 — 30 min)
- [ ] Verify Whisper API skill works end-to-end
- [ ] Create `tools/transcribe-meeting.sh`:
  - Accept audio file (m4a, mp3, wav, ogg)
  - Transcribe via OpenAI Whisper API
  - Save transcript to `transcripts/YYYY-MM-DD/`
  - Pass transcript to Ollama for summary
  - Deliver both to Telegram
- [ ] Test: send a voice memo → get transcript + summary back

### Phase 2: Auto-Detect Audio in Telegram (Day 2 — 15 min)
- [ ] OpenClaw already receives voice/audio messages
- [ ] Hook: when audio received, auto-transcribe + summarize
- [ ] Add keyword trigger: "transcribe" or voice note > 1 min

### Phase 3: Self-Hosted WhisperLive (Week 1 — 1 hr)
- [ ] Deploy docker-whisper-live on Optiplex:
  ```bash
  docker run -d --name whisper-live \
    -p 43000:43000 \
    -e MODEL_SIZE=base \
    -e COMPUTE_TYPE=int8 \
    hwdsl2/docker-whisper-live
  ```
- [ ] Test REST API transcription
- [ ] Test WebSocket streaming with a client

### Phase 4: Phone Client (Week 2)
- [ ] Research iOS apps that support WebSocket mic streaming
  - **WhisperLive iOS** (official client exists)
  - **Custom Shortcut** using HTTP shortcuts
  - **Safari PWA** with Web Audio API
- [ ] Configure phone to connect to Optiplex WhisperLive

### Phase 5: Full Pipeline (Week 2-3)
- [ ] Post-meeting: auto-summarize with Ollama
- [ ] Extract action items, key decisions, follow-ups
- [ ] Save to PostgreSQL tasks table
- [ ] Daily summary of all meetings

---

## Quick Demo Script (Phase 1)

```bash
# Already works today:
# 1. Send me an audio file on Telegram
# 2. I'll run:
~/.npm-global/lib/node_modules/openclaw/skills/openai-whisper-api/scripts/transcribe.sh /path/to/audio.m4a
# 3. Then summarize with Ollama
# 4. Send you transcript + summary
```

---

## Cost Comparison

| Option | Setup | Per-Meeting Cost | Real-Time | Privacy |
|--------|-------|-------------------|-----------|---------|
| A: Whisper API | 5 min | $0.36/hr | No | Cloud |
| B: WhisperLive | 1 hr | Free | Yes | Local |
| C: Meetily | 2 hr | Free | Yes | Local |
| D: Hybrid | 2 hr | $0.36/hr or Free | Both | Both |
| Otter.ai | 0 min | $17/mo | Yes | Cloud |
| Fireflies.ai | 0 min | $12/mo | Yes | Cloud |

---

## Recommendation

**Start with Option A today** — just send me a voice memo and I'll transcribe + summarize it. Zero setup.

**Then deploy WhisperLive** when you want real-time. The CPU can handle the `base` model for streaming, and the `medium` model for higher-accuracy file transcription.

The hybrid approach gives you the best experience: instant results for quick recordings, real-time streaming for important meetings, and everything stays under your control.