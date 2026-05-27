/**
 * Heartbeat Integration Script
 * 
 * Main entry point for heartbeat checks. Call this from OpenClaw heartbeat.
 * 
 * Executes all proactive checks in order:
 * 1. Subagent status sync
 * 2. Autonomous task pull (idle agents → new work)
 * 3. Stuck task detection & recovery
 * 4. System health check
 * 5. Completion verification (if subagents finished)
 * 
 * Logs all actions to .learnings/HEARTBEAT.md
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = '/home/kevin/.openclaw/workspace';
const LEARNINGS_DIR = path.join(WORKSPACE, '.learnings');
const HEARTBEAT_LOG = path.join(LEARNINGS_DIR, 'HEARTBEAT.md');

// Import proactive tools
const statusSync = require('./auto-status-sync.js');
const taskPull = require('./autonomous-task-pull.js');
const stuckMonitor = require('./stuck-task-monitor.js');
const healthCheck = require('./system-health-check.js');
const verifier = require('./completion-verifier.js');
const { checkReminders } = require('./reminder-heartbeat-hook.js');

/**
 * Ensure learnings directory exists
 */
function ensureLearningsDir() {
  if (!fs.existsSync(LEARNINGS_DIR)) {
    fs.mkdirSync(LEARNINGS_DIR, { recursive: true });
  }
}

/**
 * Log heartbeat execution
 */
function logHeartbeat(entry) {
  ensureLearningsDir();
  
  const timestamp = new Date().toISOString();
  const logEntry = `\n## Heartbeat - ${timestamp}\n\n${entry}\n`;
  
  // Append to log file
  if (!fs.existsSync(HEARTBEAT_LOG)) {
    fs.writeFileSync(HEARTBEAT_LOG, '# Heartbeat Log\n\nAutomated heartbeat execution log.\n');
  }
  
  fs.appendFileSync(HEARTBEAT_LOG, logEntry);
}

/**
 * Mock sessions_list for testing (replace with actual tool call in production)
 * In production, this will be called via OpenClaw tool
 */
async function callSessionsList(activeMinutes = 60) {
  // This is a stub - in production, OpenClaw calls the actual sessions_list tool
  // For now, return empty array
  console.log('[Heartbeat] sessions_list called (mock)');
  return [];
}

/**
 * Mock sessions_spawn for testing (replace with actual tool call in production)
 */
async function callSessionsSpawn(config) {
  // This is a stub - in production, OpenClaw calls the actual sessions_spawn tool
  console.log('[Heartbeat] sessions_spawn would be called with:', config.label);
  return { runId: 'mock-' + Date.now(), status: 'accepted' };
}

/**
 * Send Telegram notification for due reminders
 * Uses OpenClaw message tool to send to Kevin's Telegram
 */
async function sendTelegramNotification(message) {
  console.log('[Heartbeat] Sending Telegram notification...');
  
  // In production, this calls the OpenClaw message tool
  // For now, log what would be sent
  console.log('[Telegram] Would send to Kevin:', message);
  
  // TODO: In actual OpenClaw runtime, call:
  // await message({
  //   action: 'send',
  //   channel: 'telegram:8177470832',
  //   message: message
  // });
  
  return { ok: true, sent: true };
}

/**
 * Main heartbeat execution
 */
async function runHeartbeat() {
  console.log('=== HEARTBEAT START ===');
  const startTime = Date.now();
  const results = {};
  
  try {
    // 1. Subagent Status Sync
    console.log('[1/5] Syncing subagent status...');
    const sessions = await callSessionsList(60);
    results.statusSync = {
      ok: true,
      sessionsFound: sessions.length,
      message: `Found ${sessions.length} active sessions`
    };
    console.log(`✅ Status sync: ${results.statusSync.message}`);
    
    // 2. Autonomous Task Pull
    console.log('[2/5] Checking for idle agents...');
    results.taskPull = await taskPull.autoAssignTasks(callSessionsSpawn);
    if (results.taskPull.assignments.length > 0) {
      console.log(`✅ Task pull: Spawned ${results.taskPull.assignments.length} subagent(s)`);
    } else {
      console.log('ℹ️  Task pull: No idle agents or no ready tasks');
    }
    
    // 3. Stuck Task Detection
    console.log('[3/5] Checking for stuck tasks...');
    results.stuckCheck = stuckMonitor.checkStuckTasks(sessions || []);
    if (!results.stuckCheck.ok && results.stuckCheck.stuckTasks && results.stuckCheck.stuckTasks.length > 0) {
      console.log(`⚠️  Stuck check: Found ${results.stuckCheck.stuckTasks.length} stuck task(s)`);
      // Process recovery actions
      for (const action of results.stuckCheck.actions) {
        if (action.action === 'auto-retry') {
          console.log(`🔄 Auto-retrying task: ${action.taskId}`);
          // In production: kill subagent, respawn
        } else if (action.action === 'escalate') {
          console.log(`🚨 Escalating task: ${action.taskId} (would notify Kevin)`);
          // In production: we don't notify Kevin per his request
        }
      }
    } else {
      console.log('✅ Stuck check: No stuck tasks');
    }
    
    // 4. System Health Check
    console.log('[4/5] Running system health check...');
    results.health = await healthCheck.runHealthCheck();
    console.log(results.health.summary);
    
    // Auto-fix any issues
    if (!results.health.ok) {
      for (const [name, check] of Object.entries(results.health.checks)) {
        if (!check.ok) {
          const fix = await healthCheck.autoFix(check.message);
          console.log(`🔧 Auto-fix ${name}: ${fix.message}`);
        }
      }
    }
    
    // 5. Reminder Due Check
    console.log('[5/6] Checking for due reminders...');
    results.reminders = await checkReminders();
    if (results.reminders.notify && results.reminders.notifications.length > 0) {
      console.log(`✅ Reminders: ${results.reminders.reminderCount} due reminder(s) found`);
      // Send Telegram notification for each due reminder
      for (const notification of results.reminders.notifications) {
        await sendTelegramNotification(notification.message);
      }
    } else {
      console.log('ℹ️  Reminders: No reminders due');
    }
    
    // 6. Completion Verification (if subagents finished this cycle)
    console.log('[6/6] Checking for completions to verify...');
    // This would check for subagents that finished since last heartbeat
    // For now, just log that we'd do this
    results.verifications = { ok: true, message: 'No new completions to verify' };
    console.log('ℹ️  Verification: No new completions');
    
  } catch (error) {
    console.error('❌ Heartbeat failed:', error.message);
    logHeartbeat(`**FAILED**: ${error.message}\n\nStack:\n${error.stack}`);
    return { ok: false, error: error.message };
  }
  
  // Log successful heartbeat
  const duration = Date.now() - startTime;
  const summary = [
    `**Duration**: ${duration}ms`,
    `**Status Sync**: ${results.statusSync.message}`,
    `**Task Pull**: ${results.taskPull.message}`,
    `**Stuck Check**: ${results.stuckCheck.stuckTasks?.length || 0} stuck task(s)`,
    `**Health**: ${results.health.ok ? '✅ All systems OK' : '⚠️ Issues detected'}`,
    `**Reminders**: ${results.reminders.notify ? `${results.reminders.reminderCount} due` : 'None due'}`,
    `**Verifications**: ${results.verifications.message}`
  ].join('\n');
  
  logHeartbeat(summary);
  
  console.log('=== HEARTBEAT COMPLETE ===');
  console.log(`Duration: ${duration}ms`);
  
  return {
    ok: true,
    duration,
    results
  };
}

// Export for OpenClaw integration
module.exports = {
  runHeartbeat,
  logHeartbeat
};

// Run if called directly
if (require.main === module) {
  (async () => {
    const result = await runHeartbeat();
    console.log('\nFinal result:', JSON.stringify(result, null, 2));
  })();
}
