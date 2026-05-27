# Error Logging System Guide

## Overview

The error logging system tracks bugs, command failures, and exceptions in the `.learnings/ERRORS.md` file. The system automatically monitors error counts and provides accurate reporting through the health check.

**Location**: `/workspace/.learnings/ERRORS.md`

## Features

### ✅ Accurate Error Counting
- **Only counts actual error entries** (ERR-YYYYMMDD-XXX format)
- **Separates active vs resolved errors**
- **Ignores section headers and templates**
- Health check now correctly reports: "1 error(s) logged (1 resolved)" instead of false "10 errors logged"

### 🧹 Auto-Cleanup
- Resolved errors older than **30 days** are automatically archived
- Archive location: `.learnings/ERRORS-ARCHIVED.md`
- Keeps main file focused on recent issues
- Historical data preserved for reference

### 📊 Categorization
- **Active Errors**: Current issues needing attention
- **Resolved Errors**: Fixed issues with documented solutions
- **Archived Errors**: Old resolved errors (>30 days)

### 📈 Metrics & Reporting
The health check reports:
- Total error count
- Active vs resolved breakdown
- System health status (OK if no active errors)

## How to Log a New Error

When you encounter an error:

1. **Add to Active Errors section**:
   ```markdown
   ### [ERR-20260305-001] feature-name
   
   **Logged**: 2026-03-05T14:30:00Z
   **Priority**: high | medium | low
   **Status**: active
   **Area**: frontend | backend | infra | tests | docs | config
   
   ### Summary
   Brief description
   
   ### Error
   ```
   Actual error message here
   ```
   
   ### Context
   - What were you doing?
   - Command or operation attempted
   
   ### Suggested Fix
   What might resolve this
   
   ### Metadata
   - Reproducible: yes | no | unknown
   - Related Files: path/to/file
   ```

2. **Update the status line at the top** to reflect active errors

## How to Resolve an Error

When an error is fixed:

1. **Move from Active to Resolved section**
2. **Add the Resolution field** documenting what fixed it
3. **Update the status line** at the top
4. **Mark as resolved** with a timestamp

Example:
```markdown
### [ERR-20260225-001] alfred-hub-login

**Logged**: 2026-02-25T12:38:00Z  
**Resolved**: 2026-02-25T12:45:00Z  ← Add this
**Priority**: high  
**Area**: frontend

**Summary**: Sign In button click handler

... (rest of error details)

**Resolution**: Made function global by attaching to window object ← Add this

**Related Files**: alfred-hub/index.html
```

## Running Health Checks

### Manual Check
```bash
cd /workspace
node tools/system-health-check.js
```

### Automated (Heartbeat)
The health check runs automatically via the heartbeat system every 30 minutes.

### Interpreting Results

```
✅ ollama: Ollama API reachable
✅ gateway: Gateway running
✅ disk: Disk space: 78% free (22% used)
✅ errors: 1 error(s) logged (1 resolved)
```

**Status Indicators**:
- ✅ Green = OK (no active errors or ≤10 total history)
- ❌ Red = Issue detected (active errors present or >10 in history)

## Auto-Cleanup Process

The `cleanupResolvedErrors()` function:

1. Scans the Resolved Errors section
2. Identifies errors older than 30 days
3. Moves them to `ERRORS-ARCHIVED.md`
4. Removes them from the main file
5. Preserves full error details in archive

### Run Cleanup Manually
```javascript
const healthCheck = require('./tools/system-health-check.js');
const result = healthCheck.cleanupResolvedErrors();
console.log(result.message);
```

## Best Practices

1. ✅ **Log errors promptly** - Don't wait, capture details while fresh
2. ✅ **Be specific** - Include actual error messages and context
3. ✅ **Mark resolved quickly** - Move to resolved section when fixed
4. ✅ **Document resolutions** - Future you will thank you
5. ✅ **Use priority levels** - Helps triage active issues
6. ✅ **Review during heartbeats** - Check for new errors 2-3 times daily

## Error ID Format

`[ERR-YYYYMMDD-XXX]`
- `YYYYMMDD` = Date logged
- `XXX` = Sequential number (001, 002, 003...)

Examples:
- `[ERR-20260305-001]` - First error logged on March 5, 2026
- `[ERR-20260305-002]` - Second error same day

## Area Classifications

| Area | Examples |
|------|----------|
| `frontend` | UI, browser, React, HTML/CSS |
| `backend` | Node.js, APIs, database |
| `infra` | Servers, networking, Docker |
| `tests` | Test failures, flaky tests |
| `docs` | Documentation issues |
| `config` | Configuration, environment |

## Integration with Health Check

The health check's `checkErrorPatterns()` function:

```javascript
// Returns:
{
  ok: true/false,           // System OK?
  message: "1 resolved",    // Human-readable summary
  activeCount: 0,           // Number of active errors
  resolvedCount: 1,         // Number of resolved errors
  activeErrors: [],         // List of active error IDs
  resolvedErrors: ["alfred-hub-login"],  // List of resolved
  patterns: [...]           // First 10 error names
}
```

## Troubleshooting

**Q: Health check shows wrong count?**  
A: Make sure you're using `###` for error entries (not `##`) and following the ERR-YYYYMMDD-XXX format.

**Q: Where did my old errors go?**  
A: Check `ERRORS-ARCHIVED.md` - they were auto-archived after 30 days.

**Q: Can I disable auto-cleanup?**  
A: Comment out the `cleanupResolvedErrors()` call in the health check or heartbeat.

---

## History

- **2026-03-05**: Fixed false "10 errors logged" bug - now accurately counts only actual error entries
- **2026-03-05**: Added auto-cleanup for resolved errors >30 days
- **2026-03-05**: Improved active vs resolved categorization
