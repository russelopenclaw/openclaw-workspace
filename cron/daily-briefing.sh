#!/bin/bash
# Daily Briefing Cron Job
# Runs at 8:00 AM America/Chicago
# Sends to: wolfeinkc@proton.me (email) + Telegram queue

cd /home/kevin/.openclaw/workspace

# Generate briefing
node -e "
const briefing = require('./tools/proactive-briefing.js');
(async () => {
  const result = await briefing.generateBriefing();
  console.log(result.briefing);
})()
" > /tmp/briefing-$$.txt 2>&1

if [ -f /tmp/briefing-$$.txt ]; then
  # Send via email using gog (Gmail/Google Workspace)
  gog gmail send \
    --to "wolfeinkc@proton.me" \
    --subject "🌅 Morning Briefing - $(date +'%A, %B %d, %Y')" \
    --body-file /tmp/briefing-$$.txt
  
  # Also queue for Telegram (backup/faster delivery)
  node /home/kevin/.openclaw/workspace/cron/send-briefing.js /tmp/briefing-$$.txt "morning"
  
  rm /tmp/briefing-$$.txt
fi
