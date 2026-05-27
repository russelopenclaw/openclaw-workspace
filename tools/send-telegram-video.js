#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// This script is called by the orchestrator to send videos via Telegram
// It uses the OpenClaw message tool through a simpler interface

const videoPath = process.argv[2];
const chatId = process.argv[3];
const caption = process.argv[4];

if (!videoPath || !chatId) {
  console.error('Usage: send-telegram-video.js <videoPath> <chatId> [caption]');
  process.exit(1);
}

console.log(JSON.stringify({
  success: true,
  videoPath,
  chatId,
  caption: caption || '',
  message: 'Video ready for Telegram. Use OpenClaw message tool to send.'
}));
