# PostgreSQL Migration Cleanup - Master Plan

**Goal**: Eliminate all JSON file dependencies, ensure 100% PostgreSQL operation, deliver reliable product.

**Current State**: 
- Mission Control BUILD FAILING due to 40+ references to old JSON files
- Critical code paths still reading: tasks.json, subagents.json, agent-status.json
- Tools layer: 11 files using JSON
- Documentation: 60+ outdated references

---

## Phase 1: Mission Control Code Fixes (CRITICAL - Breaking Build)

**Files to fix: 2**
1. ✗ `mission-control/src/lib/heartbeat.ts` - Still reading tasks.json
2. ✗ Migration scripts (can stay as-is, historical)

**Deliverable**: `npm run build` succeeds with zero errors

**Estimated**: 15 min

---

## Phase 2: Tools Layer Migration (HIGH PRIORITY)

**Files to fix: 11**

### Active Tools (Need PostgreSQL):
1. ✗ `tools/heartbeat-stuck-hook.js` → Rewrite to use PostgreSQL
2. ✗ `tools/agent-status-hook.js` → Rewrite to use PostgreSQL (superceded by agent-status-updater.js)
3. ✗ `tools/autonomous-task-pull.js` → Rewrite to use PostgreSQL
4. ✗ `tools/completion-verifier.js` → Rewrite to use PostgreSQL
5. ✗ `tools/proactive-briefing.js` → Rewrite to use PostgreSQL
6. ✗ `tools/subagent-monitor.js` → Rewrite to use PostgreSQL
7. ✗ `tools/auto-status-sync.js` → Rewrite to use PostgreSQL

### Archive (No longer needed - already replaced):
- `tools/agent-status-hook.js` → Replaced by `agent-status-updater.js` ✅
- `tools/heartbeat-stuck-hook.js` → Replaced by `stuck-task-monitor.js` ✅

**Deliverable**: All active tools use PostgreSQL exclusively

**Estimated**: 45 min

---

## Phase 3: Documentation Cleanup (MEDIUM PRIORITY)

**Files to update: 60+ references**

### Critical docs (must fix):
1. AGENTS.md
2. HEARTBEAT.md  
3. MEMORY.md
4. docs/OPERATIONAL-RUNBOOK.md
5. docs/README-COMPONENTS.md

### Historical docs (add DEPRECATION notices):
- POSTGRESQL-MIGRATION-PLAN.md
- LIVE_STATUS_IMPLEMENTATION.md
- All memory/*.md files

**Deliverable**: No active documentation points to JSON files

**Estimated**: 30 min

---

## Phase 4: Verification & Testing (CRITICAL)

**Test checklist:**
- [ ] `npm run build` succeeds
- [ ] Mission Control loads at http://192.168.1.56:8765/
- [ ] Agent status updates in real-time (PostgreSQL)
- [ ] Task status updates work
- [ ] Subagent spawn → completion flow works
- [ ] Stuck task detection works (from heartbeat)
- [ ] All API endpoints return PostgreSQL data
- [ ] No console errors in browser

**Deliverable**: Signed test report with all checks passing

**Estimated**: 30 min

---

## Agent Assignments & Active Management

**Alfred (Main) - PROJECT LEAD**:
- ✅ Phase 1: COMPLETE (heartbeat.ts fixed, build passing)
- 🔄 **NOW**: Actively monitoring subagents, preparing Phase 4
- 🔄 **NOW**: Testing API endpoints continuously
- ⏳ Phase 4: Lead verification, sign-off (starts when Phases 2-3 complete)

**Management Duties**:
- Check subagent status every 2 minutes
- Intervene if stuck >10 minutes
- Unblock, reassign, or respawn as needed
- Drive to completion - no passive waiting

**Subagent 1 (558a84f5)**:
- Phase 2: Tools layer migration (7 files)
- Status: Running
- Check-in: Every 5 minutes via sessions_list

**Subagent 2 (43e3f4d9)**:
- Phase 3: Documentation cleanup (60+ refs)
- Status: Running
- Check-in: Every 5 minutes via sessions_list

---

## Success Criteria

✅ Zero TypeScript errors  
✅ All API endpoints use PostgreSQL  
✅ Zero runtime references to JSON files in code  
✅ Documentation accurate  
✅ All tests pass  
✅ Build succeeds  

---

## Timeline

- **Phase 1**: NOW - 15 min
- **Phase 2**: Spawn subagent - 45 min
- **Phase 3**: Spawn subagent - 30 min (parallel)
- **Phase 4**: Verification - 30 min

**Total**: 90 minutes to delivery

---

**Status**: Plan created, ready to execute Phase 1
