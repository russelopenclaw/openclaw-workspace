## Dad Joke Pipeline (Production ✅ 2026-03-11)

**Tested on:** Joke #22 "What do you call a magician who has lost their magic? Ian."

**Pipeline:** ElevenLabs TTS → SD background → Remotion text → YouTube (Private)

**Key learnings:**
1. **Audio MUST have 1s buffers** at start/end (5.7s total: 1s + 3.7s joke + 1s)
2. **Use Georgia serif font** (sans-serif makes capital I look like J)
3. **Remotion clears** required (`rm -rf .remotion`) before each render
4. **171 frames @30fps** = 5.7s (not 218 frames / 7.3s)
5. **ElevenLabs direct API** via curl (not CLI wrapper)
6. **Llava OCR struggles** with punchline text - human visual confirmation required
7. **SD text artifacts** (2026-03-19): AI backgrounds often hallucinate text/ghosting - use negative prompts
8. **Validation tolerance:** 3 attempts max, then human review (don't stall automation)

**Files:**
- Runner: `tools/auto-dadjoke-runner.js` (scheduled 6 AM daily)
- Schedule: `cron/auto-dadjoke.json`
- Docs: `dadjasticdads-remotion/PRODUCTION-RUNBOOK.md`
- Cheat sheet: `TOOLS.md` dad joke section

**Database:** Dadabase (Google Sheets) tracking Used/Posted flags
**Storage:** MinIO `hp1/dadjokes/{id}/` with versioning (`-V{n}.mp4`)
**YouTube:** Auto-upload to Private (no approval needed)

**Recent Jokes:**
- #28: "How do you organize a space party? You planet." ✅ Posted (Mar 25) - validation caught AI artifacts, regenerated successfully
- #30: "It's raining cats and dogs, so be careful not to step in a poodle." ✅ Posted
- #31+: ⏳ Backlogged (gog auth failure since Mar 24)

---
- Tool call best practices
- Recovery procedures

**Maintenance:** Docs are living — update as system evolves or new patterns emerge.
enclaw image` command not found in subprocess context
- Fallback: Text-based validation (checks file existence, skips OCR)
- Fix needed: Use `image` tool API directly instead of CLI command

---
- Tool call best practices
- Recovery procedures

**Maintenance:** Docs are living — update as system evolves or new patterns emerge.
