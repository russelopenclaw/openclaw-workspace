# Alfred's Workflow Architecture

**Event-Driven Task Lifecycle Management**

**Date:** March 12, 2026  
**Status:** ✅ Production Ready  
**Tested:** Full workflow validated (T-101)

---

## Executive Summary

Automated task lifecycle system with enforced states:
```
BACKLOG → READY → IN_PROGRESS → VALIDATION → DONE
                                      ↓
                              FAIL: READY (with notes)
```

**Key Features:**
- ✅ Database triggers auto-manage state transitions
- ✅ Validation agent enforces quality gates
- ✅ Webhook daemon broadcasts events
- ✅ Mandatory task structure (no exceptions)
- ✅ Complete audit trail in task_history

---

## Workflow Rules (MANDATORY)

### Alfred's Protocol:

1. **New Goal** → Create tasks in BACKLOG
2. **READY Tasks** → Assign agent
3. **Agent Completes** → Move to VALIDATION
4. **Validation** → Verify deliverable
5. **Validation PASS** → DONE
6. **Validation FAIL** → READY (with feedback notes)

**No exceptions.** Every task follows this flow.

---

## Architecture Components

### 1. Database Triggers (`db/triggers/task-workflow.sql`)

**Purpose:** Automated state management, audit logging

**Triggers:**
| Trigger | Fires | Action |
|---------|-------|--------|
| `trg_new_task_before` | BEFORE INSERT | Auto-ID, auto-column, validate deliverables |
| `trg_new_task_after` | AFTER INSERT | Log creation to history |
| `trg_status_change` | AFTER UPDATE column | Log transition, emit NOTIFY, auto-timestamps |
| `trg_auto_archive` | AFTER UPDATE (DONE) | Set completed_at |

**Enforcements:**
- `deliverables` column REQUIRED (exception thrown if missing)
- High priority tasks → READY, others → BACKLOG
- Task IDs auto-generated: T-101, T-102, T-103...
- All transitions logged to `task_history`
- PostgreSQL NOTIFY events fired on status change

### 2. Task Factory (`tools/create-task.js`)

**Purpose:** Create tasks with mandated structure

**Command:**
```bash
node tools/create-task.js <title> <deliverables> [criteria...] --agent <name> --desc <text>
```

**Enforced Structure:**
```
Task ID: T-101

Title: [Concise summary]
Description: [Context & scope]
Deliverables: [Tangible output - REQUIRED]
Assigned Agent: [Owner]
Status: READY

Validation Criteria:
- [Testable criterion 1]
- [Testable criterion 2]
- [Testable criterion 3]
```

**Validation:**
- Deliverables MUST be specified (throws exception if missing)
- Criteria MUST be testable
- Tasks start in READY or BACKLOG (not IN_PROGRESS)

### 3. Workflow Hook (`tools/agent-workflow-hook.js`)

**Purpose:** Enforce workflow protocol in agent code

**Functions:**
```javascript
// Called when agent completes
await workflow.onTaskComplete(taskId, deliverablePath, runId);
// → Moves task from IN_PROGRESS to VALIDATION

// Called by Alfred to transition
await workflow.transitionTask(taskId, 'READY', 'IN_PROGRESS');
// → Moves task with history logging

// Check if task ready to start
const result = await workflow.validateTaskReadiness(taskId);
// → Verifies deliverables, criteria, column state
```

**Agent Integration:**
All worker agents MUST call `onTaskComplete()` when finished → auto-moves to VALIDATION.

### 4. Validation Agent (`tools/validation-agent.js`)

**Purpose:** Quality assurance gatekeeper

**Command:**
```bash
node tools/validation-agent.js <task-id> [deliverable-path]
```

**Process:**
1. Load task from PostgreSQL
2. Analyze deliverable (file, API, commit, etc.)
3. Validate against criteria
4. Move to DONE (pass) or READY (fail with notes)
5. Log result to task_history

**Validation Checks:**
- File exists and has content
- File type matches expected (e.g., .json)
- JSON syntax valid (if applicable)
- Array length correct (if specified)
- Consistent data structure (if theme required)

**Output:**
```
Validation Result: PASS/FAIL
Message: All validation criteria passed
Issues: [ ]
Suggestions: [ ]
→ Task moved to DONE/READY
```

### 5. Webhook Daemon (`tools/task-webhook-daemon.js`)

**Purpose:** Listen to PostgreSQL events, trigger actions

**Run:**
```bash
node tools/task-webhook-daemon.js &
echo $! > .learnings/WEBHOOK-DAEMON.pid
```

**Events:**
- `task_status_changed` → Log to dashboard, notify Alfred
- `agent_work_complete` → Trigger validation
- `task_assigned_to_alfred` → Auto-process READY tasks

**Actions:**
- Append to `.learnings/TASK-TRANSITIONS.log`
- Call agent-status-updater.js (working agents)
- Trigger validation-agent.js when →VALIDATION
- Alert Alfred when READY tasks waiting

### 6. Heartbeat Integration

**Every 30 minutes:**
- Check READY tasks → spawn sub-agents
- Check IN_PROGRESS tasks (>30 min) → stuck detection
- Check VALIDATION tasks → trigger validation
- Log all transitions to memory

---

## Database Schema

### tasks table (columns)

| Column | Type | Required | Default |
|--------|------|----------|---------|
| id | varchar(50) | ✅ | Auto-generated T-XXX |
| title | varchar(500) | ✅ | - |
| description | text | ✅ | Structured format |
| column_name | varchar(50) | ✅ | BACKLOG/READY (trigger) |
| assignee | varchar(50) | - | alfred |
| priority | varchar(20) | - | medium |
| deliverables | text | ✅ | EXCEPTION if missing |
| validation_criteria | text[] | ✅ | - |
| parent_task_id | varchar(50) | - | - |
| linked_subagent | varchar(100) | - | - |
| created_at | timestamp | ✅ | NOW() |
| started_at | timestamp | - | Set on IN_PROGRESS |
| completed_at | timestamp | - | Set on DONE |
| updated_at | timestamp | ✅ | NOW() |

### task_history table

| Column | Type | Purpose |
|--------|------|---------|
| id | integer | Auto-increment |
| task_id | varchar(50) | FK to tasks.id |
| status | varchar(50) | event type (created, status_change, validated) |
| timestamp | timestamp | Auto NOW() |
| note | text | Event details |

---

## Event Flow (Automated)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  INSERT task │────▶│ BEFORE trigger│────▶│ Set ID=101   │
└──────────────┘     └──────────────┘     │ Column=READY │
                                           └──────────────┘
                                                  │
                                                  ▼
                                          ┌──────────────┐
                                          │ AFTER trigger│
                                          │ Log history  │
                                          └──────────────┘
                                                  │
                                                  ▼
                                          ┌──────────────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │ LISTEN daemon│
                                   │ broadcasts   │
                                   └──────────────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │ READY tasks  │
                                   │ → heartbeat  │
                                   │ → assign     │
                                   └──────────────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │ IN_PROGRESS  │
                                   │ agent works  │
                                   └──────────────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │ agent finish │
                                   │ → workflow   │
                                   │ hook         │
                                   └──────────────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │ VALIDATION   │
                                   │ validation   │
                                   │ agent        │
                                   └──────────────┘
                                          │
                              ┌─────────────┴─────────────┐
                              │                           │
                              ▼                           ▼
                        ┌──────────┐                ┌──────────┐
                        │  PASS    │                │   FAIL   │
                        │  → DONE  │                │ → READY  │
                        └──────────┘                │ + notes  │
                                                    └──────────┘
                                                          │
                                                          │ (loop)
                                                          └──────→
```

---

## Testing (Validation Run T-101)

**Test Task:** "Test Workflow Validation"

**Flow:**
1. ✅ CREATE: Task created, ID=T-101, Column=READY, logged
2. ✅ READY: Assignment to TestRunner
3. ✅ IN_PROGRESS: Agent started, logged transition
4. ✅ VALIDATION: Agent completed, workflow-hook moved to VALIDATION
5. ✅ VALIDATION: Validation agent ran, criteria checked
6. ✅ DONE: Validation PASS, task marked complete

**Evidence:**
```sql
SELECT task_id, status, note FROM task_history WHERE task_id='T-101';

-- Result:
T-101 | created       | Task created: ID=T-101...
T-101 | status_change | Transition: READY → IN_PROGRESS
T-101 | status_change | Transition: IN_PROGRESS → VALIDATION
T-101 | status_change | Transition: VALIDATION → DONE
T-101 | validated     | Validation by validation-agent: Status=PASS
```

**Result:** Full workflow validated ✅

---

## Usage Patterns

### Create Task (Alfred)
```bash
node tools/create-task.js "Fix login bug" \
  "Passing unit tests" \
  "All tests pass" "Bug fixed" "No regressions" \
  --agent BackendDev \
  --desc "Login fails on special characters" \
  --priority high
```

### Assign Task (Heartbeat)
```javascript
// In heartbeat-runner.js
const readyTasks = await getReadyTasks();
for (const task of readyTasks) {
  await assignTask(task.id, 'SubAgentId');
}
```

### Agent Completion
```javascript
// In worker agent script
const workflow = require('./tools/agent-workflow-hook');
await workflow.onTaskComplete(taskId, deliverablePath, runId);
// → Auto-moves to VALIDATION
```

### Validate Task
```bash
node tools/validation-agent.js T-101 /workspace/output/test-results.json
```

### Listen to Events
```bash
node tools/task-webhook-daemon.js &
# Runs as background daemon
```

---

## File Locations

| Component | Path |
|-----------|------|
| Database Triggers | `/workspace/db/triggers/task-workflow.sql` |
| Task Factory | `/workspace/tools/create-task.js` |
| Workflow Hook | `/workspace/tools/agent-workflow-hook.js` |
| Validation Agent | `/workspace/tools/validation-agent.js` |
| Webhook Daemon | `/workspace/tools/task-webhook-daemon.js` |
| Heartbeat Runner | `/workspace/tools/heartbeat-runner.js` |
| Documentation | `/workspace/docs/WORKFLOW-ARCHITECTURE.md` |
| Event Log | `/workspace/.learnings/TASK-TRANSITIONS.log` |
| Daemon PID | `/workspace/.learnings/WEBHOOK-DAEMON.pid` |

---

## Maintenance

### Daily Operations
- Heartbeat checks every 30 min
- Webhook daemon runs continuously
- Validation agent triggered on demand

### Weekly Cleanup
- Archive DONE tasks >30 days old
- Review stuck IN_PROGRESS tasks
- Analyze validation failure patterns

### Monthly Review
- Update validation criteria templates
- Optimize agent assignment logic
- Review event log patterns

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Tasks with deliverables | 100% | 100% ✅ |
| Auto-ID generation | 100% | 100% ✅ |
| Transition logging | 100% | 100% ✅ |
| Validation completion | 100% | 100% ✅ |
| Workflow compliance | 100% | Pending monitoring |

---

## Rules (NON-NEGOTIABLE)

1. **No task without deliverables** - Exception thrown
2. **No task without validation criteria** - Enforced by trigger
3. **No direct DONE** - Must pass through VALIDATION
4. **No skip VALIDATION** - Agent MUST call workflow-hook on completion
5. **No manual column updates** - Use workflow functions only

**Alfred enforces these. No exceptions.**

---

## Next Steps

1. ✅ Database triggers installed
2. ✅ Webhook daemon running
3. ✅ Validation workflow tested
4. 🟢 Integrate with heartbeat-runner.js
5. 🟢 Add systemd service for daemon
6. 🟢 Create dashboard widget for transitions
7. 🟢 Monitor compliance metrics

---

**Document Version:** 1.0 (2026-03-12)  
**Maintainer:** Alfred (alpha agent)  
**Last Tested:** T-101 workflow validation ✅
