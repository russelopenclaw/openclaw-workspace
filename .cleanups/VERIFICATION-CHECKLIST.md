# PostgreSQL Migration - Verification Checklist

**Mission Control Build**: ✅ PASS (completed Phase 1)

---

## Phase 1: Core Code Verification

- [x] `npm run build` succeeds with zero errors
- [x] Mission Control loads at http://192.168.1.56:8765/
- [ ] Agent status updates in real-time (PostgreSQL)
- [ ] Task status updates work
- [ ] Subagent spawn → completion flow works
- [ ] Stuck task detection works (from heartbeat)

---

## Phase 2: Tools Layer Verification (Subagent Running)

**Files migrated: 7**
- [ ] `tools/heartbeat-stuck-hook.js` → PostgreSQL
- [ ] `tools/agent-status-hook.js` → Deprecated notice added
- [ ] `tools/autonomous-task-pull.js` → PostgreSQL
- [ ] `tools/completion-verifier.js` → PostgreSQL
- [ ] `tools/proactive-briefing.js` → PostgreSQL
- [ ] `tools/subagent-monitor.js` → PostgreSQL
- [ ] `tools/auto-status-sync.js` → PostgreSQL

**Verification commands:**
```bash
# Should return ZERO (no active code using old JSON)
grep -r "tasks\.json" /workspace/tools --include="*.js" | grep -v "LEGACY" | grep -v "deprecat" | wc -l
```

---

## Phase 3: Documentation Verification (Subagent Running)

**Critical docs updated:**
- [ ] AGENTS.md - PostgreSQL references
- [ ] HEARTBEAT.md - PostgreSQL queries
- [ ] MEMORY.md - Updated examples
- [ ] docs/OPERATIONAL-RUNBOOK.md - PostgreSQL commands
- [ ] docs/README-COMPONENTS.md - Architecture updated

**Historical docs deprecated:**
- [ ] All markdown files with old references have DEPRECATION banner

---

## Phase 4: API Endpoint Testing

**All endpoints must return PostgreSQL data:**

```bash
# Test /api/status
curl http://localhost:8765/api/status
# Expected: {"agents":{"alfred":{...},"jeeves":{...}}}
```

```bash
# Test /api/tasks
curl http://localhost:8765/api/tasks | jq '.tasks | length'
# Expected: 48 tasks
```

```bash
# Test /api/subagents
curl http://localhost:8765/api/subagents
# Expected: Array of subagents from PostgreSQL
```

```bash
# Verify database has data
PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d mission_control \
  -c "SELECT COUNT(*) FROM tasks; SELECT COUNT(*) FROM agents; SELECT COUNT(*) FROM subagents;"
# Expected: 48 tasks, 2 agents, N subagents
```

---

## Phase 5: End-to-End Flow Test

**Complete workflow test:**

1. [ ] Spawn test subagent
2. [ ] Verify task moves to "in-progress"
3. [ ] Subagent completes task
4. [ ] Task auto-updates to "done"
5. [ ] Agent status updates to "idle"
6. [ ] Mission Control dashboard shows correct status

**Test command:**
```bash
node /workspace/tools/agent-status-updater.js test-agent working "Verification test task"
```

---

## Sign-Off

**Verified by**: Alfred (Main Agent)  
**Date**: 2026-03-05  
**Build Status**: ✅ SUCCESS  
**All tests pass**: [ ] YES / [ ] NO  

**Notes**:

