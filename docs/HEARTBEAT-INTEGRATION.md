# Heartbeat Integration - Automated Task Orchestration

## Overview

The **Heartbeat Runner** is the central orchestrator that runs during Alfred's heartbeat cycles, coordinating:

1. Sub-agent pool management (auto-scaling)
2. System health checks
3. Briefing queue processing
4. Proactive task assignment

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Alfred (Main Session - Every Heartbeat ~2 min)             │
│                                                              │
│  const runner = require('./tools/heartbeat-runner.js');     │
│  await runner.runHeartbeat({ sessions_spawn });              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  heartbeat-runner.js                                        │
│                                                              │
│  1. Pool Manager → Spawns sub-agents for backlog            │
│  2. Health Check → Verifies services                        │
│  3. Briefing Queue → Processes pending messages             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  subagent-pool-manager.js                                   │
│                                                              │
│  - Queries PostgreSQL backlog                               │
│  - Detects task types (code/research/quick)                 │
│  - Selects appropriate models                               │
│  - Calls sessions_spawn tool                                │
│  - Updates task assignee='auto-pool'                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Sub-Agents (spawned on demand)                             │
│                                                              │
│  - Execute assigned tasks                                   │
│  - Report completion                                        │
│  - Auto-terminate                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Integration Pattern

### In Alfred's Main Session

When Alfred receives a heartbeat or periodic check, execute:

```javascript
// Load the heartbeat runner
const runner = require('./tools/heartbeat-runner.js');

// Run with OpenClaw tools available
const results = await runner.runHeartbeat({
    sessions_spawn: /* OpenClaw sessions_spawn tool */
});

// Results object:
{
    timestamp: '2026-03-11T21:15:00Z',
    pool: {
        backlog: 2,
        active: 1,
        spawned: 2,
        tasks: ['task-70', 'task-66']
    },
    briefing: false,
    health: true
}
```

---

## How It Improves Your Workflow

### Before (Manual Assignment)

```
1. You see 5 backlog tasks
2. You pick one manually
3. You spawn a sub-agent
4. You track completion
5. Repeat for next task
```

**Pain points:**
- Context switching between tasks
- Forgetting to check backlog
- Manual spawning overhead
- Idle time while you're away

---

### After (Auto-Scaling)

```
1. Heartbeat runs every ~2 minutes
2. Detects unassigned backlog tasks
3. Auto-spawns sub-agents (up to 5 concurrent)
4. Assigns appropriate model per task type
5. Tasks complete in parallel
6. You review results when ready
```

**Benefits:**
- ✅ Zero manual spawning
- ✅ Parallel execution (5x throughput)
- ✅ Model selection automatic
- ✅ Continuous progress even when you're offline
- ✅ No context switching for you

---

## Concrete Example

**Scenario:** 3 backlog tasks arrive while you're in meetings

| Task | Type | Model | Status |
|------|------|-------|--------|
| Fix API endpoint | code | qwen2.5-coder:7b | 🚀 Auto-spawned |
| Research NLP library | research | llama3.1:8b | 🚀 Auto-spawned |
| Update docs | quick | qwen2.5:7b | ⏳ Queued (max 5 limit) |

**Result:** By the time you're free, 2 tasks are **done**, 1 is in progress.

---

## Model Selection Logic

The pool manager auto-detects task type and assigns optimal model:

```javascript
if (title.includes('code') || title.includes('script') || title.includes('api'))
    → qwen2.5-coder:7b (local, fast)
    
if (title.includes('research') || title.includes('analyze'))
    → llama3.1:8b (local, good for research)
    
if (title.includes('quick') || title.includes('simple'))
    → qwen2.5:7b (local, lightweight)
    
else
    → qwen2.5:7b (default fallback)
```

For complex coding (detected in future):
- `qwen3-coder-next:cloud` (80B, cloud)

---

## Capacity Management

| Setting | Value | Why |
|---------|-------|-----|
| `maxConcurrent` | 5 | Prevents resource exhaustion |
| `minConcurrent` | 1 | Keeps pipeline warm |
| `backlogThreshold` | 3 | Triggers scaling at 3+ tasks |

**Auto-scale up:** When backlog ≥ 3 and active < 5

**Auto-scale down:** When backlog = 0 and active > 1 (future: graceful complete)

---

## Database Updates

When pool manager spawns a sub-agent:

```sql
-- Mark task as assigned to auto-pool
UPDATE tasks 
SET assignee = 'auto-pool', 
    updated_at = NOW() 
WHERE id = '<task_id>';
```

This prevents double-assignment and tracks automation origin.

---

## Integration Checklist

**To enable auto-task assignment:**

1. ✅ `tools/heartbeat-runner.js` exists
2. ✅ `tools/subagent-pool-manager.js` exists
3. ✅ `HEARTBEAT.md` updated (Section 0 added)
4. ⏳ Alfred's main session calls `runner.runHeartbeat()`
5. ⏳ Test with 3+ backlog tasks

**Current status:** Ready for integration into Alfred's heartbeat loop.

---

## Usage

```bash
# Test standalone (mock mode)
node /workspace/tools/heartbeat-runner.js

# Expected output:
💓 Heartbeat runner starting...
🏊 Running pool manager...
   Backlog: 2 unassigned | Active: 0/5
   ↑ Scaling up: 2 sub-agent(s)
   ✓ Spawned 2 sub-agent(s)
✓ Heartbeat complete
```

---

## Next Step

Alfred's main session needs to call this during heartbeats. See `HEARTBEAT.md` Section 0 for the integration pattern.
