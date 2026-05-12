# Errors Log

Record command failures, exceptions, and bugs here.

> **System Status**: ✅ All resolved | 📊 Total: 1 resolved, 0 active
> 
> **Auto-cleanup**: Errors resolved >30 days are automatically archived to `ERRORS-ARCHIVED.md`

---

## Active Errors

> 🔴 Track current, unresolved issues that need attention

*No active errors - all issues resolved!* ✅

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
