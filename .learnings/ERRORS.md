# Errors Log

Record command failures, exceptions, and bugs here.

## Format

```markdown
## [ERR-YYYYMMDD-XXX] skill_or_command_name

**Logged**: ISO-8601 timestamp
**Priority**: high
**Status**: pending
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

### Metadata
- Reproducible: yes | no | unknown
- Related Files: path/to/file.ext

---
```

---

## [ERR-20260225-001] alfred-hub-login

**Logged**: 2026-02-25T12:38:00Z
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary
Sign In button click handler not firing - Uncaught ReferenceError: handleLogin is not defined

### Error
```
Uncaught ReferenceError: handleLogin is not defined at HTMLButtonElement.onclick
```

### Context
- HTML button had onclick="handleLogin()"
- Function was defined inside script block but not globally accessible

### Suggested Fix
Use window.handleLogin = function() {...} instead of function handleLogin() {...}

### Metadata
- Reproducible: yes
- Related Files: alfred-hub/index.html

### Resolution
- **Resolved**: 2026-02-25T12:45:00Z
- **Notes**: Made function global by attaching to window object
