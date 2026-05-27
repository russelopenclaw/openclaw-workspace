# mem0 - Persistent Memory Layer for Alfred

## Overview
[mem0](https://mem0.ai) is integrated to provide intelligent, self-improving memory management for Alfred.

## What mem0 Adds

### Current Memory System (Before mem0)
- `MEMORY.md` - Curated long-term memory (manual updates)
- `memory/YYYY-MM-DD.md` - Daily raw logs (manual creation)
- Manual search via `memory_search` tool
- Human curates what's worth keeping

### With mem0 Integration
- **Automatic extraction**: Conversations → relevant memories
- **Self-improving**: Learns from each interaction
- **Semantic search**: Vector-based retrieval (not just keyword)
- **Multi-level memory**: User, Session, and Agent state
- **26% better accuracy** than basic context window approaches
- **91% faster** responses, **90% lower token usage**

## Architecture

``
┌─────────────────┐
│  Conversation   │
│  (Telegram,     │
│   Discord, etc) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  mem0.add()     │ ← Automatic memory extraction
│  (stores in     │
│   Qdrant +      │
│   SQLite)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  mem0.search()  │ ← Semantic retrieval on demand
│  (returns       │
│   relevant      │
│   memories)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  LLM Context    │
│  (augmented     │
│   with memories)│
└─────────────────┘
``

## Setup

### Virtual Environment
```bash
cd /home/kevin/.openclaw/workspace
python3 -m venv mem0-env
source mem0-env/bin/activate
pip install mem0ai
```

### Configuration
mem0 is configured in `/home/kevin/.openclaw/workspace/mem0_config.py`

Default settings:
- **Vector store**: SQLite + Qdrant (local)
- **LLM**: Ollama (local, via qwen2.5:7b)
- **Embedding model**: Local (no API key needed)

## Usage

### In Python Sessions
```python
from mem0 import Memory

# Initialize
memory = Memory()

# Add memory from conversation
memory.add([
    {"role": "user", "content": "I prefer dark mode for all apps"},
    {"role": "assistant", "content": "Got it, I'll use dark mode."}
], user_id="kevin")

# Search relevant memories
results = memory.search(query="What's my theme preference?", user_id="kevin")
for item in results['results']:
    print(item['memory'])
    print(f"Score: {item['score']}")
```

### Integration with OpenClaw
mem0 complements (doesn't replace) existing memory tools:

| Task | Use |
|------|-----|
| Curated long-term memory | `MEMORY.md` (still load via `memory_search`) |
| Daily logs | `memory/YYYY-MM-DD.md` |
| Automatic extraction | mem0 (happens in background) |
| Semantic search | mem0 for fast retrieval |

## Memory Categories

mem0 automatically categorizes memories:

1. **User Preferences**: "Kevin prefers dark mode"
2. **Facts**: "Kevin is a Java developer migrating to .NET"
3. **Events**: "Completed Kanban board on 2026-02-20"
4. **Skills**: "Kevin knows Docker, home-lab setup"
5. **Relationships**: "russelopenclaw is Alfred's GitHub account"

## Benefits

### For Kevin
- **No manual curation needed**: mem0 extracts what matters
- **Better recall**: Semantic search finds related info
- **Faster**: Less context to load each session
- **Cheaper**: 90% fewer tokens = lower API costs

### For Alfred
- **Stateful across sessions**: Remembers conversation context
- **Personalized**: Adapts to Kevin's communication style
- **Scalable**: Memory grows intelligently, not just longer

## Migration Plan

### Phase 1: Parallel Operation (Current)
- mem0 runs alongside existing memory system
- Still load `MEMORY.md` via `memory_search`
- mem0 stores conversation history automatically

### Phase 2: Hybrid System
- Use mem0 for fast semantic search
- Use `MEMORY.md` for curated highlights
- Heartbeat job to sync mem0 insights to `MEMORY.md`

### Phase 3: Full Integration (Future)
- mem0 becomes primary memory backend
- `MEMORY.md` becomes optional export/curation layer
- Existing `memory_search` tool routes through mem0

## Configuration Files

- `mem0_config.py` - mem0 settings
- `mem0_env/bin/` - Virtual environment
- `.mem0/` - mem0 data directory (auto-created)

## Troubleshooting

### Issue: mem0 not finding memories
**Solution**: Check that virtual env is activated and mem0 is initialized with correct user_id

### Issue: Slow performance
**Solution**: Use local Ollama model instead of cloud APIs

### Issue: Memory conflicts
**Solution**: mem0 handles deduplication automatically

## Resources

- [mem0 Documentation](https://docs.mem0.ai)
- [GitHub Repository](https://github.com/mem0ai/mem0)
- [Research Paper](https://mem0.ai/research)
- [Demo](https://mem0.dev/demo)

---

**Status**: ✅ Installed | ⏳ Configuration in progress | 📋 Integration pending
