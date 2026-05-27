# Operational Runbook

**For:** Kevin Wolfe (and future maintainers)  
**Purpose:** Day-to-day operations, troubleshooting, and maintenance

---

## Quick Start (New Day)

1. **Check Mission Control:** http://192.168.1.56:8765/
   - Agent statuses
   - Today's calendar
   - Active tasks

2. **Morning Briefing:** Arrives at 8:00 AM via Telegram
   - Weather
   - Calendar
   - Task suggestions
   - Reply with number to start task

3. **Evening Summary:** Arrives at 8:00 PM via Telegram
   - What shipped today
   - Progress summary

---

## Common Tasks

### Create New Task

**Option 1: Via Telegram**
```
"Alfred, create a task to [do X]"
```

**Option 2: Direct SQL**
```sql
-- Insert into PostgreSQL tasks table
INSERT INTO tasks (title, column_name, assignee, priority, description, created_at)
VALUES (
  'Task title',
  'backlog',
  'alfred',
  'high',
  'What needs done',
  NOW()
);
```

**Option 3: Via Tool**
```javascript
// Use agent-status-updater or direct SQL client
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://alfred:AlfredDB2026Secure@localhost:5432/mission_control' });
await pool.query(`INSERT INTO tasks (...) VALUES (...)`);
```

### Check Task Status

```bash
# Via API
curl http://192.168.1.56:8765/api/tasks

# Via Mission Control UI
Navigate to /tasks

# Direct SQL query
PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d mission_control \
  -c "SELECT id, title, column_name, assignee, priority, created_at FROM tasks ORDER BY created_at DESC;"
```

### Spawn Subagent

```javascript
// In conversation
"Spawn cloud model to [task]"

// Or programmatically
sessions_spawn({
  task: "task description",
  label: "Agent - Task Name",
  mode: "run"
})
```

### Generate Dad Joke Video

**Auto-runner pipeline:**
```bash
cd /workspace
node tools/auto-dadjoke-runner.js
```

**Manual generation:**
```bash
cd /workspace/dadtasticdads-remotion
node scripts/generate-dadjoke-video-v3.js --props-file props.json
```

**Output:** `/workspace/dadtasticdads-output/{jokeId}-video-V1.mp4`

---

### Dad Joke Approval Workflow (CRITICAL)

**After video generation:**

1. **Video is sent to Kevin via Telegram** (auto-runner does this automatically)
   - Attaches video file
   - Shows joke text, specs, preview
   
2. **Kevin reviews and replies:**
   - ✅ "approve" / "yes" / "publish" → Proceed to YouTube upload
   - ❌ "reject" / "no" → Delete video, mark joke as skipped
   - 🔧 "revise: [feedback]" → Regenerate with fixes

3. **After approval:**
   ```bash
   # Upload to YouTube (Private initially)
   python3 skills/youtube-uploader/scripts/youtube-upload.py upload \
     --file /workspace/dadtasticdads-output/{jokeId}-video-V1.mp4 \
     --title "Dad Joke #{id}" \
     --privacy private
   
   # Mark as Posted=TRUE in Dadabase
   gletsheets update {spreadsheet_id} "Sheet1!D{id}" "TRUE"
   ```

**IMPORTANT:** Never upload to YouTube without Kevin's explicit approval. The auto-runner pauses after sending the video to Kevin and waits for approval before proceeding.

---

## Troubleshooting

### Agent Not Responding

**Symptoms:**
- No reply to Telegram messages
- Session shows "busy" indefinitely

**Fix:**
```bash
# Check sessions
openclaw sessions list

# Kill stuck session
openclaw sessions kill <session-id>

# Restart gateway if needed
openclaw gateway restart
```

### Task Stuck In Progress

**Symptoms:**
- Task in "in-progress" for >2 hours
- No subagent running

**Fix:**
```bash
# Run status sync
node /workspace/tools/agent-status-sync.js

# Check subagent status
curl http://192.168.1.56:8765/api/subagents

# Manually mark task done (if appropriate) via SQL:
PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d mission_control \
  -c "UPDATE tasks SET column_name='done', completed_at=NOW() WHERE id=<task_id>;"
```

### Calendar Not Showing Events

**Symptoms:**
- Events missing from calendar page
- Reminders not firing

**Fix:**
```bash
# Check events file
cat /workspace/calendar/events.json

# Check reminders
cat /workspace/calendar/reminders.json

# Verify API
curl http://192.168.1.56:8765/api/calendar/events
```

### Memory Not Working

**Symptoms:**
- Alfred doesn't remember context
- mem0 retrieval returns empty

**Fix:**
```bash
# Check mem0 stats
node -e "const m = require('./tools/mem0-tool.js'); m.getStats()"

# List memories
cat /workspace/.mem0/kevin-memories.json | jq '.length'

# Re-import from MEMORY.md
node -e "const m = require('./tools/mem0-tool.js'); m.importFromMemoryMd()"
```

### Mission Control Not Loading

**Symptoms:**
- Blank page
- Loading spinner forever

**Fix:**
```bash
# Check if Next.js is running
ps aux | grep next

# Restart dev server
cd /workspace/mission-control
npm run dev

# Check for build errors
npm run build
```

### GitHub Push Failing

**Symptoms:**
- `403 Forbidden` on push
- Token expired

**Fix:**
```bash
# Update token in remote URL
cd /workspace/mission-control
git remote set-url origin https://russelopenclaw:NEW_TOKEN@github.com/russelopenclaw/mission-control.git

# Verify
git push
```

---

## Maintenance

### Daily (Automated)

- ✅ Morning briefing (8 AM)
- ✅ Evening summary (8 PM)
- ✅ Heartbeat checks (every 30 min)
- ✅ Subagent sync (every heartbeat)

### Weekly

- [ ] Review MEMORY.md - archive old daily logs
- [ ] Check disk usage
- [ ] Review error logs (`.learnings/ERRORS.md`)
- [ ] Update dependencies (`npm update` in projects)

### Monthly

- [ ] Token rotation (GitHub, ElevenLabs, etc.)
- [ ] Backup workspace
- [ ] Review and promote learnings to docs
- [ ] Performance audit (memory, speed)

---

## File Locations Cheat Sheet

| Location | Purpose |
|----------|---------|
| **PostgreSQL `tasks` table** | Task board (single source of truth) |
| **PostgreSQL `agents` table** | Agent status (single source of truth) |
| **PostgreSQL `subagents` table** | Subagent history |
| `/workspace/calendar/events.json` | Calendar events |
| `/workspace/calendar/reminders.json` | Reminders |
| `/workspace/MEMORY.md` | Long-term memory |
| `/workspace/memory/YYYY-MM-DD.md` | Daily logs |
| `/workspace/.mem0/kevin-memories.json` | Vector memory |
| `/workspace/docs/` | Documentation |
| `/workspace/.learnings/` | Error/lesson logs |
| `/agents/main/config.json` | Agent config |

**Note:** As of 2026-03-05, tasks and agent status moved from JSON files to PostgreSQL. Old JSON files may exist for historical reference but are deprecated.

---

## Emergency Contacts

| Role | Contact |
|------|---------|
| Alfred (Primary) | This session |
| OpenClaw Support | https://discord.gg/clawd |
| Kevin Wolfe | You're reading this |

---

## Decision Log

**Date** | **Decision** | **Rationale**
--------|------------|------------
2026-03-04 | Use mem0 for long-term memory | Vector search > keyword search
2026-03-04 | Heartbeat every 30 min | Balance between responsiveness and token cost
2026-03-04 | Mission Control as Next.js | Fast, modern, easy to extend
2026-03-04 | Alfred as primary orchestrator | Centralized decision-making

---

*Keep this document updated. If you fix something, document it here.*

---

## For Alfred (AI Agent Reference)

### Quick Decision Trees

**"Should I spawn a subagent?"**
```
Is task specialized? (video, complex code)
  └─ Yes → Spawn specialist (cloud model)
  └─ No → Can I do it in one session?
       └─ Yes → Do it directly
       └─ No → Spawn subagent with run mode
```

**"Is this task stuck?"**
```
Task in-progress > 30 min?
  └─ Yes → Query PostgreSQL: SELECT * FROM tasks WHERE column_name='in-progress' AND updated_at < NOW() - INTERVAL '30 min'
       └─ Check sessions_list for linked subagent
            └─ Subagent running? → Wait, check again in 30 min
            └─ No subagent → Auto-complete or reassign
```

**"Should I notify Kevin?"**
```
Is this external/public? (email, GitHub PR, tweet)
  └─ Yes → Ask for approval
Is this destructive? (delete, rm, destructive operation)
  └─ Yes → Ask for approval
Is this a milestone completion?
  └─ Yes → Send summary
Is this routine status? (heartbeat, normal progress)
  └─ Yes → HEARTBEAT_OK (silent)
```

### Common API Calls (Copy-Paste)

```bash
# Check active subagents
curl -s http://192.168.1.56:8765/api/subagents

# Get all tasks (reads from PostgreSQL)
curl -s http://192.168.1.56:8765/api/tasks

# Get today's calendar
curl -s http://192.168.1.56:8765/api/calendar/events?date=$(date +%Y-%m-%d)

# Update agent status (via PostgreSQL)
PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d mission_control \
  -c "UPDATE agents SET status='working', current_task='task name', last_activity=NOW() WHERE name='alfred';"

# Or via API (if endpoint available)
curl -X PUT http://192.168.1.56:8765/api/status/update \
  -H "Content-Type: application/json" \
  -d '{"agent":"alfred","status":"working","currentTask":"task name"}'

# Send Telegram message via tool (in conversation)
message tool: send to telegram:8177470832
```

### File Edit Patterns

**Mark task done (PostgreSQL):**
```sql
-- Update task status
UPDATE tasks 
SET column_name='done', 
    completed_at=NOW(),
    updated_at=NOW()
WHERE id=<task_id>;
```

**Update agent status (PostgreSQL):**
```sql
UPDATE agents 
SET status='idle',  -- or 'working'
    current_task=NULL,  -- or task description
    last_activity=NOW()
WHERE name='alfred';
```

### Gotchas & Lessons Learned

| Issue | Symptom | Fix |
|-------|---------|-----|
| **Stale agent status** | Agent shows "working" but task is done | Run `agent-status-sync.js` every heartbeat (syncs PostgreSQL) |
| **Git push 403** | Token expired or wrong scope | Embed token in remote URL: `git remote set-url origin https://user:token@github.com/...` |
| **Memory not retrieving** | mem0 returns empty on relevant queries | Check embedding model is running (`nomic-embed-text:latest`) |
| **Subagent completion missed** | Subagent done but task still in-progress | Heartbeat sync compares `sessions_list` with PostgreSQL subagent history |
| **Calendar duplicate events** | Same event appears multiple times | Dedup on title + date before display |
| **Mission Control fake data** | Calendar widget shows hardcoded events | Fetch from `/api/calendar/events`, not hardcoded array |
| **PostgreSQL connection** | Cannot connect to DB | Verify gateway running, check credentials in env/config |

### Session Continuity Checklist

**Start of every session:**
1. Read SOUL.md, USER.md, AGENTS.md
2. Read today's memory: `memory/YYYY-MM-DD.md`
3. If main session: Read MEMORY.md
4. Query PostgreSQL for active tasks: `SELECT * FROM tasks WHERE column_name='in-progress';`
5. Run agent-status-sync.js if needed
6. Check .briefing-queue.json for pending messages

**End of significant work:**
1. Update task status in PostgreSQL `tasks` table
2. Update agent status in PostgreSQL `agents` table
3. Log significant events to memory/YYYY-MM-DD.md
4. Commit changes to workspace
5. Promote learnings to MEMORY.md if broadly applicable

### Model Selection Guide

| Task Type | Recommended Model |
|-----------|------------------|
| General conversation | `qwen2.5:7b` (local) |
| Complex reasoning | `qwen3.5:cloud` |
| Code generation | `qwen2.5-coder:7b` or `qwen3-coder-next:cloud` |
| Text analysis | `mistral:7b` |
| Image prompts | `llama3.1:latest` |
| Embeddings | `nomic-embed-text:latest` |
| Tool use | `llama3-groq-tool-use:8b` |

### Tool Call Reminders

**DO:**
- Call tools directly for routine actions (read, write, edit, exec)
- Use message tool for Telegram/Discord sends
- Use sessions_spawn for subagents
- Use memory_search before answering context questions
- Run agent-status-sync.js every heartbeat

**DON'T:**
- Poll sessions_list in a loop (check on-demand only)
- Use exec/curl for provider messaging (use message tool)
- Send half-baked replies to messaging surfaces
- Assume file state — always read first

### Recovery Procedures

**If I seem "stuck" or confused:**

1. **Check session context:**
   ```bash
   cat /agents/main/sessions/latest.jsonl | tail -50
   ```

2. **Verify file state:**
   ```bash
   # What tasks are active? (PostgreSQL)
   PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d mission_control \
     -c "SELECT id, title, column_name, assignee FROM tasks WHERE column_name='in-progress';"
   
   # What's my status? (PostgreSQL)
   PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d mission_control \
     -c "SELECT name, status, current_task, last_activity FROM agents;"
   ```

3. **Restart fresh if needed:**
   - Kill current session
   - Start new session
   - Re-read context files
   - Continue from last known good state

---

*This section is for Alfred's benefit — keep it updated with learnings.*

---

## Calendar PostgreSQL Migration (2026-03-06)

### Completed
- Created `calendar_events` and `reminders` tables in PostgreSQL
- Migrated 24 events and 2 reminders from JSON to PostgreSQL
- Updated `src/lib/calendar/events.ts` to use PostgreSQL instead of JSON files
- Fixed API routes to support both date and ISO timestamp formats
- Archived old JSON files to `*.json.bak`

### Database Schema

```sql
-- calendar_events table
CREATE TABLE calendar_events (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  type VARCHAR(20) CHECK (type IN ('personal', 'meeting', 'reminder', 'cron')),
  description TEXT,
  location VARCHAR(500),
  recurring_rule VARCHAR(500),
  recurring_until DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- reminders table  
CREATE TABLE reminders (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  due_date DATE NOT NULL,
  due_time TIME,
  recurring_rule VARCHAR(500),
  recurring_until DATE,
  completed BOOLEAN DEFAULT FALSE,
  notified_at TIMESTAMPTZ,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Rollback (if needed)
If issues arise, restore JSON files:
```bash
cd /home/kevin/.openclaw/workspace/calendar
mv events.json.bak events.json
mv reminders.json.bak reminders.json
# Then revert src/lib/calendar/events.ts to use fs.readFile
```

### Files Changed
- `mission-control/src/lib/calendar/events.ts` - PostgreSQL backend
- `mission-control/src/app/api/calendar/events/route.ts` - Date format fix
- `mission-control/db/migrations/002-calendar-schema.sql` - Schema
- `mission-control/db/migrations/migrate-calendar-data.js` - Migration script
