#!/bin/bash
# Evening Summary Cron Job
# Runs at 8:00 PM America/Chicago
# Sends to: Telegram

cd /home/kevin/.openclaw/workspace

# Run via send-briefing.js which handles Telegram delivery
node /home/kevin/.openclaw/workspace/cron/send-briefing.js /tmp/evening-summary-$$ "evening" < <(
  node -e "
    const briefing = require('./tools/proactive-briefing.js');
    (async () => {
      const result = await briefing.generateEveningSummary();
      console.log(result.summary);
    })()
  "
)
