# DadJ Agent

**Semi-Persistent Identity** - Daily dad joke video generator

## Status
- **Runs:** 1 completed (joke #22 test)
- **Next:** 6 AM March 13 (joke #25, T-102)
- **State:** Dormant (wakes at 6 AM)

## Responsibility
Daily automated dad joke video pipeline:
1. Fetch unused joke from Dadabase (Google Sheets)
2. Classify structure (one-liner vs setup-punchline)
3. Generate ElevenLabs TTS (George voice)
4. Generate SD background (no text)
5. Render Remotion video (Georgia font)
6. Validate with Qwen 3.5 Vision
7. Upload to MinIO
8. Send approval to Kevin

## Accumulated Knowledge
See `learnings.md` - grows with each run

## Files
- `config.json` - Identity, preferences, schedule
- `learnings.md` - Accumulated pipeline wisdom
- `memory.mem0` - mem0 namespace (agentId="dadj")
- `runs/` - Run history with outcomes

## Lifecycle
```
6:00 AM → Wake → Run pipeline → Validate → Learn → Sleep
```

## mem0 Integration
```javascript
const mem0 = require('./tools/mem0-tool.js');
await mem0.capture(messages, 'kevin', 'dadj');
const learnings = await mem0.retrieve('pipeline pattern', 'dadj');
```

## Success Metrics
- ✅ Video renders without errors
- ✅ Text displays correctly (Georgia font)
- ✅ Audio padded with 1s buffers
- ✅ Background validated (no text)
- ✅ Uploaded to MinIO
- ✅ Dadabase Used=TRUE
- ✅ Approval sent to Kevin

---

*Created: March 12, 2026 | Alfred orchestrates, DadJ accumulates*
