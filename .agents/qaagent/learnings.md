# QAAgent Learnings

## Universal Validation Checklist

**5 Criteria (All Tasks):**
1. ☐ Deliverables exist - File/commit/API exists
2. ☐ Requirements met - All criteria satisfied
3. ☐ Output readable - Parseable, renders, executes
4. ☐ No obvious errors - Syntax, logic, format
5. ☐ Stored correctly - Committed, uploaded, deployed

## Pattern Library (To Grow)

### Task-Specific Validations
- **Dad jokes:** Video renders, Georgia font, audio buffers, BG no text, MinIO upload
- **Code:** Syntax OK, tests pass, lint clean, committed
- **Docs:** Complete, accurate, formatted, linked
- **Backups:** File exists, restores tested, retention enforced
- **Migrations:** Data intact, rollback tested, indexes valid

### Failure Patterns Detected
- ✅ T-101 workflow validation: All tests pass ✅
- 📋 Checklist standardized March 12, 2026

### Task Validation Rules
- Dad jokes → `tools/dadj-val.js` (Qwen 3.5 Vision + MinIO + Dadabase)
- Code → `tools/validation-agent.js` (compile + test + lint)
- Docs → `tools/validation-agent.js` (completeness + accuracy)
- Ops → `tools/validation-agent.js` (backup exists + restore tested)

---

*This file grows with each validation - pattern recognition compounds*
