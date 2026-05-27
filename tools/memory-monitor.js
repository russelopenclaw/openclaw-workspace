#!/usr/bin/env node
/**
 * Memory Monitor for OpenClaw Gateway
 * 
 * Monitors gateway process memory usage and:
 * - Logs usage every 30 seconds
 * - Warns at 700MB sustained for 5 minutes
 * - Auto-restarts at 900MB (before OOM killer)
 * - Sends Telegram alerts on critical thresholds
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE = process.env.HOME + '/.openclaw/workspace';
const LOG_FILE = path.join(WORKSPACE, '.learnings/MEMORY-MONITOR.log');
const STATE_FILE = path.join(WORKSPACE, '.learnings/memory-monitor-state.json');

const THRESHOLDS = {
  WARNING_MB: 700,
  CRITICAL_MB: 900,
  SUSTAINED_WARNING_MINUTES: 5,
  CHECK_INTERVAL_MS: 30000
};

// State tracking
let state = {
  warningStart: null,
  lastRestart: null,
  restartCount24h: 0,
  peakMB: 0
};

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) {
    log('WARN', 'Failed to load state, using defaults');
  }
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    log('ERROR', 'Failed to save state: ' + e.message);
  }
}

function log(level, message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}`;
  console.log(line);
  
  // Append to log file
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (e) {
    console.error('Failed to write to log file:', e.message);
  }
}

function getGatewayPID() {
  try {
    const output = execSync(
      'systemctl --user show openclaw-gateway.service --value MainPID',
      { encoding: 'utf8', timeout: 5000 }
    ).trim();
    return output ? parseInt(output) : null;
  } catch (e) {
    log('ERROR', 'Failed to get gateway PID: ' + e.message);
    return null;
  }
}

function getGatewayMemoryMB(pid) {
  try {
    const output = execSync(`ps -o rss= -p ${pid}`, {
      encoding: 'utf8',
      timeout: 5000
    }).trim();
    
    if (!output) return null;
    return Math.floor(parseInt(output) / 1024); // Convert KB to MB
  } catch (e) {
    return null;
  }
}

function sendTelegramAlert(message) {
  log('INFO', 'Sending Telegram alert: ' + message);
  // Would use message tool in actual implementation
  // For now, just log
}

function restartGateway() {
  log('WARN', 'Initiating graceful gateway restart due to high memory...');
  
  try {
    execSync('systemctl --user restart openclaw-gateway.service', {
      timeout: 30000
    });
    
    state.lastRestart = Date.now();
    state.restartCount24h++;
    log('INFO', 'Gateway restarted successfully');
    saveState();
  } catch (e) {
    log('ERROR', 'Failed to restart gateway: ' + e.message);
  }
}

function checkAndAlert(memMB) {
  const now = Date.now();
  
  // Track peak
  if (memMB > state.peakMB) {
    state.peakMB = memMB;
    saveState();
  }
  
  // Critical threshold - immediate restart
  if (memMB >= THRESHOLDS.CRITICAL_MB) {
    log('CRITICAL', `Memory at ${memMB}MB (threshold: ${THRESHOLDS.CRITICAL_MB}MB) - RESTARTING`);
    sendTelegramAlert(`🔴 Gateway memory critical: ${memMB}MB - auto-restarting`);
    restartGateway();
    state.warningStart = null;
    return;
  }
  
  // Warning threshold - track sustained
  if (memMB >= THRESHOLDS.WARNING_MB) {
    if (!state.warningStart) {
      state.warningStart = now;
      log('WARN', `Memory entered warning zone: ${memMB}MB`);
    }
    
    const warningDuration = (now - state.warningStart) / 1000 / 60; // minutes
    
    if (warningDuration >= THRESHOLDS.SUSTAINED_WARNING_MINUTES) {
      log('ALERT', `Memory sustained at ${memMB}MB for ${warningDuration.toFixed(1)} minutes`);
      sendTelegramAlert(`⚠️ Gateway memory warning: ${memMB}MB for ${warningDuration.toFixed(0)}m`);
    }
  } else {
    // Below warning - reset
    if (state.warningStart) {
      const duration = (now - state.warningStart) / 1000 / 60;
      log('INFO', `Memory returned to normal after ${duration.toFixed(1)} minutes in warning zone`);
      state.warningStart = null;
    }
  }
  
  saveState();
}

function resetDailyRestartCount() {
  const now = Date.now();
  const lastRestartDate = state.lastRestart ? new Date(state.lastRestart).toDateString() : null;
  const today = new Date().toDateString();
  
  if (lastRestartDate !== today) {
    state.restartCount24h = 0;
    log('INFO', 'Reset daily restart count');
    saveState();
  }
}

function printStatus() {
  const pid = getGatewayPID();
  if (!pid) {
    log('WARN', 'Gateway not running');
    return;
  }
  
  const memMB = getGatewayMemoryMB(pid);
  if (!memMB) {
    log('WARN', 'Could not determine memory usage');
    return;
  }
  
  const status = {
    pid,
    memoryMB: memMB,
    peakMB: state.peakMB,
    warningActive: state.warningStart !== null,
    restartsToday: state.restartCount24h,
    lastRestart: state.lastRestart ? new Date(state.lastRestart).toISOString() : 'never'
  };
  
  log('INFO', `Status: PID=${pid}, Memory=${memMB}MB, Peak=${state.peakMB}MB, RestartsToday=${state.restartCount24h}`);
  
  return status;
}

// Main loop
function main() {
  log('INFO', 'Memory monitor starting...');
  loadState();
  
  // Print initial status
  printStatus();
  
  // Reset daily counter
  resetDailyRestartCount();
  
  // Main monitoring loop
  setInterval(() => {
    resetDailyRestartCount();
    
    const pid = getGatewayPID();
    if (!pid) {
      log('WARN', 'Gateway not running, skipping check');
      return;
    }
    
    const memMB = getGatewayMemoryMB(pid);
    if (!memMB) {
      log('WARN', 'Failed to get memory reading');
      return;
    }
    
    log('DEBUG', `Memory check: ${memMB}MB`);
    checkAndAlert(memMB);
  }, THRESHOLDS.CHECK_INTERVAL_MS);
  
  log('INFO', `Monitoring every ${THRESHOLDS.CHECK_INTERVAL_MS/1000}s | Warning: ${THRESHOLDS.WARNING_MB}MB | Critical: ${THRESHOLDS.CRITICAL_MB}MB`);
}

// Handle command line args
if (process.argv.includes('--status')) {
  printStatus();
  process.exit(0);
}

if (process.argv.includes('--reset')) {
  state = { warningStart: null, lastRestart: null, restartCount24h: 0, peakMB: 0 };
  saveState();
  log('INFO', 'State reset');
  process.exit(0);
}

main();
