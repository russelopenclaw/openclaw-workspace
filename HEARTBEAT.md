# HEARTBEAT.md - OPTIMIZED with Caching Layer

> **Goal: ~40% reduction in token burn and execution time**  
> **Mechanism: PostgreSQL caching, change detection, batch API calls**

---

## Session Grounding (MANDATORY - First, Every Time)

**Before any checks, ALWAYS read these files:**

1. `SOUL.md` — Who you are
2. `USER.md` — Who you're helping
3. `MEMORY.md` — Long-term memory (main session only)
4. `memory/YYYY-MM-DD.md` — Today + yesterday's daily notes

**Why:** These files _are_ your continuity. Skipping them for "efficiency" makes you scatter-brained and inconsistent. The ~5 seconds and ~2-5K tokens are worth it for staying grounded.

**Non-negotiable:** No shortcuts. Read them every single heartbeat.

---

## Browser-First Protocol (Added 2026-03-20)

**When user reports a problem with a UI/feature:**

1. **STOP** - Don't ask questions or make assumptions
2. **OPEN BROWSER** - Navigate to the affected page
3. **SNAPSHOT** - See exactly what user sees
4. **TEST** - Click buttons, check state, verify behavior
5. **REPORT** - Tell user what I found + what I'm fixing

**Before destructive actions (delete/move/overwrite):**
1. **LIST** - What files exist?
2. **CHECK** - What will be affected?
3. **BACKUP** - Move/copy before delete
4. **VERIFY** - Confirm the change worked

**Trigger phrases:** "It's broken", "It shows X", "Nothing happens", "Can you check"
**My response:** "Let me verify" → [use browser/exec] → [report findings]

**Remember:** I have the tools. I'm capable. **Use them.** Don't ask user to verify what I can check myself.

---

## Reminders Check (Every Heartbeat)

Check Mission Control `reminders` table for due reminders:

```sql
SELECT id, title, due_date, due_time, description 
FROM reminders 
WHERE due_date <= CURRENT_DATE 
  AND completed = false
ORDER BY due_date, due_time;
```

If reminders are due:
1. **Send Telegram alert** using `message` tool (not just chat reply)
2. Mark completed after discussion/action

**Telegram alert format:**
```
🔔 Reminder Due: [Title]
[Description]
Due: [time]
```

**Example:** On 2026-03-30, remind Kevin to review Model Awareness approach.

---

## Critical Checks (Every Heartbeat)

### Log Size Monitoring (NEW - 2026-03-17)
**Why:** Prevent 500MB log disaster that occurred 2026-03-16/17
- **Check:** `/tmp/openclaw/openclaw-*.log` files
- **Threshold:** Alert if any log > 50MB (before 10MB cap hits)
- **Action:** If >50MB, run `tools/rotate-logs.sh` immediately
- **Cron backup:** Daily rotation at 2 AM via `cron/log-rotation.json`

```bash
# Quick check
ls -lh /tmp/openclaw/*.log | awk '$5 ~ /G|M/ {print "WARNING: Large log:", $0}'
# If warning, run rotation
bash tools/rotate-logs.sh
```

### Optimized Runner (Primary Orchestrator)
- **Call:** `tools/heartbeat-runner.js` from Alfred session
- **What it does:** Runs cached pool manager, health checks, task pulls
- **Features:**
  - ✅ PostgreSQL query caching (respects TTL per check type)
  - ✅ Skips redundant checks when state unchanged
  - ✅ Batches expensive API calls (email/calendar/weather)
  - ✅ Smart staggered execution
- **Token savings:** ~40% vs uncached

```javascript
const runner = require('./tools/heartbeat-runner.js');
await runner.runHeartbeat({ sessions_spawn, exec, message }, { 
    verbose: true,
    heartbeatCount: 1 // increments each heartbeat
});
```

---

## Cache Strategy

### Cache TTL Configuration

| Check Type | TTL | Reason |
|------------|-----|--------|
| `pg_subagent_status` | 5 min | Status changes infrequently |
| `pg_tasks_in_progress` | 3 min | Task updates during work |
| `pg_idle_agents` | 5 min | Agent availability |
| `pg_task_backlog` | 10 min | Backlog rarely urgent |
| `email_unread` | 15 min | Email not real-time |
| `calendar_events` | 30 min | Calendar changes slowly |
| `weather` | 60 min | Weather hourly is fine |
| `system_health` | 2 min | Health check quick |
| `mission_control` | 5 min | MC status |
| `briefing_queue` | 1 min | Processed quickly |

### Cost Weights (Relative Token Cost)

| Check | Cost | Why |
|-------|------|-----|
| `email_unread` | 8 tokens | External API call |
| `calendar_events` | 6 tokens | External API call |
| `mission_control` | 4 tokens | Multiple checks |
| `weather` | 4 tokens | External API call |
| `pg_tasks_in_progress` | 3 tokens | Query + processing |
| `system_health` | 3 tokens | Multiple subprocesses |
| `pg_subagent_status` | 2 tokens | Simple query |
| `pg_idle_agents` | 2 tokens | Simple query |
| `pg_task_backlog` | 2 tokens | Simple query |
| `briefing_queue` | 1 token | File read |

### How Caching Works

1. **Hash-based change detection**: Each cached entry stores a hash of its data
2. **If data unchanged**: Just update timestamp (extends TTL), skip re-check
3. **If data changed**: Store new data + new hash, return fresh data
4. **Batch API calls**: Email/calendar/weather run together every ~30 min instead of every heartbeat
5. **Staggered execution**: Expensive checks distributed across heartbeats

---

## What Each Check Does

### 1. Subagent Status Sync
- **Cached:** Yes (5 min TTL)
- **What:** Query PostgreSQL for in-progress task count
- **Change detection:** Count + last update timestamp

### 2. Autonomous Task Pull
- **Cached:** Yes (5 min TTL for idle agents, 10 min for backlog)
- **What:** Pull tasks for idle agents
- **Skip condition:** If no idle agents or no backlog changes

### 3. Stuck Task Detection
- **Cached:** Yes (3 min TTL)
- **What:** Query for tasks >30 min old with no updates
- **Frequency:** Every 3 min (tuned for accuracy)

### 4. System Health Check
- **Cached:** Yes (2 min TTL)
- **What:** Ollama, Gateway, disk space
- **Skip condition:** All checks passed + <2 min old

### 5. Mission Control Health
- **Cached:** Yes (5 min TTL)
- **What:** Is MC process running
- **Skip condition:** Process still alive

### 6. Batch API Calls (Email/Calendar/Weather)
- **Cached:** Yes (15/30/60 min TTL respectively)
- **Batching:** Run together once per staggered heartbeat
- **Skip condition:** Within TTL, or not this heartbeat's turn

### 7. Briefing Queue
- **Cached:** Yes (1 min TTL)
- **What:** Check `.briefing-queue.json` for pending items
- **Skip condition:** File unchanged + <1 min old

---

## When Checks Are SKIPPED

A check is skipped when:

1. **Cache hit**: Data retrieved from cache (within TTL)
2. **No change**: Same hash as cached entry (cache timestamp refreshed)
3. **Staggered**: Not this heartbeat's turn (for expensive API calls)
4. **No dependencies**: Prerequisites not met (e.g., no spawn tool for task pull)

Checks are **never skipped** when:

- Time-sensitive (subagent pool management)
- Critical (stuck task detection with confirmed stuck tasks)
- First run (no cache exists)
- Cache explicitly invalidated

---

## Cache Files

- **Cache module:** `tools/heartbeat-cache.js`
- **Cache state:** `heartbeat-cache.json`
- **Runner:** `tools/heartbeat-runner.js` (optimized)

### Cache API

```javascript
const { getCache } = require('./tools/heartbeat-cache.js');
const cache = getCache();

// Try cache
cache.get('email_unread');  // Returns data or null

// Store in cache
cache.set('email_unread', data);  // Auto-detects changes

// Force invalidate
cache.invalidate('email');  // Removes all keys containing 'email'

// Get stats
const stats = cache.getStats();
// { hits, misses, skips, batched, savedCost, savingsPercent }
```

---

## Expected Performance

### Before Optimization
- Each heartbeat: ~25-30 tokens
- PostgreSQL queries: 4-5 per heartbeat
- API calls: email + calendar + weather every heartbeat
- Execution time: ~3-5 seconds

### After Optimization
- Each heartbeat: ~15-20 tokens (40% reduction)
- PostgreSQL queries: 1-2 per heartbeat (cached hits)
- API calls: batched every 3rd-5th heartbeat
- Execution time: ~1-2 seconds (50% reduction)

---

## Debugging

### View Cache State
```bash
# View current cache
cat heartbeat-cache.json | jq .

# View cache stats
node -e "const cache = require('./tools/heartbeat-cache.js').getCache(); console.log(cache.getStatusSummary());"

# Reset cache
node -e "const cache = require('./tools/heartbeat-cache.js').getCache(); cache.reset();"
```

### Run with Verbose Logging
```javascript
await runner.runHeartbeat(tools, { verbose: true });
```

### Test Standalone
```bash
node tools/heartbeat-runner.js
```

---

## Standard Checks (Rotate Through - Now Batched!)

Previously: Email, Calendar, Weather = **3 API calls per heartbeat**

Now: **1 batch call every 3-5 heartbeats** (depending on stagger)

- **Email** (via gog) - Cached 15 min
- **Calendar events** - Cached 30 min
- **Weather** - Cached 60 min

All run together when any is due, respecting individual TTLs.

---

## Stuck Task Protocol (Autonomous)

**Detection threshold: 6 hours** (we operate at millisecond level)

**Triggers:**
1. Task `in-progress` >6 hours with no progress updates
2. Subagent session died without completion
3. Dependency blocked (task waiting on another task)

**Actions (escalation ladder):**
- **<6 hours**: Monitor only, no action
- **6-12 hours**: Auto-recovery: kill hung subagent, respawn with same task
- **12-24 hours**: Try alternative approach/model, log attempt
- **>24 hours**: Mark BLOCKED, document what was tried, ONLY THEN notify Kevin

**Post-mortem trigger:** If 3+ tasks in an epic OR multiple agents involved → write post-mortem

**Do NOT notify Kevin** unless truly blocked after exhausting options.

---

## Reference

- Cache module: `/workspace/tools/heartbeat-cache.js`
- Optimized runner: `/workspace/tools/heartbeat-runner.js`
- Cache state: `/workspace/heartbeat-cache.json`
- Legacy docs: `/workspace/tools/auto-status-update.md`
- Legacy monitor: `/workspace/tools/stuck-task-monitor.js`