#!/usr/bin/env node
/**
 * Send Briefing via Telegram API
 * 
 * Usage: node send-briefing.js /path/to/briefing.txt [morning|evening]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read briefing file
const briefingFile = process.argv[2];
const type = process.argv[3] || 'morning';

if (!briefingFile || !fs.existsSync(briefingFile)) {
  console.error('Usage: node send-briefing.js <briefing-file> [morning|evening]');
  process.exit(1);
}

const message = fs.readFileSync(briefingFile, 'utf8');
const WORKSPACE = '/home/kevin/.openclaw/workspace';
const BRIEFING_QUEUE = path.join(WORKSPACE, '.briefing-queue.json');
const TELEGRAM_CHAT_ID = '8177470832';

// Get bot token from OpenClaw config or environment
function getBotToken() {
  // Try environment first
  if (process.env.TELEGRAM_BOT_TOKEN) {
    return process.env.TELEGRAM_BOT_TOKEN;
  }
  
  // Try openclaw.json
  try {
    const config = JSON.parse(fs.readFileSync('/home/kevin/.openclaw/openclaw.json', 'utf8'));
    return config.channels?.telegram?.botToken;
  } catch (e) {
    return null;
  }
}

// Send directly to Telegram
function sendToTelegram(msg) {
  const botToken = getBotToken();
  if (!botToken) {
    console.error('ERROR: No Telegram bot token found');
    return false;
  }
  
  try {
    // Build JSON payload in temp file to avoid shell escaping
    const crypto = require('crypto');
    const tmpId = crypto.randomBytes(8).toString('hex');
    const payload = {
      chat_id: TELEGRAM_CHAT_ID,
      text: msg,
      parse_mode: 'Markdown'
    };
    const payloadFile = `/tmp/telegram-payload-${tmpId}.json`;
    fs.writeFileSync(payloadFile, JSON.stringify(payload));
    
    const result = execSync(
      `curl -s -X POST "https://api.telegram.org/bot${botToken}/sendMessage" ` +
      `-H "Content-Type: application/json" ` +
      `-d @${payloadFile}`,
      { encoding: 'utf8', timeout: 30000 }
    );
    
    // Cleanup
    try { fs.unlinkSync(payloadFile); } catch (e) {}
    
    const response = JSON.parse(result);
    if (!response.ok) {
      console.error(`Telegram send failed: ${response.description || 'Unknown error'}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`Failed to send to Telegram: ${e.message}`);
    return false;
  }
}

// Send the briefing
const sent = sendToTelegram(message);

// Queue the briefing (for tracking)
const queueEntry = {
  type: type,
  message: message,
  timestamp: new Date().toISOString(),
  target: `telegram:${TELEGRAM_CHAT_ID}`,
  sent: sent,
  sentAt: sent ? new Date().toISOString() : null
};

let queue = [];
if (fs.existsSync(BRIEFING_QUEUE)) {
  try {
    queue = JSON.parse(fs.readFileSync(BRIEFING_QUEUE, 'utf8'));
  } catch (e) {
    queue = [];
  }
}

queue.push(queueEntry);
fs.writeFileSync(BRIEFING_QUEUE, JSON.stringify(queue, null, 2));

if (sent) {
  console.log(`✅ ${type === 'morning' ? 'Morning briefing' : 'Evening summary'} sent to Telegram`);
} else {
  console.log(`⚠️ ${type === 'morning' ? 'Morning briefing' : 'Evening summary'} queued but not sent (check logs)`);
}
console.log(`   Target: telegram:${TELEGRAM_CHAT_ID}`);
