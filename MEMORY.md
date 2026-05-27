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
- **Reasoning:** ON (for strategy, planning, decision-making) - **session-scoped, must toggle each session**
- **Vision:** YES — For image analysis, ALWAYS use `qwen3.5:cloud` (NOT OpenAI/Claude/other)
- Spawned sub-agents with reasoning=OFF for execution tasks

## Reasoning Mode Note (2026-03-14)
- Reasoning mode (`/reasoning on`) is **session-scoped**, not persistent
- Resets to `off` on each new session/heartbeat
- Kevin prefers it ON for main sessions (orchestrator work)
- Keep it OFF for sub-agents (they're executors, don't need deep reasoning)

## Model Architecture (Multi-Tier System)


- **Tier 1:** Alfred (qwen3.5:cloud, reasoning ON) — orchestrator
- **Tier 2:** Cloud models (glm-5.1, qwen3-coder-next, gemma4, nemotron, deepseek-v4-flash) — spawn as sub-agents
- **Tier 3:** Sub-agents (minimax for tools, gemma4 for general) — reasoning OFF
- **DeepSeek V4 Flash:** 284B MoE, 13B active, 1M context, strong coding (91.6% LiveCodeBench) and agentic tasks, cheap ($0.14/$0.28 per M tokens)
- **DeepSeek V4 Pro:** Reasoning-capable, 256K context — added 2026-05-20, available via `deepseek-v4-pro:cloud`

## Projects
- **Kanban Board** (completed 2026-02-20, migrated to PostgreSQL 2026-03-05)
  - URL: http://192.168.1.56:8765/
  - **Current:** PostgreSQL `mission_control.tasks` table
  - **Historical:** workspace/kanban/tasks.json (deprecated but may exist for reference)
- **TrendSpot** (enhanced 2026-04-16)
  - Now combines Google Trends + X/Twitter trends
  - Single unified feed for trend-driven idea discovery
- **Second Brain** (in progress 2026-02-21)
  - Knowledge storage via PostgreSQL or workspace/kanban/knowledge.json
  - "Remember this [link]" - saves YouTube/articles
  - "Remind me to..." - adds calendar reminders
  - Heartbeat checks for due reminders
- **Mission Control Dashboard** (revived 2026-04-14)
  - URL: http://192.168.1.56:8765/ or http://server:8765/
  - All API routes public (auth for login only)
  - Features: Needs Attention, Activity Feed, Plex integration, Error Digest, Morning Briefing
  - Real-time via persistent event bus (PostgreSQL event_log + pg_notify)
  - Heartbeat auto-updates agent status + publishes events every cycle
  - Pages: /, /tasks, /agents, /plex, /briefing, /brain, /memory, /calendar, /docs
  - Keyboard shortcuts: t, p, a, b, h, d, m, c
  - PostgreSQL backend: `mission_control.agents` and `mission_control.tasks`
  - **To Do Widget** (2026-05-24): Personal todos on home page - PostgreSQL `todos` table, `/api/todos` API (GET/POST/PATCH/DELETE), `TodoWidget` component with add/done/undo/delete. Morning briefing includes pending todos section.

## Core Responsibilities


- Update Mission Control status on every session start/end
- Use PostgreSQL (single source of truth) for agents/tasks
- DB: mission_control on localhost:5432

## Preferences (to be updated)
- Kevin wants progress updates on milestones
- Prefers final deliverables with summary
- Likes autonomy - give him a plan, then execute
- **Code Storage Policy**: All code I work on should be pushed to GitHub account `russelopenclaw` (NOT Kevin's wolfeinkc account)

## Infrastructure Notes


- **Plex:** server:32400, 15 libraries, 9 active users
- **Vision:** Always use qwen3.5:cloud (NOT OpenAI) for AI-generated images

## Todo
- Update MEMORY.md with more context as we work together
- Import MEMORY.md contents into mem0 for semantic search
- Set up automatic memory extraction from conversations
- **Investigate task board stagnation** (17+ days idle - since 2026-04-19)
- **Resolve exec approval block** (41+ days - config missing)

## Browser-First Protocol

→ See `docs/reference/browser-first-protocol.md`

## Semi-Persistent Agents

→ See `docs/reference/semi-persistent-agents.md`

## mem0 Integration

→ See `docs/reference/mem0-integration.md`

## GitHub Repositories

→ See `docs/reference/github-repositories.md`

## Important Notes
- Exec approval block: ongoing since Apr 1, needs Kevin action
- gog auth: token corrupted, needs `gog auth login`
- Tailscale IP fallback: 100.124.40.24
- Homebrew path: /home/linuxbrew/.linuxbrew/bin

- Kevin's personal GitHub: wolfeinkc (do NOT push code here)
- My GitHub for code: russelopenclaw (DO push all code here)
- The GITHUB_TOKEN environment variable may need refresh with `repo` scope for writing
- **Learning**: When GitHub returns HTTP 500 repeatedly, stop retrying - it's infrastructure, not auth. Retry after 30-60 min or use alternative (SSH key, GitHub UI, API file uploads).
- **Context Thrashing Cause**: Repeated `git push` timeouts (HTTP 500) → tool sessions killed → lost results → fragmented history
- **Prevention**: 
  - Stop after 2-3 failures with same error
  - Use shorter timeouts (10-15s, not 60-120s)
  - Use `sessions_spawn` for risky/long operations
  - Background + poll instead of blocking
  - Document and move to different work
- **Gateway Health** (2026-03-19): Memory monitor seeing "gateway not running" warnings - HealthMon should auto-restart before alerting Kevin
- **Optimization Backlog** (2026-03-19): 3 high-impact tasks suggested - heartbeat batching, error log cleanup, Alfred Hub WebSocket
- **MiniMax M2.7** (2026-03-20): Kevin added `minimax-m2.7:cloud` - use for Tier 2 deep analysis (SWE-Pro 56%, self-evolving, ties GPT-5.3-Codex)
- **Heartbeat Fixed** (2026-03-22): `stuckMonitor.checkStuckTasks` error resolved - refactored `stuck-task-monitor.js` to export functions for module usage. 16-day outage ended.
- **Error Logging System** (2026-03-22): Production-ready with auto-cleanup, dashboard widget, evening report process
- **Dad Joke Failure** (2026-03-23): n8n webhook returned empty audio files (joke #32), silent failure undetected. Root cause: no monitoring, no alerts, blind retries. Fix: direct ElevenLabs API, mandatory error logging, 3-attempt max, DadJ agent spawn with mem0. Lesson: automation without monitoring = silent failure.
- **Dad Joke Migration** (2026-03-24): Image generation moved from msi:7860 SD to n8n webhook. Gotcha: response field is `.images[0]` (array), not `.image`. Added mandatory image validation (Step 5a) before rendering to catch AI text artifacts. Documentation updated in TOOLS.md and PRODUCTION-RUNBOOK.md.
- **Dad Joke #28 Success** (2026-03-25): First full pipeline run with n8n image gen + validation. "How do you organize a space party? You planet." Image validation caught AI artifacts on attempt 1 (Midjourney smoothing, noisy texture), regenerated with stronger prompt, passed attempt 2. **Validation works!**
- **gog Auth Failure** (2026-03-24 through 2026-03-31): `gog sheets get` failing with auth error for 8 consecutive days. Google OAuth token expired/refresh needed. Dad joke auto-runner blocked. Joke #28 was last success ("How do you organize a space party? You planet."). **Lesson:** Automation without auth health monitoring = silent failure (echo of 2026-03-23 dad joke failure).
- **gog Auth Fixed** (2026-04-19): Morning briefing password corrected (gogkeyring-8488Carter!). Calendar API route updated. Dad joke pipeline may now be unblocked - test `gog sheets get` after exec block resolved.
- **Dad Joke Pipeline Disabled** (2026-03-31): Per Kevin's request ("it isn't current"), cron job removed. Pipeline scripts retained for future reactivation. ~10 jokes (#31-40) remain unused in Dadabase.
- **MC Big Day** (2026-04-15): Major Mission Control overhaul — Activity Timeline, auto-idle detection, deploy script with smoke tests, API health monitor, home page redesign, mobile responsive, calendar fixes (8+), TrendSpot page. 20+ commits. Kevin's priority: visibility into what Alfred is doing.
- **Deploy Script Pattern** (2026-04-15): `bash scripts/deploy.sh` — build, kill, start, smoke test, rollback. Use instead of manual process.
- **TrendSpot Enhancement** (2026-04-16): Combined Google + X trends in single feed for richer context.
- **Agents Page Deprecated** (2026-04-16): Removed /api/agents and Agents page - no longer relevant after MC redesign.
- **FiveDayView Timezone** (2026-04-16): Fixed - events now show on correct day with proper local timezone handling.
- **gog Calendar Gotcha** (2026-04-15): Must pass GOG_KEYRING_BACKEND=file + GOG_KEYRING_PASSWORD as env vars. Returns {events:[]} not raw array.
- **Kevin Mobile Preference** (2026-04-15): Was on phone all afternoon. Mobile UX matters — sticky headers, responsive grids, proper spacing.
- **Exec Allowlist Gotcha** (2026-05-02): Exec allowlist uses exact-match patterns. When DB user changed from `openclaw` to `alfred`, allowlist had to be updated explicitly. Recurring gotcha when DB credentials change.
- **Orphan Session Cleanup** (2026-05-02): Proactive cleanup prevents disk bloat. Archive pattern: `*.deleted.<timestamp>.jsonl`. Gateway doctor detects these, but don't wait for it.
- **Evening Report Cron** (2026-05-02): After OpenClaw reinstall, cron jobs need manual restoration. Check `~/.openclaw/cron/` and compare with `docs/` for expected configs.
- **Exec Approval Block** (2026-04-01 through present): Day 41+ - All exec-based automation blocked. Config missing: `~/.openclaw/config/openclaw.json`. **Impact:** 41+ days of unverified system state, no automated maintenance.
- **gog Auth Failures** (2026-05-11): 108+ consecutive failures - OAuth token expired, requires `gog auth login` (blocked by exec approval config).
- **Widget Color Scheme** (2026-04-17): Standardized all home page widgets to use consistent custom hex values (#151518 bg, #27272a border, #a1a1a1/#71717a/#52525b text) matching sidebar theme.
- **Improvement Batch #4** (2026-04-18): TrendSpot export, Plex widget enhancements, job application tracker updater, Second Brain status indicators - functional additions after visual polish phase.
- **Daily Memory Gap** (2026-04-05 to 2026-04-07): No daily memory files created. Evening report process identified gap - cron runs but doesn't auto-create daily memory. **Fix Applied 2026-04-08:** Evening report now creates daily memory file if missing. Daily memory for 2026-04-08 and 2026-04-09 created successfully.
- **Task Board Stagnation** (2026-04-19 through 2026-05-23): 0 active tasks for 29+ days. Backlog may be empty or task pull mechanism failing. Needs investigation.
- **DinnerRoulette Project** (2026-03-01): Flutter mobile app for dinner decision-making. Not a new project - appeared in git status as modified due to uncommitted changes.
- **GLM-5.1 Language Default** (2026-04-20): GLM-5.1 (Chinese LLM) defaults to Chinese without explicit instruction. All sessions must enforce English-only responses. Incident: 2 AM log rotation message appeared in Chinese via Telegram. Fixed by session-level English commitment.
- **YouTube Music Script Suite** (2026-04-20 through 2026-05-02): 11 downloader scripts created in `tools/` directory - parallel downloaders, batch processors, album/favorites/playlist downloaders, cleanup tools. Latest: `ytmusic-download-playlist.py` (May 2). Scripts feature retry logic, progress tracking, metadata embedding. **Context:** User previously concerned about CPU usage from parallel downloads.

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

## PostgreSQL Auto-Backup

→ See `docs/reference/pg-backup.md`

## Dad Joke Pipeline

→ See `docs/reference/dad-joke-pipeline.md`

## Video Transcription Process

→ See `docs/reference/video-transcription-process.md`

**Key rules:**
- Always produce 3 files: `.txt` (raw timestamped), `_READABLE.md` (formatted article), `.meta.json`
- READABLE.md must have: title header, metadata block (Creator/Source/Duration/Method), `---` separator, then `## Section` headers with clean flowing prose paragraphs
- NO raw timestamps in READABLE body, NO mid-sentence line breaks
- Merge caption fragments into real sentences, fix grammar, preserve speaker's voice
- Store in `/mnt/openclaw/workspace/transcriptions/` with `YYYY-MM-DD_Title_Underscored.{ext}` naming
- Prefer YouTube auto-captions (`--write-auto-sub`) over API transcription (free, fast, good enough)

