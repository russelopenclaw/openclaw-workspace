# Sub-Agent Pool Manager

## Overview

Automated sub-agent spawning and scaling based on task workload.

**Location:** `tools/subagent-pool-manager.js`

**Schedule:** Every 2 minutes via cron (must run within OpenClaw session)

---

## Features

### Auto-Scale Up
- Monitors unassigned backlog tasks
- Spawns sub-agents when backlog ≥ threshold
- Assigns appropriate model per task type:
  - `qwen2.5-coder:7b` for code tasks
  - `llama3.1:8b` for research tasks
  - `qwen2.5:7b` for quick tasks
  - `qwen3-coder-next:cloud` for complex coding (cloud)

### Auto-Scale Down
- Detects over-provisioning
- Future: gracefully completes or reassigns idle agents

### Capacity Limits
- Max concurrent: 5 sub-agents
- Min concurrent: 1 (kept alive)

---

## Architecture

```
┌────────────────────────────────────────────────┐
│  Alfred (Main Session)                         │
│  - Reads pool state                            │
│  - Calls managePool()                          │
│  - Has access to sessions_spawn tool           │
└────────────────────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────┐
│  subagent-pool-manager.js                      │
│  - Queries PostgreSQL backlog                  │
│  - Determines scaling decision                 │
│  - Spans sub-agents via tool                   │
└────────────────────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────┐
│  Sub-Agents (spawned)                         │
│  - Execute assigned tasks                      │
│  - Report completion                           │
│  - Auto-terminate on done                      │
└────────────────────────────────────────────────┘
```

---

## Integration

### Running in Alfred Session

The pool manager MUST run within an OpenClaw agent session to use the `sessions_spawn` tool.

**Pattern:**
```javascript
const poolManager = require('./tools/subagent-pool-manager.js');

// Within Alfred's heartbeat
const tools = { sessions_spawn: /* OpenClaw tool */ };
await poolManager.managePool(tools);
```

### Heartbeat Integration

Add to Alfred's heartbeat sequence in `HEARTBEAT.md`:

```javascript
// In tools/auto-dadjoke-runner.js or similar heartbeat runner
const poolManager = require('./tools/subagent-pool-manager.js');

// Check pool every heartbeat (~2 min)
const results = await poolManager.managePool({
    sessions_spawn: /* OpenClaw sessions_spawn tool */
});
```

---

## Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| `maxConcurrent` | 5 | Max sub-agents running |
| `minConcurrent` | 1 | Min to keep alive |
| `backlogThreshold` | 3 | Spawn when backlog >= this |
| Check interval | 2 min | Via cron every 2 min |

---

## Model Selection

| Task Pattern | Model | Type |
|-------------|-------|------|
| code, script, API | `qwen2.5-coder:7b` | Local |
| research, analyze | `llama3.1:8b` | Local |
| quick, simple | `qwen2.5:7b` | Local |
| complex coding | `qwen3-coder-next:cloud` | Cloud |
| default | `qwen2.5:7b` | Local |

---

## Database Schema

Pool manager reads from `mission_control.tasks`:

```sql
-- Get unassigned backlog
SELECT id, title, priority 
FROM tasks 
WHERE column_name='backlog' AND (assignee IS NULL OR assignee = '')
ORDER BY priority, created_at ASC;

-- Get active sub-agents
SELECT COUNT(*) 
FROM tasks 
WHERE column_name='in-progress' 
  AND linked_subagent IS NOT NULL 
  AND linked_subagent != '';
```

Updates tasks when spawning:
```sql
UPDATE tasks SET assignee='auto-pool', updated_at=NOW() WHERE id='<task_id>';
```

---

## Testing

```bash
# Test pool manager CLI (standalone mode)
node /workspace/tools/subagent-pool-manager.js
# Expected: "Pool manager loaded"

# Test in Alfred session
# (requires OpenClaw runtime with sessions_spawn tool)
await poolManager.managePool(tools);
```

---

## Logs

| File | Purpose |
|------|---------|
| `.learnings/subagent-p