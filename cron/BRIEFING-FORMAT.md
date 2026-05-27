# Briefing Format & Delivery

## 📬 Delivery Methods

### Email (Primary)
- **To:** wolfeinkc@proton.me
- **From:** Gmail/Google Workspace (via `gog gmail send`)
- **Morning:** 8:00 AM America/Chicago
- **Evening:** 8:00 PM America/Chicago

### Telegram (Backup)
- Queued in `.briefing-queue.json`
- Sent via OpenClaw `message` tool within 30 minutes
- Same content as email

---

## 🌅 Morning Briefing Format

```
Good morning, Kevin. Here's your briefing for [Day], [Date]:

🌤️ **Weather**: [Forecast from wttr.in]

📅 **Calendar** ([N] events):
  - [Event 1 title] ([time])
  - [Event 2 title] ([time])

⏰ **Due Reminders**:
  - [Reminder 1]
  - [Reminder 2]

📊 **Tasks**: [X/Y] tasks done ([Z]%), [N] in progress

🤖 **Active Agents**:
  - **alfred**: [current task]
  - **jeeves**: [current task]

💡 **Proactive Suggestions** (3-5 high-impact tasks):

1. **🎯 Quick Win**: [Task title]
   [Brief description]
   Impact: [Why this matters]
   Effort: [Time estimate]

2. **⚠️ Unstick Progress**: [Task title]
   [Description of stuck task]
   Impact: [Why unblocking matters]
   Effort: [Time to fix]

3. **🤖 System Improvement**: [Task title]
   [Automation enhancement idea]
   Impact: [How it helps]
   Effort: [Implementation time]

4. **✅ Quality Assurance**: [Task title]
   [Testing/documentation need]
   Impact: [Risk mitigation]
   Effort: [Testing time]

*Reply with task number(s) and I'll start immediately.*

⚠️ **Recent Issues** (if any):
  - [Error/blocker 1]
  - [Error/blocker 2]

---
*I'll check in again this evening with a progress summary.*
```

---

## 🌆 Evening Summary Format

```
Good evening, Kevin. Here's what shipped today:

✅ **[Task 1 title]**
✅ **[Task 2 title]**
✅ **[Task 3 title]**
✅ **[Task 4 title]**

Overall progress: [X/Y] tasks done ([Z]%), [N] in progress

---
*Rest well. I'll have your morning briefing ready at 8 AM.*
```

---

## 🧠 Proactive Suggestions Logic

The system analyzes your workspace and generates 3-5 tailored suggestions:

### Pattern Detection:
1. **High-priority backlog** → "Complete these blocking tasks"
2. **Stuck in-progress** → "Unstick tasks running >1 day"
3. **System gaps** → "Improve automation/testing/docs"
4. **Quality gaps** → "Test completed features"
5. **Knowledge debt** → "Document architecture"

### Suggestion Quality:
- **Actionable**: Specific task titles from backlog
- **Quantified**: Impact and effort estimates
- **Prioritized**: High-impact items first
- **Interactive**: "Reply with number to start"

---

## 📊 Example Morning Briefing

```
Good morning, Kevin. Here's your briefing for Wednesday, March 4, 2026:

🌤️ **Weather**: Partly cloudy +38°F

📅 **Calendar** (2 events):
  - Team standup (10:00 AM)
  - Dentist appointment (3:30 PM)

⏰ **Due Reminders**:
  - Call Kevin at 3pm
  - Send weekly status report

📊 **Tasks**: 23/27 tasks done (85%), 1 in progress

🤖 **Active Agents**:
  - **alfred**: E2E testing - Testing all Second Brain commands
  - **jeeves**: Recurring events - Implementing recurrence patterns

💡 **Proactive Suggestions** (4 high-impact tasks):

1. **🎯 Quick Win**: Complete high-priority backlog (1 task)
   Start with: "Second Brain: Heartbeat monitoring"
   Impact: Finishes Second Brain system, 100% completion
   Effort: 1 hour

2. **⚠️ Unstick Progress**: Review 1 task in progress >1 day
   Longest: "Recurring events" (26h)
   Impact: Reset agent if stuck, maintain velocity
   Effort: 15 minutes

3. **✅ Quality Assurance**: Add E2E tests for 21 completed features
   Ensure completed work functions in production
   Impact: Prevent regressions, increase confidence
   Effort: 2 hours

4. **📚 Knowledge Management**: Document system architecture
   Create comprehensive docs for maintenance
   Impact: Reduce onboarding, preserve knowledge
   Effort: 3 hours

*Reply with task number(s) and I'll start immediately.*

---
*I'll check in again this evening with a progress summary.*
```

---

## 🔧 Cron Configuration

Installed crontab entries:

```cron
# Morning briefing - 8:00 AM
0 8 * * * /home/kevin/.openclaw/workspace/cron/daily-briefing.sh

# Evening summary - 8:00 PM
0 20 * * * /home/kevin/.openclaw/workspace/cron/evening-summary.sh

# Heartbeat - Every 30 minutes
*/30 * * * * cd /home/kevin/.openclaw/workspace && node tools/heartbeat-integration.js
```

---

## 🛠️ Troubleshooting

### Email not sending?
```bash
# Test gog CLI
gog gmail send --to wolfeinkc@proton.me --subject "Test" --body "Test message"

# Check gog auth
gog auth list
```

### Telegram not sending?
- Check `.briefing-queue.json` for pending messages
- Main session heartbeat will send within 30 minutes
- Verify OpenClaw `message` tool is configured

### Cron not running?
```bash
# Check cron service
systemctl status cron

# View cron logs
grep CRON /var/log/syslog | tail -20

# Test script manually
/home/kevin/.openclaw/workspace/cron/daily-briefing.sh
```

---

## 📈 Future Enhancements

Potential additions to briefings:

- **Weekly trend graphs** (tasks completed over time)
- **Agent performance metrics** (avg task time, success rate)
- **Calendar insights** (busiest days, free time blocks)
- **Second Brain stats** (items saved, top tags, review needed)
- **System health dashboard** (uptime, errors, resource usage)
- **Predictive ETA** (when current projects will complete)

Add these by updating `generateBriefing()` in `tools/proactive-briefing.js`.
