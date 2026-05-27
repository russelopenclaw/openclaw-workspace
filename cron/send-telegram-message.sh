#!/bin/bash
# Send Telegram Message via OpenClaw
# Usage: send-telegram-message.sh "Your message here"
#    or: send-telegram-message.sh --file /path/to/message.txt

TELEGRAM_CHAT_ID="telegram:8177470832"

# Check if message comes from file or argument
if [ "$1" = "--file" ] && [ -f "$2" ]; then
  MESSAGE=$(cat "$2")
elif [ -n "$1" ]; then
  MESSAGE="$1"
else
  echo "Usage: $0 [--file filename] or $0 'message text'"
  exit 1
fi

# Use OpenClaw message tool via node
# This assumes OpenClaw has a CLI or we can call the message plugin
cd /home/kevin/.openclaw

# Option 1: Try OpenClaw CLI if available
if command -v openclaw &> /dev/null; then
  openclaw message send --channel telegram --target "$TELEGRAM_CHAT_ID" --message "$MESSAGE"
  exit $?
fi

# Option 2: Use node to call OpenClaw's message plugin directly
node -e "
const OpenClaw = require('openclaw');
const client = new OpenClaw();
client.message.send({
  channel: 'telegram',
  target: '$TELEGRAM_CHAT_ID',
  message: \`$MESSAGE\`
}).catch(err => {
  console.error('Failed to send:', err.message);
  process.exit(1);
});
" 2>/dev/null

if [ $? -eq 0 ]; then
  exit 0
fi

# Option 3: Fallback - just output message (for testing/debugging)
echo "⚠️  OpenClaw CLI not available. Message would be sent to $TELEGRAM_CHAT_ID:"
echo "$MESSAGE"
exit 1
