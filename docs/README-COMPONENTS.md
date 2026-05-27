# OpenClaw Components Reference

Quick reference for all major components in the OpenClaw ecosystem.

---

## Core Agent System

### Alfred (Primary Agent)
- **Role:** Orchestrator, decision-maker
- **Specialization:** Planning, task breakdown, subagent coordination
- **Files:** `/agents/alfred/`


### Sven (Specialist Agent)
- **Role:** Code generation
- **Specialization:** Software development, debugging, refactoring
- **Files:** `/agents/sven/`

---

## Mission Control Dashboard

### Pages

| Page | Route | Purpose |
|------|-------|---------|
| **Home** | `/` | Dashboard overview, stats, quick actions |
| **Tasks** | `/tasks` | Kanban board, task management |
| **Calendar** | `/calendar` | Events, reminders, scheduled jobs |
| **Brain** | `/brain` | Knowledge base, saved links, research |
| **Memory** | `/memory` | Daily logs, long-term memory |
| **Docs** | `/docs` | Documentation browser |

### API Endpoints

```
/api/tasks              # Task CRUD
/api/calendar/events    # Calendar events
/api/calendar/reminders # Reminders
/api/brain/items        # Knowledge base items
/api/memory/daily       # Daily memory logs
/api/memory/longterm    # Long-term memory
/api/status             # Agent status
/api/subagents          # Subagent management
```

### Components

| Component | File | Purpose |
|-----------|------|---------|
| `DashboardLayout` | `src/components/dashboard/` | Header, nav, sidebar |
| `AgentStatus` | `src/components/widgets/` | Live agent status display |
| `TaskManager` | `src/components/widgets/` | Task list + quick actions |
| `CalendarWidget` | `src/components/widgets/` | Home page calendar preview |
| `FiveDayView` | `src/components/calendar/` | 5-day rolling calendar |
| `MonthlyView` | `src/components/calendar/` | Traditional monthly calendar |
| `BrainList` | `src/components/brain/` | Knowledge base item list |
| `MemoryStats` | `src/components/memory/` | Memory usage statistics |

---

## Skills (Tools)

### Built-in Skills

| Skill | Command | Purpose |
|-------|---------|---------|
| `gog` | `gog <command>` | Google Workspace (Gmail, Calendar, Sheets, Docs) |
| `github` | `gh <command>` | GitHub operations (issues, PRs, CI) |
| `browser` | `browser act <action>` | Web browser automation |
| `message` | `message send <target>` | Cross-platform messaging |
| `web_search` | `web_search <query>` | Web search (Brave API) |
| `memory_search` | - | Search long-term memory |
| `memory_store` | - | Save to long-term memory |
| `sessions_spawn` | - | Spawn subagent |
| `tts` | `tts <text>` | Text-to-speech |

### Custom Skills

Location: `/workspace/skills/`

| Skill | Purpose |
|-------|---------|
| `healthcheck` | System security audit |
| `weather` | Weather forecasts |
| `video-frames` | FFmpeg frame extraction |
| `openai-whisper-api` | Audio transcription |
| `elevenlabs-tts` | ElevenLabs voice synthesis |

---

## Automation Scripts

### Location: `/workspace/tools/`

| Script | Purpose | Schedule |
|--------|---------|----------|
| `agent-status-sync.js` | Fix stale agent statuses | Every heartbeat |
| `heartbeat-integration.js` | Heartbeat logic | Every 30 min (cron) |
| `proactive-briefing.js` | Generate morning briefing | Daily 8 AM |
| `auto-status-update.js` | Sync subagent completions | On completion |
| `mem0-tool.js` | Memory operations | On demand |

### Location: `/workspace/cron/`

| Script | Purpose | Schedule |
|--------|---------|----------|
| `daily-briefing.sh` | Send morning briefing | 8:00 AM daily |
| `evening-summary.sh` | Send evening summary | 8:00 PM daily |
| `send-telegram-message.sh` | Generic Telegram sender | On demand |

---

## Data Stores

### Task System

- **Location:** PostgreSQL `mission_control.tasks` table (single source of truth)
- **Schema:** See table definition below
- **Columns:** backlog, in-progress, done
- **Agents:** alfred, sven, kevin
- **Historical:** `/workspace/kanban/tasks.json` (deprecated, may exist for reference)

**PostgreSQL Schema:**
```sql
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  column_name TEXT DEFAULT 'backlog',  -- backlog, in-progress, done
  assignee TEXT,
  priority TEXT DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  linked_subagent TEXT,
  history JSONB
);
```

### Agent Status

- **Location:** PostgreSQL `mission_control.agents` table
- **Fields:** status, current_task, last_activity
- **Update Frequency:** Real-time + heartbeat sync
- **Historical:** `/workspace/kanban/tasks.json` agents object (deprecated)

### Subagent History

- **Location:** `/workspace/kanban/subagents.json`
- **Arrays:** active, recent
- **Retention:** Last 20 runs

### Calendar

- **Events:** `/workspace/calendar/events.json`
- **Reminders:** `/workspace/calendar/reminders.json`
- **Format:** Array of event/reminder objects

### Memory

- **Curated:** `MEMORY.md`
- **Daily:** `/workspace/memory/YYYY-MM-DD.md`
- **Vector:** `/workspace/.mem0/kevin-memories.json`

### Brain (Knowledge Base)

- **Items:** `/workspace/kanban/brain.json`
- **Schema:** Array of saved items with keywords, source URL, content

---

## External APIs

### Ollama (Local LLM)

```
Endpoint: http://192.168.1.33:11434
Models:
  - qwen2.5:7b (general)
  - mistral:7b (analysis)
  - llama3.1:latest (creative)
  - nomic-embed-text:latest (embeddings)
```

### Stable Diffusion (Local)

```
Endpoint: http://192.168.1.33:7860
API: /sdapi/v1/txt2img
Format: 480x720 (vertical video backgrounds)
```

### GitHub

```
Account: russelopenclaw
Token: GITHUB_TOKEN env var
Scope: repo (full control)
```

### Google Workspace

```
Tool: gog CLI
Service: russelopenclaw@gmail.com
Services: Gmail, Calendar, Sheets, Docs
```

### ElevenLabs

```
API: https://api.elevenlabs.io/v1/text-to-speech
Voice: George (JBFqnCBsd6RMkjVDRZzb)
Model: eleven_multilingual_v2
```

### here.now

```
Purpose: Content publishing
API Key: Stored in env/config
Format: HTML pages with embedded media
```

---

## Message Surfaces

### Telegram (Primary)

- **Chat ID:** 8177470832 (Kevin)
- **Bot:** Configured in OpenClaw gateway
- **Features:** Messages, buttons, reactions

### Discord (Future)

- **Server:** TBC
- **Bot:** TBC
- **Features:** Channels, threads, reactions

---

## File Structure Quick Reference

```
~/.openclaw/
├── workspace/
│   ├── docs/                      # Documentation
│   │   ├── SYSTEM-ARCHITECTURE.md
│   │   ├── OPERATIONAL-RUNBOOK.md
│   │   └── README-COMPONENTS.md
│   ├── kanban/
│   │   ├── tasks.json            # Task board (DEPRECATED - PostgreSQL now)
│   │   └── subagents.json        # Subagent history (DEPRECATED - PostgreSQL now)
│   ├── calendar/
│   │   ├── events.json           # Calendar events
│   │   └── reminders.json        # Reminders
│   ├── memory/
│   │   └── YYYY-MM-DD.md         # Daily logs
│   ├── agents/
│   │   ├── alfred/
│   │   └── sven/
│   ├── tools/
│   │   ├── agent-status-sync.js
│   │   ├── mem0-tool.js
│   │   └── heartbeat-integration.js
│   ├── cron/
│   │   ├── daily-briefing.sh
│   │   └── evening-summary.sh
│   ├── mission-control/          # Dashboard app
│   └── dadtasticdads-remotion/   # Video gen
├── agents/
│   └── main/
│       ├── config.json
│       └── sessions/
└── config.json

PostgreSQL Database: mission_control
├── tasks          # Task board (replaces kanban/tasks.json)
├── agents         # Agent status (replaces kanban/tasks.json agents object)
└── subagents      # Subagent history (replaces kanban/subagents.json)
```

---

*Keep this updated when new components are added.*
