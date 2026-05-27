/**
 * Agent Activity Tracker
 * 
 * Auto-updates agent status and logs activity to PostgreSQL.
 * Provides real-time visibility into what agents are doing.
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://alfred:AlfredDB2026Secure@localhost:5432/mission_control',
});

/**
 * Update agent status in the agents table
 * Call this whenever starting/switching/completing work
 */
async function updateStatus(agentName, status, currentTask) {
  try {
    await pool.query(
      `UPDATE agents SET status = $1, current_task = $2, last_activity = NOW() WHERE name = $3`,
      [status, currentTask, agentName]
    );
  } catch (err) {
    console.error('[activity-tracker] Failed to update status:', err.message);
  }
}

/**
 * Log an activity to the activity_log table
 * Call this for significant actions (not every tool call)
 */
async function logActivity(agentName, action, details = null, taskId = null) {
  try {
    await pool.query(
      `INSERT INTO activity_log (agent_name, action, details, task_id) VALUES ($1, $2, $3, $4)`,
      [agentName, action, details, taskId]
    );
  } catch (err) {
    console.error('[activity-tracker] Failed to log activity:', err.message);
  }
}

/**
 * Register a sub-agent when spawned
 */
async function registerSubagent(parentAgent, subagentId, task, model = null) {
  try {
    await pool.query(
      `INSERT INTO subagent_registry (parent_agent, subagent_id, task, model, status, started_at) 
       VALUES ($1, $2, $3, $4, 'running', NOW())`,
      [parentAgent, subagentId, task, model]
    );
    // Also log it
    await logActivity(parentAgent, 'subagent_spawned', `Spawned ${subagentId}: ${task}${model ? ` (${model})` : ''}`);
  } catch (err) {
    console.error('[activity-tracker] Failed to register subagent:', err.message);
  }
}

/**
 * Update sub-agent status when completed/failed
 */
async function updateSubagent(subagentId, status, result = null) {
  try {
    await pool.query(
      `UPDATE subagent_registry SET status = $1, completed_at = NOW(), result = $2 
       WHERE subagent_id = $3`,
      [status, result ? JSON.stringify(result).slice(0, 5000) : null, subagentId]
    );
  } catch (err) {
    console.error('[activity-tracker] Failed to update subagent:', err.message);
  }
}

/**
 * Get recent activity log
 */
async function getRecentActivity(agentName = null, limit = 50) {
  try {
    const query = agentName
      ? `SELECT * FROM activity_log WHERE agent_name = $1 ORDER BY created_at DESC LIMIT $2`
      : `SELECT * FROM activity_log ORDER BY created_at DESC LIMIT $1`;
    const params = agentName ? [agentName, limit] : [limit];
    const result = await pool.query(query, params);
    return result.rows;
  } catch (err) {
    console.error('[activity-tracker] Failed to get activity:', err.message);
    return [];
  }
}

/**
 * Get active sub-agents
 */
async function getActiveSubagents(parentAgent = null) {
  try {
    const query = parentAgent
      ? `SELECT * FROM subagent_registry WHERE parent_agent = $1 AND status = 'running' ORDER BY started_at DESC`
      : `SELECT * FROM subagent_registry WHERE status = 'running' ORDER BY started_at DESC`;
    const params = parentAgent ? [parentAgent] : [];
    const result = await pool.query(query, params);
    return result.rows;
  } catch (err) {
    console.error('[activity-tracker] Failed to get subagents:', err.message);
    return [];
  }
}

/**
 * Cleanup old activity logs (>7 days) and completed sub-agents (>24 hours)
 */
async function cleanup() {
  try {
    await pool.query(`DELETE FROM activity_log WHERE created_at < NOW() - INTERVAL '7 days'`);
    await pool.query(`DELETE FROM subagent_registry WHERE status != 'running' AND completed_at < NOW() - INTERVAL '24 hours'`);
  } catch (err) {
    console.error('[activity-tracker] Cleanup failed:', err.message);
  }
}

module.exports = {
  updateStatus,
  logActivity,
  registerSubagent,
  updateSubagent,
  getRecentActivity,
  getActiveSubagents,
  cleanup,
};