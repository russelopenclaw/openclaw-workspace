# Dad Joke n8n Orchestrator - Hybrid Pipeline

## Overview

New hybrid approach combining n8n webhook + local agent execution:

1. **n8n** handles Dadabase lookup (finds next unused joke)
2. **Local agent** handles generation pipeline (audio → video → upload)

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   n8n       │     │  Orchestrator   │     │   Services      │
│  Webhook    │────▶│  (Node.js)      │────▶│   ElevenLabs    │
│  (Dadbse)   │     │                 │     │   SD (msi:7860) │
└─────────────┘     └──────────────────┘     │   Remotion      │
                                             │   YouTube       │
                                             │   MinIO         │
                                             └─────────────────┘
```

## Usage

### Full Pipeline
```bash
node tools/dadjoke-n8n-orchestrator.js
```

### Test n8n endpoint
```bash
curl https://n8n.wolfeinkc.uk/webhook/b33fd5b7-e682-4309-a454-3c4180029743
```

### Test classification only
```bash
node -e "
const { fetchJokeFromN8N, classifyJokeStructure } = require('./tools/dadjoke-n8n-orchestrator.js');
fetchJokeFromN8N().then(j => {
  console.log('Joke:', j['Joke']);
  console.log('Format:', classifyJokeStructure(j['Joke']));
});
"
```

## Pipeline Steps

| Step | Action | Tool | Output |
|------|--------|------|--------|
| 1 | Fetch joke | n8n webhook GET | `{row_number, Joke ID, Joke, Used, Posted}` |
| 2 | Classify | Heuristic (sentence count, comma) | `one-liner`, `one-liner-comma`, `setup-punchline` |
| 3 | Format | Split into segments | `{Joke, format, segments: [{text, type}]}` |
| 4 | **Check cache** | MinIO stat | `audio-{ID}-{date}.mp3` (if exists) |
| 5a | **Cache hit** | MinIO download | Reuse existing audio (skip generation) |
| 5b | **Cache miss** | n8n webhook POST | Generate new `audio.mp3` (padded, ~5-7s) |
| 6 | **Upload cache** | MinIO cp | `hp1/dadjokes/{ID}/audio-{ID}-{date}.mp3` |
| 7 | Verify | ffprobe | Duration check (min 5s) |
| 8 | BG | SD (msi:7860) | `background.png` (720x1280) |
| 9 | Props | JSON gen | `props.json` (Remotion params) |
| 10 | Render | Remotion | `joke-NN-V1.mp4` |
| 11 | MinIO | mc | `hp1/dadjokes/NN/video/` |
| 12 | YouTube | Python uploader | Private upload |
| 13 | Dadabase | gog sheets | `Used=TRUE`, `Posted=TRUE` |

## Joke Classification

| Type | Detection | Treatment |
|------|-----------|-----------|
| **One-liner** | 1 sentence, no comma | Text appears once, continuous |
| **One-liner-comma** | 1 sentence, has comma | Text appears once, slight pause |
| **Setup-punchline** | 2+ sentences | Setup fades in, punchline pops (orange) |

## Files

- **Script**: `tools/dadjoke-n8n-orchestrator.js`
- **Schedule**: `cron/auto-dadjoke.json` (6 AM daily)
- **Output**: `dadtasticdads-output/joke-NN-V{N}.mp4`
- **Docs**: `dadjasticdads-remotion/PRODUCTION-RUNBOOK.md`

## Environment Variables

```bash
export ELEVENLABS_API_KEY="your-key-here"
export GITHUB_TOKEN="ghp_xxx"  # Not needed for pipeline
```

## Error Handling

- n8n webhook: Retries 3x on failure
- ElevenLabs: Falls back to cached voice if API fails
- SD: Falls back to gradient background if msi unreachable
- Remotion: Clears `.remotion` cache before each render
- YouTube: Uploads as Private (manual publish)

## Testing

```bash
# Test n8n endpoint
curl https://n8n.wolfeinkc.uk/webhook/b33fd5b7-e682-4309-a454-3c4180029743

# Test full pipeline (dry run)
node tools/dadjoke-n8n-orchestrator.js --test

# Run full pipeline
node tools/dadjoke-n8n-orchestrator.js
```

## Naming Convention (Versioned)

All assets use versioned naming to support regeneration without overwriting:

| Asset | Pattern | Example |
|-------|---------|---------|
| **Audio** | `audio-{ID}-V{N}.mp3` | `audio-26-V1.mp3` |
| **Background** | `bg-{ID}-V{N}.png` | `bg-26-V1.png` |
| **Video** | `video-{ID}-V{N}.mp4` | `video-26-V1.mp4` |

**Version increment:**
- First run: V1
- Regenerate: V2, V3, etc.
- Auto-detected via `mc ls` pattern matching

**MinIO structure:**
```
hp1/dadjokes/
├── 26/
│   ├── audio-26-V1.mp3
│   ├── bg-26-V1.png
│   └── video-26-V1.mp4
├── 27/
│   └── ...
```

---

## Migration from Legacy

**Old flow**: `auto-dadjoke-runner.js` → gog sheets → ElevenLabs → Remotion

**New flow**: n8n webhook → `dadjoke-n8n-orchestrator.js` → same pipeline

**Benefits**:
- n8n handles Dadabase logic (row lookup, Used flag)
- Cleaner separation: n8n = data, agent = generation
- Versioned naming supports regeneration without overwriting
- Easier to add new steps (e.g., LLM classification, OCR validation)

---

**First Run**: Joke #26 "I used to run a dating service for chickens, but I was struggling to make hens meet."
**Format**: One-liner with comma break
**Status**: Ready for full pipeline test
