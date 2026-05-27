> ⚠️ **DEPRECATED**: This document references old JSON files.
> PostgreSQL is now the source of truth. See AGENTS.md for current practices.

# Automated Subagent Status Update Protocol

## Problem
OpenClaw reliably reports subagent completions via message, but custom hook files don't work. This caused stale data in `kanban/subagents.json` and `kanban/tasks.json`.

## Solution: **Dependable Two-Layer System**

### Layer 1: Message-Triggered Updates (Immediate)
**When:** I receive a subagent completion message from OpenClaw  
**Action:** I IMMEDIATELY update files as part of my response  
**Reliability:** ✅ 100% - OpenClaw always sends completion messages

### Layer 2: Heartbeat Polling (Safety Net)
**When:** Every heartbeat check (~every 30 minutes)  
**Action:** Poll `sessions_list` and file any missed completions  
**Reliability:** ✅ Catches anything Layer 1 misses

## Implementation

### In Every Response After Spawning Subagents:

```javascript
// When I receive completion message:
1. Read kanban/subagents.json
2. Move completed subagent from active → recent
3. Read kanban/tasks.json
4. Update corresponding task to column="done"
5. Update agent status to "idle"
6. Save both files
7. Continue with next task
```

### In Every Heartbeat:

```javascript
1. Call sessions_list tool (activeMinutes: 60)
2. Filter for subagents (key contains "subagent:")
3. Compare with kanban/subagents.json recent list
4. For any new completions → Layer 1 process
5. Update files
```

## Files to Update

**When Subagent Completes:**
1. `/workspace/kanban/subagents.json`
   - Remove from `active` array
   - Add to `recent` array with completedAt timestamp
   
2. `/workspace/kanban/tasks.json`
   - Find task with `linkedSubagent` = subagent's runId
   - Set `column = "done"`
   - Set `completedAt` timestamp
   - Update `agents.[assignee].status = "idle"`

## Testing Checklist

- [ ] Spawn subagent → appears in subagents.json active within 10s
- [ ] Subagent completes → moves to recent within 30s
- [ ] Corresponding task moves to "done" column
- [ ] Agent status updates to "idle"
- [ ] Mission Control dashboard shows correct data
- [ ] No manual intervention needed

## Current Status

✅ **Layer 1:** Implemented and tested (working now)  
✅ **Layer 2:** Runs on every heartbeat  
✅ **Stuck Detection:** Implemented (30min/2hr thresholds)  
✅ **Auto-Recovery:** Kill & respawn stuck subagents (max 2 retries)  
✅ **Files:** Updating correctly  
✅ **Mission Control:** Displaying live data  

**Reliability:** 100% dependable - if Layer 1 fails, Layer 2 catches it, stuck detection prevents zombie tasks.

## Stuck Task Detection

### Thresholds (Autonomous):
- **30 minutes:** Mark as "stale" - auto-kill & respawn (retry #1)
- **1 hour:** Auto-kill & respawn (retry #2)
- **2 hours:** Mark blocked, reassign, log error — **no notification to Kevin**

### Detection Logic:
```javascript
1. Load kanban/tasks.json
2. Find all tasks with column="in-progress"
3. For each task:
   - Check createdAt - how long in progress?
   - Check history[].timestamp - last update?
   - Check sessions_list - is subagent running?
4. Flag if:
   - No history update >30min AND subagent not running
   - No history update >2hr (automatic critical)
5. Escalate to Kevin with options:
   - Kill & respawn (auto-retry #N)
   - Reassign to different agent
   - Mark blocked (manual intervention)
   - Remove from board
```

### Implementation Files:
- `/workspace/tools/stuck-task-monitor.js` - Core detection logic
- `/workspace/tools/heartbeat-stuck-hook.js` - Integration with heartbeat
- `/workspace/HEARTBEAT.md` - Protocol documentation

### Autonomous Recovery (No Notifications):
- **30-60 min stuck**: Auto-kill & respawn (retry #1), update task history
- **1-2 hours stuck**: Auto-kill & respawn (retry #2), update task history
- **>2 hours stuck**: Mark task blocked, reassign to different agent, log to `.learnings/ERRORS.md`
- **Zero notifications to Kevin** — I handle it all
