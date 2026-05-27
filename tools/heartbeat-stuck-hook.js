/**
 * Heartbeat Stuck Task Hook
 * 
 * Integrates stuck task monitoring into heartbeat checks.
 * Call this from your heartbeat routine.
 * 
 * Usage:
 *   const hook = require('./tools/heartbeat-stuck-hook.js');
 *   await hook.checkAndNotify(messageApi);
 * 
 * MIGRATION: 2026-03-05 - Migrated from JSON to PostgreSQL
 */

const stuckMonitor = require('./stuck-task-monitor.js');
const { Pool } = require('pg');

const POSTGRES_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'mission_control',
  user: 'alfred',
  password: process.env.DB_PASSWORD || 'AlfredDB2026Secure'
};

/**
 * Sessions list tool wrapper (to be called by OpenClaw)
 * This assumes you'll call sessions_list tool in your heartbeat
 */
async function getActiveSessions(messageApi) {
  // This will be called as a tool by the heartbeat routine
  // Return format should match sessions_list output
  return [];
}

/**
 * Send message to Kevin via Telegram
 * Expects messageApi to have send method
 */
async function notifyKevin(messageApi, message) {
  if (!messageApi || !messageApi.send) {
    console.error('No message API available');
    return false;
  }
  
  try {
    await messageApi.send({
      channel: 'telegram',
      target: 'telegram:8177470832',
      message: message
    });
    return true;
  } catch (error) {
    console.error('Failed to send notification:', error);
    return false;
  }
}

/**
 * Kill and respawn a subagent
 * This requires sessions_spawn and subagents kill
 */
async function respawnSubagent(messageApi, taskId, taskTitle) {
  console.log(`Respawning subagent for task: ${taskId}`);
  // Implementation would call:
  // 1. subagents(action='kill', target=<session-id>)
  // 2. sessions_spawn(task=taskTitle, ...)
  // This is a stub - actual implementation depends on your orchestration
  return true;
}

/**
 * Main heartbeat check function
 * Call this from your HEARTBEAT.md routine
 */
async function checkAndNotify(messageApi, activeSessions = []) {
  console.log('Running stuck task check...');
  
  const result = stuckMonitor.checkStuckTasks(activeSessions);
  
  if (result.ok || result.stuckTasks.length === 0) {
    console.log('No stuck tasks detected');
    return { ok: true };
  }
  
  console.log(`Found ${result.stuckTasks.length} stuck task(s), processing...`);
  
  const notifications = [];
  
  for (const action of result.actions) {
    if (action.action === 'escalate') {
      // Send escalation to Kevin
      console.log('Escalating to Kevin:', action.taskId);
      await notifyKevin(messageApi, action.message);
      notifications.push({ type: 'escalate', taskId: action.taskId });
    }
    
    if (action.action === 'auto-retry') {
      // Auto-kill and respawn
      console.log('Auto-retrying:', action.taskId);
      await respawnSubagent(messageApi, action.taskId, result.stuckTasks[0]?.task?.title);
      await notifyKevin(messageApi, action.message);
      notifications.push({ type: 'retry', taskId: action.taskId });
      
      // Update retry count in PostgreSQL tasks table
      const pool = new Pool(POSTGRES_CONFIG);
      try {
        // Get current retry count
        const result = await pool.query(
          'SELECT stuck_retry_count FROM tasks WHERE id = $1',
          [action.taskId]
        );
        
        if (result.rows.length > 0) {
          const currentCount = result.rows[0].stuck_retry_count || 0;
          const newCount = currentCount + 1;
          
          // Update retry count and add history entry
          await pool.query(
            `UPDATE tasks 
             SET stuck_retry_count = $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [newCount, action.taskId]
          );
          
          // Add to task_history table
          await pool.query(
            `INSERT INTO task_history (task_id, status, note, created_at)
             VALUES ($1, $2, $3, NOW())`,
            [action.taskId, 'auto-retry', `Auto-retry #${newCount} - task was stuck with no progress`]
          );
          
          console.log(`Updated retry count for task ${action.taskId}: ${newCount}`);
        }
      } catch (error) {
        console.error('Failed to update retry count:', error.message);
      } finally {
        await pool.end();
      }
    }
  }
  
  return {
    ok: false,
    notifications,
    stuckTasks: result.stuckTasks
  };
}

module.exports = {
  checkAndNotify,
  notifyKevin,
  respawnSubagent
};
