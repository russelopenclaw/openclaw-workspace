# DadJ Learnings

## Pipeline Knowledge (Accumulated from runs)

### Joke #22 (Test Run - 2026-03-11) ✅
**What do you call a magician who has lost their magic?** Ian.

**Learnings:**
1. ✅ Audio MUST have 1s buffers at start/end (5.7s total: 1s + 3.7s joke + 1s)
2. ✅ Use Georgia serif font (sans-serif makes capital I look like J)
3. ✅ Remotion cache clears required (`rm -rf .remotion`) before each render
4. ✅ 171 frames @30fps = 5.7s (not 218 frames / 7.3s)
5. ✅ ElevenLabs direct API via curl (not CLI wrapper)
6. ⚠️ Llava OCR struggles with punchline text - use Qwen 3.5 Vision instead

### Pipeline Patterns
- One-liner vs Setup-Punchline classification matters for text timing
- Qwen 3.5 Vision validation required for:
  - Background: "no text, colorful cartoon"
  - Video: "text matches joke, rendered correctly"
- MinIO versioning: `{id}-V{n}.mp4`
- Dadabase Used=TRUE flag in column C (row = id+1)

### Pending Questions
- Does Kevin prefer Private or Public YouTube uploads?
- Should auto-approve after N successful runs?
- Joke quality ratings from Kevin?

---

*This file grows with each run. Alfred centralizes across all agents.*
