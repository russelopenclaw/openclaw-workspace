#!/usr/bin/env node
/**
 * Start Subagent Health Monitor
 * 
 * Launches the health monitor as a background process.
 * Automatically starts on system boot via cron (configured separately).
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const MONITOR_SCRIPT = path.join(__dirname, 'subagent-health-monitor.js');
const LOG_FILE = path.join(__dirname, '../.learnings/health-monitor-daemon.log');
const PID_FILE = path.join(__dirname, '../.learnings/health-monitor.pid');

// Check if already running
if (fs.existsSync(PID_FILE)) {
  const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim());
  try {
    process.kill(pid, 0);
    console.log(`Health monitor already running (PID: ${pid})`);
    console.log('If you need to restart, first run: node stop-health-monitor.js');
    process.exit(0);
  } catch (e) {
    // Process not running, remove stale PID file
    console.log('Removing stale PID file');
    fs.unlinkSync(PID_FILE);
  }
}

console.log('=== Starting Subagent Health Monitor ===');
console.log(`Script: ${MONITOR_SCRIPT}`);
console.log(`Log: ${LOG_FILE}`);
console.log(`PID file: ${PID_FILE}`);
console.log('');

// Spawn the monitor in background
const child = spawn('node', [MONITOR_SCRIPT], {
  detached: true,
  stdio: 'ignore',
  env: process.env
});

child.unref(); // Detach completely

// Write PID file
fs.writeFileSync(PID_FILE, child.pid.toString());
console.log(`✅ Health monitor started (PID: ${child.pid})`);
console.log('');
console.log('The monitor will:');
console.log('  - Poll active subagents every 5 minutes');
console.log('  - Track subagents in .learnings/SUBAGENT-REGISTRY.json');
console.log('  - Alert on stale or disappeared subagents');
console.log('  - Attempt auto-respawn when subagents crash mid-task');
console.log('');
console.log('To view logs: tail -f .learnings/SUBAGENT-HEALTH.log');
console.log('To stop: node tools/stop-health-monitor.js');
