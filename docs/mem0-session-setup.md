# mem0 Session Hook - Setup Guide

## Drop-In Integration for OpenClaw

Two ways to enable automatic memory in every session:

## Method 1: Manual Import (Recommended)

Add this to your session initialization code:

```javascript
// At the start of your session
const sessionHook = require('./tools/mem0-session-hook.js');

// Initialize (auto-retrieves relevant memories)
const mem0Context = await sessionHook.initialize({
  task: 'current task description'
});

// Optional: Inject into LLM context
if (mem0Context.context) {
  console.log('📚 Memory Context:');
  console.log(mem0Context.context);
}

// During conversation - auto-capture after each exchange
await sessionHook.captureTurn(userMessage, assistantResponse);

// For heartbeats - check for time-sensitive items
const heartbeat = await sessionHook.heartbeatCheck();
```

## Method 2: Auto-Load via OpenClaw Session Startup

Create a session wrapper that auto-initializes mem0:

### Step 1: Create Session Wrapper

```javascript
// tools/session-wrapper.js
const sessionHook = require('./mem0-session-hook.js');

module.exports = {
  async startSession(context) {
    // Initialize mem0
    const mem0Init = await sessionHook.initialize(context);
    
    // Return enhanced context
    return {
      ...context,
      memoryContext: mem0Init.context,
      memories: mem0Init.startupMemories,
    };
  },
  
  async onMessage(userMessage, assistantResponse) {
    // Auto-capture conversation
    await sessionHook.captureTurn(userMessage, assistantResponse);
  },
  
  async onHeartbeat() {
    // Check for time-sensitive memories
    return await sessionHook.heartbeatCheck();
  },
};
```

### Step 2: Use in Your Sessions

```javascript
const wrapper = require('./tools/session-wrapper.js');

// Start session with mem0
const session = await wrapper.startSession({
  task: 'Working on mem0 integration'
});

// Access memory context
console.log(session.memoryContext);

// After each message pair
await wrapper.onMessage(userMsg, assistantMsg);
```

## Configuration

Edit `tools/mem0-session-hook.js` to customize:

```javascript
const CONFIG = {
  userId: 'kevin',                    // Your user ID
  autoRetrieve: true,                 // Auto-retrieve at startup
  autoCapture: true,                  // Auto-capture conversations
  retrieveQuery: 'context task goal', // What to search for at startup
  maxStartupMemories: 3,              // How many memories to load
  heartbeatCheck: true,               // Enable heartbeat checks
  heartbeatQuery: 'reminder deadline', // What to look for in heartbeat
  debugMode: false,                   // Enable logging
};
```

## Example: Full Session Flow

```javascript
const sessionHook = require('./tools/mem0-session-hook.js');

async function runSession() {
  // 1. Initialize
  console.log('Starting session...');
  const init = await sessionHook.initialize({
    task: 'OpenClaw development'
  });
  
  console.log(`Loaded ${init.memoryCount} memories`);
  console.log(init.context); // Formatted context
  
  // 2. Conversation loop
  const conversation = [
    { user: 'I prefer TypeScript over JavaScript', response: 'Got it!' },
    { user: 'What was that preference?', response: 'You prefer TypeScript' },
  ];
  
  for (const turn of conversation) {
    // Auto-capture
    await sessionHook.captureTurn(turn.user, turn.response);
    
    // Optional: retrieve context-aware memories
    const context = await sessionHook.retrieve(turn.user, 2);
    // Use context to enhance response...
  }
  
  // 3. Heartbeat check
  const heartbeat = await sessionHook.heartbeatCheck();
  if (heartbeat.reminders.length > 0) {
    console.log('⏰ Reminders:', heartbeat.reminders);
  }
  
  // 4. Get stats
  const state = sessionHook.getState();
  console.log(`Session: ${state.totalMemories} memories total`);
}

runSession();
```

## Output Example

```
Starting session...
Loaded 81 memories
📚 Relevant Memories:
  1. [0.709] Usage: `node mem0-integration.js --add/search/stats`
  2. [0.702] - mem0 Integration Phase 3 Complete
  3. [0.691] Kevin's code should go to russelopenclaw GitHub

Session: 81 memories total
```

## API Reference

### `initialize(context)`
Initialize mem0 for session. Auto-retrieves relevant memories.

**Returns:**
```javascript
{
  success: true,
  memoryCount: 81,
  hasEmbeddings: true,
  startupMemories: [...],  // Array of memories
  context: '📚 Relevant Memories:\n...'  // Formatted string
}
```

### `captureTurn(userMessage, assistantMessage)`
Capture memory from conversation turn.

**Returns:** Number of memories captured (0-2)

### `retrieve(query, limit)`
Manual memory retrieval.

**Returns:** Array of memories with scores

### `heartbeatCheck()`
Check for time-sensitive memories.

**Returns:**
```javascript
{
  reminders: [...],    // Time-sensitive items
  allMemories: [...],  // All retrieved
  context: '...'       // Formatted string
}
```

### `getState()`
Get current session state.

**Returns:** Session stats and state

### `exportAll()`
Export all memories as JSON array.

## Troubleshooting

### Memories not loading?
- Check that `.mem0/kevin-memories.json` exists
- Verify Ollama is running: `curl http://192.168.1.33:11434/api/tags`
- Check file permissions on `.mem0/`

### Capture not working?
- Ensure messages have `{role, content}` format
- Check `autoCapture` is enabled in CONFIG
- Messages < 20 chars or questions won't be captured

### Slow performance?
- First embed takes ~50ms (Ollama cold start)
- Subsequent searches: ~100ms for 80 memories
- Enable `debugMode: true` to see timing

## Best Practices

1. **Initialize early**: Call `initialize()` at session start
2. **Capture selectively**: Not every message needs to be a memory
3. **Use context**: Inject returned context into LLM prompts
4. **Heartbeat smart**: Use heartbeat to check for reminders
5. **Monitor growth**: Check `getState()` periodically

---

**Status**: Production-Ready ✅ | **81 Memories** | **Auto-Capture Active**
