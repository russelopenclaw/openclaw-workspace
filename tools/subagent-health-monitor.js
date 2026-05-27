#!/usr/bin/env node
/**
 * Subagent Health Monitor
 * 
 * Features:
 * - Polls active subagents every 5 minutes via subagents tool
 * - Tracks expected subagents in registry
 * - Auto-respawns subagents that disappear mid-task
 * - Alerts when manual intervention is needed
 * - Maintains audit trail in log file
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const MONITOR_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const STALE_THRESHOLD_MIN = 15; // Alert if no update in 15 min (stricter)
const LOG_FILE = path.join(__dirname, '../.learnings/SUBAGENT-HEALTH.log');
const REGISTRY_FILE = path.join(__dirname, '../.learnings/SUBAGENT-REGISTRY.json');

// Track subagents we're monitoring
let expectedSubagents = new Map(); // sessionId -> { task, spawnedAt, lastSeen }
const alertedSubagents = new Set();

function log(message, level = 'info') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line);
}

function loadRegistry() {
  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      const data = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
      expectedSubagents = new Map(Object.entries(data));
      log(`Loaded registry: ${expectedSubagents.size} tracked subagent(s)`);
    }
  } catch (error) {
    log(`Failed to load registry: ${error.message}`, 'warn');
  }
}

function saveRegistry() {
  try {
    const data = Object.fromEntries(expectedSubagents);
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    log(`Failed to save registry: ${error.message}`, 'error');
  }
}

function registerSubagent(sessionKey, task, label) {
  expectedSubagents.set(sessionKey, {
    task: task.substring(0, 200), // Truncate for storage
    label,
    spawnedAt: Date.now(),
    lastSeen: Date.now(),
    status: 'running'
  });
  saveRegistry();
  log(`📝 Registered subagent: ${label || 'Untitled'} (${sessionKey})`);
}

function unregisterSubagent(sessionKey, reason = 'completed') {
  const sub = expectedSubagents.get(sessionKey);
  if (sub) {
    log(`✅ Unregistered subagent: ${sub.label || 'Untitled'} (${reason})`);
    expectedSubagents.delete(sessionKey);
    alertedSubagents.delete(sessionKey);
    saveRegistry();
  }
}

async function getActiveSubagents() {
  try {
    // Use openclaw sessions to get active sessions
    const output = execSync('openclaw sessions --active 120 --json', {
      encoding: 'utf8'
    });
    const data = JSON.parse(output);
    
    // Filter for subagent sessions
    return (data.sessions || []).filter(s => 
      s.key && s.key.includes('subagent')
    );
  } catch (error) {
    log(`Failed to get active subagents: ${error.message}`, 'error');
    return [];
  }
}

async function respawnSubagent(task, label) {
  log(`🔄 Attempting to respawn subagent: ${label}`, 'warn');
  
  try {
    // Use the subagents tool to spawn a new subagent
    // This assumes the monitoring script is running with proper permissions
    const taskText = task || 'Monitor and complete the original task';
    const respawnLabel = `${label || 'Respawned'} (respawned)`;
    
    // Method 1: Try openclaw subagents spawn command
    try {
      const cmd = `openclaw subagents spawn --task "${taskText.replace(/"/g, '\\"')}" --label "${respawnLabel.replace(/"/g, '\\"')}"`;
      log(`   Spawning: ${cmd}`);
      const output = execSync(cmd, { encoding: 'utf8', timeout: 10000 });
      log(`   ✅ Respawn successful: ${output.trim()}`, 'info');
      return true;
    } catch (cmdError) {
      // Method 2: If command fails, write to respawns queue for main agent to process
      log(`   Command spawn failed: ${cmdError.message}`, 'warn');
      log(`   Writing respawn request to queue...`);
      
      const respawnQueue = path.join(__dirname, '../.learnings/SUBAGENT-RESPAWN-QUEUE.json');
      let queue = [];
      if (fs.existsSync(respawnQueue)) {
        queue = JSON.parse(fs.readFileSync(respawnQueue, 'utf8'));
      }
      
      queue.push({
        task: taskText,
        label: respawnLabel,
        originalSessionId: label, // Best effort
        requestedAt: Date.now(),
        attempts: 1
      });
      
      fs.writeFileSync(respawnQueue, JSON.stringify(queue, null, 2));
      log(`   ✅ Queued respawn request (main agent will process)`);
      return true; // Technically we handled it, even if deferred
    }
  } catch (error) {
    log(`   ❌ Respawn failed: ${error.message}`, 'error');
    log(`   Manual intervention required`);
    return false;
  }
}

async function sendAlert(message, level = 'warn') {
  log(message, level);
  // Future: Integrate with notification system (email, Slack, etc.)
  // For now, just log it prominently
}

async function checkAndAlert() {
  const activeSubagents = await getActiveSubagents();
  const activeKeys = new Set();
  
  log(`🔍 Monitoring: ${activeSubagents.length} active subagent(s), ${expectedSubagents.size} expected`);
  
  // Update lastSeen for active subagents
  for (const sub of activeSubagents) {
    const sessionKey = sub.key; // Use session key as primary identifier
    activeKeys.add(sessionKey);
    
    // Update registry
    if (expectedSubagents.has(sessionKey)) {
      const entry = expectedSubagents.get(sessionKey);
      entry.lastSeen = Date.now();
      entry.status = sub.status || 'running';
    } else {
      // Discovered a subagent we weren't tracking - add it
      registerSubagent(sessionKey, sub.task || 'Unknown task', sub.label || 'Unknown');
    }
    
    // Check for stale subagents
    const updatedAt = sub.updatedAt ? new Date(sub.updatedAt).getTime() : sub.startedAt;
    const minutesSinceUpdate = (Date.now() - updatedAt) / 1000 / 60;
    
    if (minutesSinceUpdate > STALE_THRESHOLD_MIN) {
      if (!alertedSubagents.has(sessionKey)) {
        await sendAlert(`⚠️  STALE SUBAGENT: ${sub.label || sessionKey}`, 'warn');
        await sendAlert(`   Session: ${sessionKey}`);
        await sendAlert(`   Last updated: ${Math.round(minutesSinceUpdate)} min ago`);
        await sendAlert(`   Status: ${sub.status || 'unknown'}`);
        await sendAlert(`   
   This subagent may have failed silently. Check its task completion status.`);
        
        alertedSubagents.add(sessionKey);
      }
    } else {
      // Recovered
      if (alertedSubagents.has(sessionKey)) {
        log(`✅ Subagent recovered: ${sub.label || sessionKey}`, 'info');
        alertedSubagents.delete(sessionKey);
      }
    }
  }
  
  // Check for disappeared subagents (expected but not active)
  for (const [sessionKey, sub] of expectedSubagents.entries()) {
    if (!activeKeys.has(sessionKey)) {
      const minutesRunning = (Date.now() - sub.spawnedAt) / 1000 / 60;
      
      // Only alert if it was running for less than 2 minutes (likely crashed)
      // or if it was marked as stale before disappearing
      if (minutesRunning < 2 || alertedSubagents.has(sessionKey)) {
        await sendAlert(`💀 SUBAGENT DISAPPEARED: ${sub.label || sessionKey}`, 'error');
        await sendAlert(`   Task: ${sub.task}`);
        await sendAlert(`   Was running for: ${Math.round(minutesRunning)} min`);
        await sendAlert(`   Spawned: ${new Date(sub.spawnedAt).toISOString()}`);
        await sendAlert(`   
   ⚠️  AUTO-RESPAWN NEEDED: This subagent crashed mid-task.
   Manual respawn required (via queue or command).`);
        
        // Try to respawn
        const respawned = await respawnSubagent(sub.task, sub.label);
        if (!respawned) {
          await sendAlert(`   ❌ Respawn failed - check respawn queue`, 'error');
        }
        
        // Remove from expected since it's gone
        unregisterSubagent(sessionKey, 'disappeared');
      } else {
        // Probably completed normally
        log(`ℹ️  Subagent completed: ${sub.label || sessionKey} (ran for ${Math.round(minutesRunning)} min)`, 'info');
        unregisterSubagent(sessionKey, 'completed');
      }
    }
  }
  
  // Summary
  const staleCount = [...alertedSubagents].length;
  const expectedCount = expectedSubagents.size;
  const activeCount = activeSubagents.length;
  
  if (staleCount > 0 || expectedCount !== activeCount) {
    await sendAlert(`📊 Health Check: ${activeCount}/${expectedCount} active, ${staleCount} stale/alerted`, 'warn');
  } else {
    log(`📊 Health Check: All ${activeCount} subagent(s) healthy`, 'info');
  }
  
  saveRegistry();
}

// Main loop
log('=== Subagent Health Monitor Started ===');
log(`Monitoring interval: ${MONITOR_INTERVAL_MS/60000} min`);
log(`Stale threshold: ${STALE_THRESHOLD_MIN} min`);
log(`Log file: ${LOG_FILE}`);
log(`Registry file: ${REGISTRY_FILE}`);
log('');

// Load existing registry
loadRegistry();

// Initial check
checkAndAlert();

// Periodic monitoring
const timer = setInterval(() => {
  checkAndAlert();
}, MONITOR_INTERVAL_MS);

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('Health Monitor shutting down...', 'info');
  clearInterval(timer);
  saveRegistry();
  process.exit(0);
});

// Export for programmatic use
module.exports = {
  registerSubagent,
  unregisterSubagent,
  checkAndAlert,
  getActiveSubagents
};
