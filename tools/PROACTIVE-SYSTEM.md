# Proactive Agent System

This directory contains tools that make Alfred proactive instead of reactive.

## Overview

**Goal:** Alfred anticipates needs, finds work autonomously, and handles problems before Kevin notices.

## Components

### 1. Autonomous Task Pull (`autonomous-task-pull.js`)
**What:** Automatically assigns work to idle agents  
**When:** Every heartbeat (~30 min)  
**How:**
- Finds agents with `status="idle"`
- Finds their highest-priority backlog tasks with met dependencies
- Auto-spawns subagents
- Updates task status and agent status

**Result:** Continuous work flow without manual assignment

---

### 2. System Health Check (`system-health-check.js`)
**What:** Monitors infrastructure health  
**When:** Every heartbeat (~30 min)  
**Checks:**
- ✅ Ollama API reachable (192.168.1.33:11434)
- ✅ OpenClaw gateway running
- ✅ Disk space >10%
- ✅ Error patterns in `.learnings/ERRORS.md`

**Auto-fixes:**
- Gateway not running → restarts it
- Ollama unreachable → diagnoses network vs server issue

**Result:** Infrastructure issues fixed before they block work

---

### 3. Completion Verifier (`completion-verifier.js`)
**What:** Verifies subagent work actually works before marking done  
**When:** Subagent reports task complete  
**Checks:**
- Files were actually created/modified
- API endpoints respond (smoke test)
- Pages load without errors
- No obvious console errors

**Actions:**
- Verification passes → mark task done, update status
- Verification fails → respawn agent with fix instructions

**Result:** Quality control, no broken "done" tasks

---

### 4. Proactive Briefing (`proactive-briefing.js`)
**What:** Daily briefing for Kevin  
**When:** 8:00 AM America/Chicago (cron)  
**Includes:**
- 🌤️ Weather forecast
- 📅 Calendar events today
- ⏰ Due reminders
- 📊 Task progress summary
- 🤖 Active agents & their tasks
- ⚠️ Recent blockers/issues

**Evening Summary:** What shipped today

**Result:** Kevin stays informed without asking

---

### 5. Stuck Task Monitor (`stuck-task-monitor.js`)
**What:** Detects and recovers stuck subagents  
**When:** Every heartbeat (~30 min)  
**Thresholds:**
- 30 min no progress → auto-kill & respawn (retry #1)
- 1 hour no progress → auto-kill & respawn (retry #2)
- 2 hours no progress → mark blocked, reassign, log error

**Result:** No zombie "working" status, autonomous recovery

---

## Integration Points

### Heartbeat Flow
```
Every ~30 minutes:
1. Subagent status sync (move completed → recent)
2. Autonomous task pull (idle agents → spawn new work)
3. Stuck task detection (kill & respawn if stuck)
4. System health check (infrastructure OK?)
5. Completion verification (if subagents finished)
```

### Cron Jobs
```
0 8 * * * /home/kevin/.openclaw/workspace/cron/daily-briefing.sh
  → Morning briefing to Kevin (Telegram)

0 20 * * * /home/kevin/.openclaw/workspace/cron/evening-summary.sh
  → Evening summary of what shipped
```

### Subagent Completion Hook
```
When subagent reports done:
1. Call completion-verifier.js
2. If verification passes → mark task done
3. If verification fails → respawn with fixes
4. Update tasks.json and subagents.json
5. Check if more backlog work → auto-assign
```

---

## Files

| File | Purpose |
|------|---------|
| `autonomous-task-pull.js` | Auto-assign work to idle agents |
| `system-health-check.js` | Infrastructure monitoring |
| `completion-verifier.js` | Quality control on completions |
| `proactive-briefing.js` | Daily briefing generation |
| `stuck-task-monitor.js` | Stuck task detection & recovery |
| `heartbeat-stuck-hook.js` | Heartbeat integration for stuck detection |
| `cron/daily-briefing.sh` | 8 AM briefing cron job |
| `HEARTBEAT.md` | Heartbeat protocol documentation |

---

## Metrics (Tracked in `.learnings/`)

- **Task Velocity:** Tasks completed per day
- **Agent Utilization:** % time agents are working vs idle
- **Stuck Rate:** How often agents get stuck (should trend down)
- **Auto-Fix Success:** % of issues fixed without human intervention
- **Briefing Open Rate:** Does Kevin read the briefings? (future)

---

## Future Enhancements

1. **Predictive Stuck Detection** - Monitor token generation rate, detect slowing before stuck
2. **Dependency Auto-Resolution** - If task blocked, auto-prioritize dependency
3. **Pre-Fetch Context** - Read relevant files before spawning subagent
4. **Smart Retries** - Different agent/model on retry if first attempt failed
5. **Weekly Retrospective** - Every Friday: what worked, what didn't, what to improve
6. **Capacity Planning** - "At current velocity, Second Brain done by [date]"

---

## Testing

Run self-tests:
```bash
node tools/autonomous-task-pull.js
node tools/system-health-check.js
node tools/completion-verifier.js
node tools/proactive-briefing.js
node tools/stuck-task-monitor.js
```

---

## Philosophy

**Reactive:** Kevin says "do X" → Alfred does X  
**Proactive:** Alfred sees X needs doing → Alfred does X → Kevin informed

**Reactive:** Task stuck → Kevin notices → Kevin asks → Alfred fixes  
**Proactive:** Task stuck → Alfred detects → Alfred fixes → Kevin never knows

**Reactive:** System broken → Work stops → Kevin fixes  
**Proactive:** System broken → Alfred detects → Alfred fixes → Work continues

The goal: Kevin focuses on high-level direction. Alfred handles execution, problem-solving, and fire prevention.
