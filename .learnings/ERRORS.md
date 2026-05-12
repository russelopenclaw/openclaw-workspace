# Errors Log

Record command failures, exceptions, and bugs here.

> **System Status**: ⚠️ Issues Active | 📊 Total: 1 resolved, 2 active
> 
> **Auto-cleanup**: Errors resolved >30 days are automatically archived to `ERRORS-ARCHIVED.md`

---

## Active Errors

> 🔴 Track current, unresolved issues that need attention

### [ERR-20260401-001] Exec Approval Timeout - Log Rotation & Heartbeat Blocked

**Logged**: 2026-04-01T06:50:00Z  
**Resolved**: —  
**Priority**: critical  
**Area**: infrastructure

**Summary**: Exec approval timeout in webchat blocking all automated scripts (log rotation, health checks)

**Error**:
```
Exec command requires approval - webchat cannot deliver approval prompts
Gateway IDs blocked: 5b1a5776, 6d9d69e1, 0de30088, a434b733, d8dea31d, a4ccd562
Approval short code: d8dea31d
```

**Context**:
- Started: Apr 1 1:21 AM (America/Chicago)
- Consecutive failures: 10 days (Apr 2-10 - 2:00 AM log rotation)
- Affected scripts: `tools/rotate-logs.sh`, `tools/heartbeat-runner.js`, all exec-based health checks
- Last verified healthy: 1:21 AM Apr 1 (~138+ hours ago / ~6 days)
- Config file missing: `~/.openclaw/config/openclaw.json` (ENOENT)

**Impact**:
- Log rotation failing daily (logs could grow unbounded)
- Health checks not running (Ollama, Gateway, disk space unverified)
- Stuck task detection offline
- Mission Control status updates blocked
- ~138+ hours of unverified system state (~6 days)

**Resolution Required** (user action needed):
1. **Option A** - Add exec allowlist to `~/.openclaw/config/openclaw.json`:
   ```json
   {
     "exec": {
       "ask": "on-miss",
       "allowlist": [
         "ls -lh /tmp/openclaw/*.log*",
         "psql -h localhost -U openclaw -d mission_control *",
         "node tools/heartbeat-*",
         "node tools/agent-status-updater.js *",
         "bash tools/rotate-logs.sh"
       ]
     }
   }
   ```
2. **Option B** - Enable Telegram exec approvals (Telegram already connected per MEMORY.md)

**Related Files**:
- `~/.openclaw/config/openclaw.json` (missing - needs creation)
- `tools/rotate-logs.sh` (failing daily)
- `tools/heartbeat-runner.js` (cannot exec health checks)
- `cron/log-rotation.json` (scheduled 2:00 AM daily)

**Prevention**:
- Config should exist before enabling exec-requiring features
- Fallback approval channel (Telegram) should be tested during setup
- Alert on first exec approval failure, not after N days

---

### [ERR-20260321-001] Heartbeat Integration - stuckMonitor API Mismatch

**Logged**: 2026-03-21T23:00:01Z  
**Resolved**: 2026-03-22T20:00:00Z  
**Priority**: critical  
**Area**: backend

**Summary**: Heartbeat integration failing - `stuckMonitor.checkStuckTasks is not a function`

**Error**:
```
TypeError: stuckMonitor.checkStuckTasks is not a function
    at runHeartbeat (/home/kevin/.openclaw/workspace/tools/heartbeat-integration.js:128:39)
```

**Context**:
- `heartbeat-integration.js` imports: `const stuckMonitor = require('./stuck-task-monitor.js')`
- Expects method: `stuckMonitor.checkStuckTasks(sessions[])`
- `stuck-task-monitor.js` exports: `main()` function only, no `checkStuckTasks` method
- 50+ consecutive heartbeats failed (March 6-21, 16-day outage)

**Impact**:
- Stuck task detection not running
- Health monitoring incomplete
- Heartbeat queue not processing
- No auto-recovery for stuck tasks

**Resolution**:
1. Refactored `stuck-task-monitor.js` to export all public functions:
   ```javascript
   module.exports = { checkStuckTasks, syncAgentStatus, pullTasksForIdleAgents, ... };
   ```
2. Maintained backward compatibility (still runs standalone via `require.main === module`)
3. Tested: Module loads correctly, all functions exported
4. Heartbeat integration restored ✅

**Related Files**:
- `tools/heartbeat-integration.js` (line 128)
- `tools/stuck-task-monitor.js` (refactored)

**Prevention**:
- Standalone CLI scripts should export functions for module usage
- Verify export contracts match import expectations before integration
- Add integration tests for module imports

---

---

## Resolved Errors

> ✅ Historical record of fixed issues

### [ERR-20260225-001] alfred-hub-login

**Logged**: 2026-02-25T12:38:00Z  
**Resolved**: 2026-02-25T12:45:00Z  
**Priority**: high  
**Area**: frontend

**Summary**: Sign In button click handler not firing - Uncaught ReferenceError: handleLogin is not defined

**Error**:
```
Uncaught ReferenceError: handleLogin is not defined at HTMLButtonElement.onclick
```

**Context**:
- HTML button had onclick="handleLogin()"
- Function was defined inside script block but not globally accessible

**Resolution**: Made function global by attaching to window object

**Related Files**: alfred-hub/index.html

---

## Error Format Template

Use this template for new errors:

```markdown
### [ERR-YYYYMMDD-XXX] skill_or_command_name

**Logged**: ISO-8601 timestamp
**Priority**: high | medium | low
**Status**: active
**Area**: frontend | backend | infra | tests | docs | config

### Summary
Brief description of what failed

### Error
```
Actual error message
```

### Context
- Command attempted
- Parameters used

### Suggested Fix
What might resolve this

### Resolution
[Fill in when resolved]

### Metadata
- Reproducible: yes | no | unknown
- Related Files: path/to/file.ext

---
```

> **Note**: Add new errors under the "Active Errors" section. When resolved, move them to "Resolved Errors" and fill in the Resolution field.

---
[2026-03-12T10:35:30.584Z] [AUTO-FIX] Mission Control HTTP timeout - cleared .next cache, restarted service, now responding (307)

### 2026-03-12: GitHub Push Blocked

**Error:** `remote: Permission to russelopenclaw/openclaw-agents.git denied to russelopenclaw.`

**Token:** GITHUB_TOKEN (ghp_caMx...) claimed to have `repo`, `workflow` scopes but push fails with 403

**Blocked:** Semi-persistent agents commit (a2f03fd1) - DadJ, QAAgent, HealthMon + workflow system

**Fix:** Regenerate GITHUB_TOKEN with full repo write scope or verify repo ownership

**Workaround:** Local commit works, push deferred
