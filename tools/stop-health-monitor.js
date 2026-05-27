#!/usr/bin/env node
/**
 * Stop Subagent Health Monitor
 */

const fs = require('fs');
const path = require('path');

const PID_FILE = path.join(__dirname, '../.learnings/health-monitor.pid');

if (!fs.existsSync(PID_FILE)) {
  console.log('Health monitor is not running (no PID file)');
  process.exit(0);
}

const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim());
console.log(`Attempting to stop health monitor (PID: ${pid})...`);

try {
  process.kill(pid, 'SIGTERM');
  console.log('✅ Health monitor stopped');
  fs.unlinkSync(PID_FILE);
} catch (e) {
  console.log(`❌ Failed to stop process: ${e.message}`);
  console.log('The process may have already stopped. Removing stale PID file.');
  fs.unlinkSync(PID_FILE);
}
