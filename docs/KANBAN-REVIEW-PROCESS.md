# Kanban Review Process

**Automated Board Management**

**Date:** March 12, 2026  
**Schedule:** Hourly (cron) + every heartbeat (30 min)  
**Status:** ✅ Production Active  

---

## Purpose

Proactive Kanban board management:
- ✅ Review board state (count per column)
- ✅ Identify blocked tasks (>60 min no activity)
- ✅ Detect stuck IN_PROGRESS tasks (>30 min)
- ✅ Reassign READY tasks to idle agents
- ✅ Resume stuck tasks (touch timestamp)
- ✅ Log review results

**Why:** Passive monitoring isn't enough. This actively **manages** the board.

---

## Implementation

### 1. Kanban Review Tool (`tools/kanban-review.js`)

**CLI:**
```bash
node tools/kanban-review.js                    # Full review
node tools/kanban-review.js --dry-run          # Preview only
node tools/kanban-review.js --threshold 45     # Custom threshold (minutes)
```

**Actions:**
```javascript
// 1. Get board state
const board = await getBoardState();
// Returns: { BACKLOG: {count: 5, tasks: []}, READY: {...}, ... }

// 2. Find blocked tasks (BLOCKED column, >60 min)
const blocked = await getStuckTasks('BLOCKED', 60);

// 3. Find stuck IN_PROGRESS tasks (>30 min no progress)
const stuck = await getStuckTasks('IN_PROGRESS', 30);

// 4. Get idle agents + READY tasks
const idleAgents = await getIdleAgents();
const readyTasks = await getReadyTasks();

// 5. Assign READY tasks to idle agents
for (agent of idleAgents) {
  if (readyTasks.length) assignTaskToAgent(readyTasks[0], agent);
}

// 6. Resume stuck tasks (update timestamp)
for (task of stuck) {
  resumeStuckTask(task.id);
}

// 7. Log to .learnings/KANBAN-REVIEW.log
logReview(board, blocked, reassigned, resumed);
```

---

### 2. Cron Job (Hourly)

**File:** `cron/kanban-review.json`

```json
{
  "command": "cd /workspace && node tools/kanban-review.js",
  "schedule": "0 * * * *",
  "description": "Hourly Kanban board review: identify blocked, reassign work, resume execution",
  "enabled": true
}
```

**Effect:** Runs at the top of every hour (1:00, 2:00, 3:00, etc.)

---

### 3. Heartbeat Integration (Every 30 min)

**Modified:** `tools/heartbeat-runner.js`

**Added:**
```javascript
// 2. Kanban Board Review
try {
    log(BLUE, '📋 Running Kanban board review...');
    const reviewPath = path.join(WORKSPACE, 'tools/kanban-review.js');
    execSync(`node "${reviewPath}" --dry-run 2>&1`, { encoding: 'utf8', stdio: 'inherit' });
} catch (e) {
    log(YELLOW, '   ⚠️ Kanban review skipped');
}
```

**Note:** Heartbeat uses `--dry-run` (reports without changing) since actual assignments happen in pool manager.

---

## Review Output

**Log file:** `.learnings/KANBAN-REVIEW.log`

**Format:**
```
[2026-03-12T20:22:37.461Z] Kanban Review
  Board: BACKLOG=0, READY=0, IN_PROGRESS=0, VALIDATION=0, DONE=81, BLOCKED=0
  Blocked: 1 task(s)
  Reassigned: 2 task(s)
  Resumed: 1 task(s)
```

**Console output:**
```
[KanbanReview] Starting Kanban board review...
================================================
Board State:
  DONE: 81 task(s)

Agents: 2 idle
READY Tasks: 0 waiting

================================================
Review Complete:
  Reassigned: 0 task(s)
  Resumed: 0 task(s)
  Logged: .learnings/KANBAN-REVIEW.log
```

---

## Automated Actions

### When READY Tasks Exist + Idle Agents Available:
```
READY task detected
  ↓
Idle agent found (e.g., 'alfred' status='idle')
  ↓
Auto-assign: task.column = 'IN_PROGRESS', task.assignee = agent.name
  ↓
Update agent: agent.status = 'working', agent.current_task = task.id
  ↓
Log: "Task T-101 assigned to alfred → IN_PROGRESS"
```

### When IN_PROGRESS Task Stuck (>30 min):
```
Task in IN_PROGRESS, updated_at >30 min ago
  ↓
Touch timestamp: updated_at = NOW()
  ↓
Log: "Task T-101 resumed (timestamp reset)"
  ↓
Effect: Triggers reconsideration on next heartbeat/pool manager
```

### When BLOCKED Task Detected:
```
Task in BLOCKED column, updated_at >60 min ago
  ↓
Report in review log
  ↓
NO AUTO-ACTION (blocked tasks need human intervention)
  ↓
Alfred can: unblock, reassign, or delete
```

---

## Integration with Workflow Protocol

This complements the lifecycle workflow:

| Workflow Stage | Kanban Review Action |
|---------------|---------------------|
| READY | Assign to idle agents automatically |
| IN_PROGRESS (>30 min) | Touch timestamp, trigger reconsideration |
| BLOCKED (>60 min) | Report to Alfred, NO auto-action (needs human) |
| VALIDATION | No action (validation agent handles) |
| DONE | No action (archive later) |

**Relationship:**
- **Workflow protocol:** Task state transitions (BACKLOG→READY→IN_PROGRESS→VALIDATION→DONE)
- **Kanban review:** Board management (unblock, reassign, resume)

---

## Database Queries Used

```sql
-- Board state (count per column)
SELECT column_name, count(*) as count,
  ARRAY_AGG(id ORDER BY created_at DESC) as task_ids
FROM tasks 
GROUP BY column_name 
ORDER BY column_name;

-- Stuck tasks (>N minutes in column)
SELECT id, title, assignee, column_name, updated_at,
  EXTRACT(EPOCH FROM (NOW() - updated_at)) / 60 as minutes_stuck
FROM tasks 
WHERE column_name = 'BLOCKED'
  AND updated_at < NOW() - INTERVAL '60 minutes'
ORDER BY updated_at ASC;

-- Idle agents
SELECT name, status, current_task, last_activity
FROM agents
WHERE status = 'idle'
ORDER BY last_activity ASC;

-- READY tasks (priority ordered, oldest first)
SELECT id, title, assignee, priority, created_at
FROM tasks 
WHERE column_name = 'READY'
ORDER BY 
  CASE priority
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 3
    ELSE 4
  END,
  created_at ASC;
```

---

## File Locations

| Component | Path |
|-----------|------|
| Review Tool | `/workspace/tools/kanban-review.js` |
| Cron Job | `/workspace/cron/kanban-review.json` |
| Heartbeat | `/workspace/tools/heartbeat-runner.js` (integrated) |
| Review Log | `/workspace/.learnings/KANBAN-REVIEW.log` |
| Workflow Doc | `/workspace/docs/WORKFLOW-ARCHITECTURE.md` |

---

## Test Results

**Initial run (2026-03-12 15:22 CDT):**
```
Board State:
  DONE: 81 task(s)

Agents: 2 idle
READY Tasks: 0 waiting

Review Complete:
  Reassigned: 0 task(s)
  Resumed: 0 task(s)
```

**Result:** No action needed (all tasks DONE, no READY queue, agents idle but no work)

---

## Monitoring

**Check review logs:**
```bash
tail -20 /workspace/.learnings/KANBAN-REVIEW.log
```

**Check cron execution:**
```bash
# Verify cron is running (if using system cron)
grep "kanban-review" /var/log/syslog | tail
# Or check systemd journal if using service
journalctl --user -u kanban-review.service | tail
```

**Manual trigger:**
```bash
node /workspace/tools/kanban-review.js
# Or with dry-run:
node /workspace/tools/kanban-review.js --dry-run
```

---

## Configuration Options

### Threshold Settings

| Parameter | Default | Adjust if... |
|-----------|---------|--------------|
| `thresholdBlocked` | 60 min | Tasks blocked >1 hour need review |
| `thresholdInProgress` | 30 min | No progress after 30 min |

Adjust via CLI:
```bash
node tools/kanban-review.js --threshold 45  # Use 45 min for both
```

### Schedule Frequency

**Current:** Hourly (cron) + every heartbeat (30 min)

**Change in:** `cron/kanban-review.json`
```json
{
  "schedule": "*/15 * * * *"  // Every 15 minutes
}
```

**Note:** More frequent = more reactive but more resource usage.

---

## Alfred's Responsibilities

Automated:
- ✅ Board review (hourly + heartbeat)
- ✅ READY task assignment to idle agents
- ✅ Stuck task timestamp touches

Manual (Alfred only):
- BLOCKED task resolution (>60 min no action)
- Priority overrides (change task priority manually)
- Agent kills (terminate stuck sub-agents)
- Dashboard optimization (create widgets, metrics)

---

## Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| READY task assignment | <5 min idle | ✅ Automated |
| Stuck task detection | <30 min | ✅ Automated |
| Blocked reporting | <60 min | ✅ Automated |
| Review logging | Every run | ✅ Logged |

---

**Document Version:** 1.0 (2026-03-12)  
**Maintainer:** Alfred  
**First Run:** 15:22 CDT ✅  
**Schedule:** Hourly + heartbeat ✅
