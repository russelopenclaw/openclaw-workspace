# MEMORY.md - Long-term Memory

## About Kevin
- Name: Kevin
- Timezone: America/Chicago
- Communication: Telegram connected

## About Alfred (me)
- Role: Primary agent / orchestrator / alpha agent
- Named after Batman's butler - proactive, gets things done
- **Tier:** Tier 1 (Master Orchestrator)
- **Model:** qwen3.5:cloud (397B MoE, 256K context)
- **Reasoning:** ON (for strategy, planning, decision-making)
- Spawned sub-agents with reasoning=OFF for execution tasks

## Model Architecture (Multi-Tier System)

### Tier 1: Alfred (Orchestrator)
- Model: `qwen3.5:cloud` (397B, 256K context)
- Reasoning: ON
- Use: Strategy, planning, coordination

### Tier 2: Jeeves (Deep Analysis)
- Model: `deepseek-v3.1:671b-cloud` (general) OR `kimi-k2.5:cloud` (massive docs)
- Reasoning: ON
- Use: Complex analysis, research, deep-dive tasks

### Tier 3: Sub-Agents (Executors)
- Code (small): `qwen2.5-coder:7b` (local) - Reasoning: OFF
- Code (large): `qwen3-coder-next:cloud` (80B) - Reasoning: OFF
- Tool Use: `llama3-groq-tool-use:8b` (local) - Reasoning: OFF
- Research: `llama3.1:8b` (local) - Reasoning: OFF
- Quick Tasks: `qwen2.5:7b` (local) - Reasoning: OFF

**Guiding principle:** Match model to task complexity. Local > Cloud for sub-agents.

## Projects
- **Kanban Board** (completed 2026-02-20, migrated to PostgreSQL 2026-03-05)
  - URL: http://192.168.1.56:8765/
  - **Current:** PostgreSQL `mission_control.tasks` table
  - **Historical:** workspace/kanban/tasks.json (deprecated but may exist for reference)
- **Second Brain** (in progress 2026-02-21)
  - Knowledge storage via PostgreSQL or workspace/kanban/knowledge.json
  - "Remember this [link]" - saves YouTube/articles
  - "Remind me to..." - adds calendar reminders
  - Heartbeat checks for due reminders

## Core Responsibilities

### Alfred Hub Integration (PRIORITY)
**Alfred Hub** is the dashboard at `/kanban/index.html` that shows:
- Agent status (Idle/Working) 
- Tasks I'm actively working on
- Calendar events and reminders

**I MUST update Alfred Hub whenever:**
1. I receive a message → update status to "working" and note the task
2. I create a task → add it to PostgreSQL `tasks` table
3. I complete a task → update its status to "complete" in PostgreSQL
4. I'm idle → set status to "idle" in PostgreSQL `agents` table

**How to update:**
Use PostgreSQL (single source of truth):
```javascript
const agentStatus = require('./tools/agent-status-updater.js');
await agentStatus.update('alfred', 'working', 'current task');
```

**Or via SQL:**
```sql
-- Update agent status
UPDATE agents SET status='working', current_task='task name', last_activity=NOW() 
WHERE name='alfred';

-- Create task
INSERT INTO tasks (title, column_name, assignee, priority, description) 
VALUES ('Task name', 'backlog', 'alfred', 'high', 'Description');
```

This needs to happen in EVERY session so Kevin can see what I'm working on.
- Ollama at 192.168.1.33:11434
- Gateway running on 192.168.1.56
- **PostgreSQL:** mission_control database (tasks, agents tables)

## Preferences (to be updated)
- Kevin wants progress updates on milestones
- Prefers final deliverables with summary
- Likes autonomy - give him a plan, then execute
- **Code Storage Policy**: All code I work on should be pushed to GitHub account `russelopenclaw` (NOT Kevin's wolfeinkc account)

## Todo
- Update MEMORY.md with more context as we work together
- Import MEMORY.md contents into mem0 for semantic search
- Set up automatic memory extraction from conversations

## Semi-Persistent Agents (Created March 12, 2026)

**4 agents with identity + accumulated knowledge** (dormant between activations, but retain memory):

| Agent | Wake Pattern | Accumulates | Files |
|-------|--------------|-------------|-------|
| **DadJ** | Daily 6 AM | Pipeline wisdom (fonts, buffers, validation patterns) | `.agents/dadj/` |
| **QAAgent** | Per-task (VALIDATION) | Failure patterns, validation rules | `.agents/qaagent/` |
| **HealthMon** | Hourly + heartbeat (30 min) | System baselines, "normal" ops knowledge | `.agents/healthmon/` |

Each has:
- `config.json` - Identity, preferences, lifecycle
- `learnings.md` - Accumulated wisdom (grows per run)
- `AGENT.md` - Status, responsibility, mem0 namespace
- `memory.mem0` - Agent-specific mem0 vector space
- `runs/` or `checks/` or `validations/` - Run history

mem0 integration: `agentId` namespace isolates each agent's memory vectors from Alfred's master knowledge.

## mem0 Integration (2026-03-01) ✅ Phase 3 Complete!

**Full persistent memory system operational:**

- **80 memories** embedded (72 from MEMORY.md + 8 test/conversation)
- **Tool wrapper**: `tools/mem0-tool.js` ready for OpenClaw sessions
- **API**: `capture()`, `retrieve()`, `getStats()`, `importFromMemoryMd()`
- **Embedding model**: `nomic-embed-text:latest` via Ollama (768-dim)
- **Search**: Cosine similarity, 0.4+ score threshold
- **Storage**: `.mem0/kevin-memories.json` (~500KB)
- **Performance**: ~50ms embed, ~100ms search

**Test Results:**
- "GitHub account" → [0.672] Code Storage Policy
- "Model preferences" → [0.707] Model configuration
- "Alfred Hub" → [0.833] Dashboard context

**Usage:**
```javascript
const mem0 = require('./tools/mem0-tool.js');
await mem0.capture(messages, 'kevin');
const memories = await mem0.retrieve('query', 'kevin', 5);
```

**Docs:** `docs/mem0-openclaw-integration.md`, `mem0-README.md`
**Status**: Production-ready ✅

## GitHub Repositories (russelopenclaw)
- **DinnerRoulette**: Flutter restaurant picker app - code ready in `/workspace/DinnerRoulette/`, needs push (token scope issue)
  - Local commit: `1017270 Initial commit: Dinner Roulette Flutter app`
  - Bundle created: `/tmp/DinnerRoulette.bundle` (1.9MB)
  - Issue: GITHUB_TOKEN lacks write scope to russelopenclaw repos
  - Remote URL: https://github.com/russelopenclaw/DinnerRoulette.git

## Important Notes
- Kevin's personal GitHub: wolfeinkc (do NOT push code here)
- My GitHub for code: russelopenclaw (DO push all code here)
- The GITHUB_TOKEN environment variable may need refresh with `repo` scope for writing

## Documentation (2026-03-04 / Updated 2026-03-11)

**Comprehensive docs created:**
- SYSTEM-ARCHITECTURE.md - Full system overview
- OPERATIONAL-RUNBOOK.md - Day-to-day ops + Alfred quick reference
- README-COMPONENTS.md - Component reference
- **DADJOKE-PRODUCTION-RUNBOOK.md** - Complete dad joke pipeline (joke #22 tested)

**Key insight:** Docs should help Alfred remember and operate effectively, not just serve as human reference.

**Alfred-specific additions:**
- Decision trees (spawn subagent? task stuck? notify Kevin?)
- Copy-paste API calls
- File edit patterns
- Gotchas table from learnings
- Session continuity checklist
- Model selection guide

---

## PostgreSQL Auto-Backup (Production ✅ 2026-03-13)

**Status:** Complete - nightly cron running at 2 AM
**Script:** `tools/postgres-backup.sh`
**Schedule:** `0 2 * * *` (2 AM daily)
**Retention:** 30 days

**Fix applied:** Added explicit PATH export for Linuxbrew's `mc` command (cron doesn't source .bashrc):
```bash
export PATH="/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:$PATH"
```

**Location:** `hp1/mission-control-backups/backups/`
**Verification:** Backup integrity checked after upload (gunzip test)

---

## Dad Joke Pipeline (Production ✅ 2026-03-11)

**Tested on:** Joke #22 "What do you call a magician who has lost their magic? Ian."

**Pipeline:** ElevenLabs TTS → SD background → Remotion text → YouTube (Private)

**Key learnings:**
1. **Audio MUST have 1s buffers** at start/end (5.7s total: 1s + 3.7s joke + 1s)
2. **Use Georgia serif font** (sans-serif makes capital I look like J)
3. **Remotion cache clears** required (`rm -rf .remotion`) before each render
4. **171 frames @30fps** = 5.7s (not 218 frames / 7.3s)
5. **ElevenLabs direct API** via curl (not CLI wrapper)
6. **Llava OCR struggles** with punchline text - human visual confirmation required

**Files:**
- Runner: `tools/auto-dadjoke-runner.js` (scheduled 6 AM daily)
- Schedule: `cron/auto-dadjoke.json`
- Docs: `dadjasticdads-remotion/PRODUCTION-RUNBOOK.md`
- Cheat sheet: `TOOLS.md` dad joke section

**Database:** Dadabase (Google Sheets) tracking Used/Posted flags
**Storage:** MinIO `hp1/dadjokes/{id}/` with versioning (`-V{n}.mp4`)
**YouTube:** Auto-upload to Private (awaiting Kevin approval)

---
- Tool call best practices
- Recovery procedures

**Maintenance:** Docs are living — update as system evolves or new patterns emerge.
