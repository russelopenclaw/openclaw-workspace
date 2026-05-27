# Cron Job Installation

## Quick Install

Run these commands to install all cron jobs:

```bash
cd /home/kevin/.openclaw/workspace/cron

# Create combined crontab
cat > /tmp/openclaw-cron << 'EOF'
# OpenClaw Proactive System Cron Jobs
# Timezone: America/Chicago

# Daily Briefing - 8:00 AM
0 8 * * * /home/kevin/.openclaw/workspace/cron/daily-briefing.sh

# Evening Summary - 8:00 PM  
0 20 * * * /home/kevin/.openclaw/workspace/cron/evening-summary.sh

# Heartbeat Check - Every 30 minutes
*/30 * * * * cd /home/kevin/.openclaw/workspace && node tools/heartbeat-integration.js >> /var/log/openclaw-heartbeat.log 2>&1
EOF

# Install crontab
crontab /tmp/openclaw-cron

# Verify installation
crontab -l

# Clean up
rm /tmp/openclaw-cron
```

---

## Manual Installation

### 1. Edit Crontab

```bash
crontab -e
```

Add these lines:

```cron
# OpenClaw Proactive System

# Daily Briefing - 8:00 AM Chicago time
0 8 * * * /home/kevin/.openclaw/workspace/cron/daily-briefing.sh

# Evening Summary - 8:00 PM Chicago time
0 20 * * * /home/kevin/.openclaw/workspace/cron/evening-summary.sh

# Heartbeat - Every 30 minutes
*/30 * * * * cd /home/kevin/.openclaw/workspace && node tools/heartbeat-integration.js >> /var/log/openclaw-heartbeat.log 2>&1
```

### 2. Save and Exit

### 3. Verify

```bash
crontab -l
```

You should see all 3 jobs listed.

---

## Verify Cron Service

```bash
# Check if cron is running
systemctl status cron

# Start if needed
sudo systemctl start cron
sudo systemctl enable cron
```

---

## Test Cron Jobs Manually

### Test Daily Briefing

```bash
/home/kevin/.openclaw/workspace/cron/daily-briefing.sh
```

Expected: Outputs briefing to stdout

### Test Evening Summary

```bash
/home/kevin/.openclaw/workspace/cron/evening-summary.sh
```

Expected: Outputs summary to stdout

### Test Heartbeat

```bash
cd /home/kevin/.openclaw/workspace && node tools/heartbeat-integration.js
```

Expected: Runs all proactive checks, logs to `.learnings/HEARTBEAT.md`

---

## Monitor Cron Execution

```bash
# View cron log
grep CRON /var/log/syslog | tail -20

# View heartbeat log
tail -f /var/log/openclaw-heartbeat.log

# View learnings log
tail -f /home/kevin/.openclaw/workspace/.learnings/HEARTBEAT.md
```

---

## Troubleshooting

### Jobs Not Running?

1. Check cron service:
   ```bash
   systemctl status cron
   ```

2. Check cron logs:
   ```bash
   grep CRON /var/log/syslog | tail -50
   ```

3. Verify crontab syntax:
   ```bash
   crontab -l
   ```

4. Test script manually first

### Permission Issues?

```bash
# Make scripts executable
chmod +x /home/kevin/.openclaw/workspace/cron/*.sh

# Check ownership
ls -la /home/kevin/.openclaw/workspace/cron/
```

### Timezone Issues?

Cron uses system timezone. Verify:

```bash
timedatectl
```

Should show: `Time zone: America/Chicago`

---

## Uninstall

```bash
# Remove all cron jobs
crontab -r

# Or edit and remove specific lines
crontab -e
```

---

## Current Status

- [x] daily-briefing.sh created ✅
- [x] evening-summary.sh created ✅
- [x] heartbeat-integration.js created ✅
- [ ] Cron jobs installed ⏳
- [ ] Cron jobs tested ⏳
- [ ] Logs verified ⏳

**Next step:** Install cron jobs with the commands above
