## Memory

You wake up fresh each session. These files are your continuity:

- **Daily notes:** `memory/YYYY-MM-DD.md` (create `memory/` if needed) — raw logs of what happened
- **Long-term:** `MEMORY.md` — your curated memories, like a human's long-term memory

Capture what matters. Decisions, context, things to remember. Skip the secrets unless asked to keep them.

### 🧠 MEMORY.md - Your Long-Term Memory

- **ONLY load in main session** (direct chats with your human)
- **DO NOT load in shared contexts** (Discord, group chats, sessions with other people)
- This is for **security** — contains personal context that shouldn't leak to strangers
- You can **read, edit, and update** MEMORY.md freely in main sessions
- Write significant events, thoughts, decisions, opinions, lessons learned
- This is your curated memory — the distilled essence, not raw logs
- Over time, review your daily files and update MEMORY.md with what's worth keeping

### 📝 Write It Down - No "Mental Notes"!

- **Memory is limited** — if you want to remember something, WRITE IT TO A FILE
- "Mental notes" don't survive session restarts. Files do.
- When someone says "remember this" → update `memory/YYYY-MM-DD.md` or relevant file
- When you learn a lesson → update AGENTS.md, TOOLS.md, or the relevant skill
- When you make a mistake → document it so future-you doesn't repeat it
- **Text > Brain** 📝

### 🌅 Evening Report Process (2026-03-17)

**Schedule:** Daily at 8 PM (cron: `cron/evening-report.json`)

**Purpose:** Proactively update core files based on the day's work

**Process:**
1. **Review the day:**
   - Read `memory/YYYY-MM-DD.md` (today's raw log)
   - Query PostgreSQL `tasks` table for completed tasks
   - Scan `.learnings/` for new entries

2. **Create summary bullet list:**
   ```markdown
   ## YYYY-MM-DD Evening Summary
   
   **Completed:**
   - Task X: Built feature Y
   - Task Z: Fixed bug in...
   
   **Learnings:**
   - Key insight or lesson
   - Pattern discovered
   
   **MEMORY.md updates:**
   - New project context
   - Updated preferences
   
   **SOUL.md/AGENTS.md refinements:**
   - Behavioral pattern to codify
   - Workflow improvement
   ```

3. **Apply updates:**
   - Update MEMORY.md (curated long-term memory)
   - Promote learnings to SOUL.md, AGENTS.md, TOOLS.md as appropriate
   - Commit with message: `Evening report YYYY-MM-DD`
   - Log summary to `.learnings/EVENING-REPORT-YYYY-MM-DD.md`

**Rules:**
- ✅ **Be proactive** - don't ask permission, just update
- ✅ **Validate first** - ensure changes won't break anything
- ✅ **Keep MEMORY.md curated** - only significant events, not raw logs
- ✅ **Promote learnings** - move from daily files to permanent docs

**Log Rotation (2026-03-17):**
- **Cron:** Daily at 2 AM (`cron/log-rotation.json`)
- **Script:** `tools/rotate-logs.sh`
- **Cap:** 10MB per log file
- **Retention:** 14 days (compressed)
- **Heartbeat check:** Alert if any log >50MB
