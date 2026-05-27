# Heartbeat Integration Guide

## How to Run Heartbeat in OpenClaw

### Option 1: Manual Trigger (Testing)

```bash
cd /home/kevin/.openclaw/workspace
node tools/heartbeat-integration.js
```

This runs all proactive checks and logs to `.learnings/HEARTBEAT.md`.

---

### Option 2: OpenClaw Config Integration (Production)

Add to your OpenClaw configuration to run heartbeat automatically every 30 minutes:

**File:** `~/.openclaw/config.json` or via `/config` command

```json
{
  "heartbeat": {
    "enabled": true,
    "intervalMinutes": 30,
    "script": "/home/kevin/.openclaw/workspace/tools/heartbeat-integration.js",
    "channel": "telegram:8177470832",
    "notifyOnIssues": false
  }
}
```

---

### Option 3: Cron Job (Alternative)

Create a cron job that calls OpenClaw to run heartbeat:

**File:** `/etc/cron.d/openclaw-heartbeat`

```cron
*/30 * * * * kevin cd /home/kevin/.openclaw/workspace && node tools/heartbeat-integration.js >> /var/log/openclaw-heartbeat.log 2>&1
```

---

## What Heartbeat Does

Every 30 minutes, heartbeat executes these checks in order:

### 1. Subagent Status Sync
- Calls `sessions_list` tool
- Compares with `kanban/subagents.json`
- Moves completed subagents from `active` → `recent`
- Updates corresponding tasks to `column="done"`
- Sets agent status to `idle`

**Tools used:** `sessions_list`, file I/O

---

### 2. Autonomous Task Pull
- Finds agents with `status="idle"`
- Finds their highest-priority `backlog` tasks
- Checks dependencies are met
- Calls `sessions_spawn` to start work
- Updates task to `in-progress`, links subagent runId

**Tools used:** `sessions_spawn`, file I/O

---

### 3. Stuck Task Detection
- Finds tasks `in-progress` >30 min with no updates
- Checks if subagent is actually running
- Auto-recovery:
  - 30-60 min: Kill & respawn (retry #1)
  - 1-2 hours: Kill & respawn (retry #2)
  - >2 hours: Mark blocked, reassign
- **Does NOT notify Kevin** (handles autonomously)

**Tools used:** `sessions_list`, `subagents action=kill`, `sessions_spawn`

---

### 4. System Health Check
- Ollama API reachable?
- Gateway running?
- Disk space >10%?
- Error patterns in `.learnings/ERRORS.md`?
- Auto-fixes: Gateway restart if down

**Tools used:** `exec` (curl, systemctl, df)

---

### 5. Completion Verification
- When subagent reports done:
  - Verify files created/modified
  - Smoke test API endpoints
  - Check pages load
- Only marks "done" if verification passes

**Tools used:** File I/O, `exec` (curl)

---

## Logging

All heartbeat runs are logged to `.learnings/HEARTBEAT.md`:

```markdown
## Heartbeat - 2026-03-03T20:50:00.000Z

**Duration**: 2340ms
**Status Sync**: Found 2 active sessions
**Task Pull**: Spawned 1 subagent(s)
**Stuck Check**: 0 stuck task(s)
**Health**: ✅ All systems OK
**Verifications**: No new completions
```

---

## Testing Checklist

- [ ] Run `node tools/heartbeat-integration.js` manually
- [ ] Verify it calls `sessions_list` correctly
- [ ] Verify it updates `subagents.json` on completions
- [ ] Verify it updates `tasks.json` on completions
- [ ] Verify it spawns new tasks for idle agents
- [ ] Verify health checks pass
- [ ] Verify logging to `HEARTBEAT.md`

---

## Cron Jobs

### Daily Briefing (8 AM)
```cron
0 8 * * * /home/kevin/.openclaw/workspace/cron/daily-briefing.sh
```

### Evening Summary (8 PM)
```cron
0 20 * * * /home/kevin/.openclaw/workspace/cron/evening-summary.sh
```

### Heartbeat (Every 30 min)
```cron
*/30 * * * * cd /home/kevin/.openclaw/workspace && node tools/heartbeat-integration.js
```

---

## Integration with OpenClaw Hooks

For native OpenClaw integration, create a hook file:

**File:** `~/.openclaw/hooks/heartbeat.js`

```javascript
const heartbeat = require('/home/kevin/.openclaw/workspace/tools/heartbeat-integration.js');

module.exports = {
  async onHeartbeat() {
    const result = await heartbeat.runHeartbeat();
    return result;
  }
};
```

Then configure in `openclaw.json`:

```json
{
  "hooks": {
    "heartbeat": {
      "enabled": true,
      "intervalMinutes": 30,
      "handler": "./hooks/heartbeat.js"
    }
  }
}
```

---

## Current Status

✅ All tools implemented  
✅ Documentation complete  
⏳ Need to: Install cron jobs  
⏳ Need to: Test with real OpenClaw session  

**Next step:** Install and test cron jobs
