#!/usr/bin/env node
/**
 * Task Completion Notification
 * Sends a Telegram notification when a task completes
 * 
 * Usage: node tools/task-notify.js <type> <message> [details]
 * 
 * type: "success" | "error" | "info"
 * message: Short message
 * details: Optional JSON details
 */

const fs = require('fs');
const { execSync } = require('child_process');

const TELEGRAM_CHAT_ID = '8177470832';

function getBotToken() {
  try {
    const config = JSON.parse(fs.readFileSync('/home/kevin/.openclaw/openclaw.json', 'utf8'));
    return config.channels?.telegram?.botToken;
  } catch (e) {
    return process.env.TELEGRAM_BOT_TOKEN;
  }
}

function sendNotification(type, message, details = null) {
  const botToken = getBotToken();
  if (!botToken) {
    console.error('No Telegram bot token found');
    process.exit(1);
  }
  
  const emoji = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️'
  }[type] || 'ℹ️';
  
  let text = `${emoji} **${type.toUpperCase()}**\n\n${message}`;
  
  if (details) {
    try {
      const parsed = typeof details === 'string' ? JSON.parse(details) : details;
      text += '\n\n```json\n' + JSON.stringify(parsed, null, 2).substring(0, 500) + '\n```';
    } catch (e) {
      text += `\n\n${details}`;
    }
  }
  
  // Build payload file
  const crypto = require('crypto');
  const tmpId = crypto.randomBytes(8).toString('hex');
  const payload = {
    chat_id: TELEGRAM_CHAT_ID,
    text: text,
    parse_mode: 'Markdown'
  };
  const payloadFile = `/tmp/telegram-task-notify-${tmpId}.json`;
  fs.writeFileSync(payloadFile, JSON.stringify(payload));
  
  try {
    const result = execSync(
      `curl -s -X POST "https://api.telegram.org/bot${botToken}/sendMessage" ` +
      `-H "Content-Type: application/json" ` +
      `-d @${payloadFile}`,
      { encoding: 'utf8', timeout: 30000 }
    );
    
    const response = JSON.parse(result);
    if (response.ok) {
      console.log(`✅ Notification sent: ${message}`);
    } else {
      console.error(`❌ Telegram error: ${response.description}`);
    }
  } finally {
    try { fs.unlinkSync(payloadFile); } catch (e) {}
  }
}

// Main
const type = process.argv[2] || 'info';
const message = process.argv[3] || 'Task notification';
const details = process.argv[4] || null;

sendNotification(type, message, details);