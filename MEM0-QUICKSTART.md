# mem0 Integration - Quick Start

## Your Persistent Memory System is Ready! ✅

**81 memories** embedded with semantic search. Automatic capture & retrieval enabled.

## Enable in Every Session (3 lines)

```javascript
const sessionHook = require('./tools/mem0-session-hook.js');
const init = await sessionHook.initialize({ task: 'your task' });
await sessionHook.captureTurn(userMsg, assistantResponse);
```

## What You Get

- 🧠 **81 persistent memories** (preferences, projects, context)
- 🔍 **Semantic search** (finds concepts, not just keywords)
- 📥 **Auto-capture** (learns from conversations)
- ⏰ **Heartbeat checks** (reminders & deadlines)
- 🚀 **Fast** (~100ms search, all local)

## Example Session

```javascript
const sessionHook = require('./tools/mem0-session-hook.js');

// Start
const init = await sessionHook.initialize({ task: 'OpenClaw work' });
console.log(init.context); // Shows relevant memories

// During conversation
await sessionHook.captureTurn(
  'I prefer async/await over callbacks',
  'Got it, noted your preference!'
);

// Heartbeat
const heartbeat = await sessionHook.heartbeatCheck();
if (heartbeat.reminders.length > 0) {
  console.log('⏰ Reminders:', heartbeat.reminders);
}
```

## Files

- `tools/mem0-session-hook.js` - Auto session integration
- `tools/mem0-tool.js` - Direct API
- `.mem0/kevin-memories.json` - 81 memories
- `docs/mem0-session-setup.md` - Full guide
- `docs/mem0-openclaw-integration.md` - API docs

## Test It

```bash
cd /home/kevin/.openclaw/workspace
node -e "
const hook = require('./tools/mem0-session-hook.js');
(async () => {
  const init = await hook.initialize({ task: 'test' });
  console.log('✅ Initialized:', init.memoryCount, 'memories');
  console.log('📚 Context:', init.context);
})();
"
```

## Status

**Phase 3 Complete** ✅
- 81 memories embedded
- Auto-capture enabled
- Semantic search active
- Production-ready

---

**Start using mem0 now** - just add the 3 lines above to your sessions!
