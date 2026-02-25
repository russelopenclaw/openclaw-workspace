# Learnings Log

Record corrections, knowledge gaps, and best practices here.

## Format

```markdown
## [LRN-YYYYMMDD-XXX] category

**Logged**: ISO-8601 timestamp
**Priority**: low | medium | high | critical
**Status**: pending
**Area**: frontend | backend | infra | tests | docs | config

### Summary
One-line description

### Details
Full context

### Suggested Action
Specific fix or improvement

### Metadata
- Source: conversation | error | user_feedback
- Related Files: path/to/file.ext
- Tags: tag1, tag2

---
```

## Categories

- `correction` - User corrected something you did wrong
- `knowledge_gap` - Your knowledge was outdated or incorrect
- `best_practice` - Found a better approach for a task
- `workflow` - Improvement to how you work

---

## [LRN-20260225-001] workflow

**Logged**: 2026-02-25T12:45:00Z
**Priority**: medium
**Status**: promoted
**Area**: frontend

### Summary
JavaScript functions in inline scripts aren't globally accessible for onclick handlers

### Details
When defining functions inside a `<script>` tag in an HTML file, they're scoped to that script block and not accessible via inline onclick handlers. The fix is to explicitly attach them to `window` (e.g., `window.handleLogin = function() {...}`).

### Suggested Action
Always use `window.functionName = function() {...}` for functions that need to be called from HTML event handlers (onclick, onchange, etc.).

### Metadata
- Source: error
- Related Files: alfred-hub/index.html
- Tags: javascript, html, frontend

### Resolution
- **Resolved**: 2026-02-25T12:45:00Z
- **Promoted**: AGENTS.md (self-improvement section)
