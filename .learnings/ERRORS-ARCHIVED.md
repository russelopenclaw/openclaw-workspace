# Archived Errors

> Errors older than 30 days are moved here.


### 20260317-001
**Archived**: 2026-05-12T02:03:14.901Z
### [ERR-20260317-001] Log File Size Explosion

**Logged**: 2026-03-17T13:35:00Z  
**Resolved**: 2026-03-17T13:40:00Z  
**Priority**: critical  
**Area**: infrastructure

**Summary**: OpenClaw log files grew to 500MB+, requiring manual deletion

**Error**:
```
Log files /tmp/openclaw/openclaw-*.log exceeded 500MB
No log rotation configured
System ran out of disk space risk
```

**Context**:
- Logs from 2026-03-16 and 2026-03-17 both maxed at 500MB
- No log rotation policy was in place
- Gateway running continuously without size limits
- Something caused excessive logging (likely stuck loop or verbose debug)

**Resolution**:
1. Manual cleanup: Deleted oversized log files
2. Created log rotation script: `tools/rotate-logs.sh`
   - Caps logs at 10MB
   - Compresses previous day's logs
   - Keeps 14 days retention
3. Scheduled cron job: `cron/log-rotation.json` (daily at 2 AM)
4. Added heartbeat monitoring: Alert if any log >50MB
5. Updated HEARTBEAT.md with log size checks
6. Updated AGENTS.md with evening report process

**Related Files**: 
- `tools/rotate-logs.sh` (new)
- `cron/log-rotation.json` (new)
- `HEARTBEAT.md` (updated)
- `AGENTS.md` (updated)

**Prevention**: 
- 10MB cap prevents future explosions
- Daily rotation keeps logs manageable
- Heartbeat monitoring provides early warning at 50MB
- Evening report process ensures proactive maintenance


---


### 20260225-001
**Archived**: 2026-05-12T02:03:14.901Z
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


---


### 20260225-001
**Archived**: 2026-05-12T02:04:48.894Z
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


---


### 20260225-001
**Archived**: 2026-05-17T08:00:15.868Z
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


---


### 20260225-001
**Archived**: 2026-05-22T07:00:10.609Z
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


---


### 20260225-001
**Archived**: 2026-05-23T07:00:06.072Z
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


---


### 20260225-001
**Archived**: 2026-05-24T08:00:37.733Z
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


---


### 20260225-001
**Archived**: 2026-05-25T07:00:06.360Z
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


---


### 20260225-001
**Archived**: 2026-05-27T07:00:10.634Z
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


---

