#!/usr/bin/env node

/**
 * Agent Status Updater
 * 
 * Updates agent status in PostgreSQL (single source of truth).
 * JSON file is deprecated - this tool only uses PostgreSQL.
 * 
 * Usage:
 *   const agentStatus = require('./tools/agent-status-updater.js');
 *   await agentStatus.update('alfred', 'working', 'task-45: Doing something');
 */

const { Pool } = require('pg');

const POSTGRES_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'mission_control',
  user: 'alfred',
  password: 'AlfredDB2026Secure'
};

/**
 * Update agent status in PostgreSQL (single source of truth)
 */
async function update(agentName, status, currentTask) {
  const pool = new Pool(POSTGRES_CONFIG);
  const lastActivity = new Date().toISOString();

  try {
    // Update PostgreSQL - this is the ONLY source of truth
    await pool.query(
      `UPDATE agents 
       SET status = $1, 
           current_task = $2, 
           last_activity = NOW() 
       WHERE name = $3`,
      [status, currentTask, agentName]
    );

    console.log(`[Agent Status] Updated PostgreSQL: ${agentName} -> ${status}`);
    console.log(`[Agent Status] JSON file deprecated - PostgreSQL is single source of truth`);

    return { success: true, agentName, status, currentTask, lastActivity };
    
  } catch (error) {
    console.error('[Agent Status] Update failed:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

/**
 * Get current agent status from PostgreSQL
 */
async function get(agentName) {
  const pool = new Pool(POSTGRES_CONFIG);
  
  try {
    const result = await pool.query(
      'SELECT name, status, current_task, last_activity FROM agents WHERE name = $1',
      [agentName]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      name: row.name,
      status: row.status,
      currentTask: row.current_task,
      lastActivity: row.last_activity
    };
    
  } catch (error) {
    console.error('[Agent Status] Get failed:', error.message);
    return null;
  } finally {
    await pool.end();
  }
}

/**
 * Log status change to console (for debugging)
 */
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

module.exports = {
  update,
  get,
  log
};

// CLI usage
if (require.main === module) {
  const [,, agentName, status, ...taskParts] = process.argv;
  const currentTask = taskParts.join(' ');
  
  if (!agentName || !status || !currentTask) {
    console.error('Usage: node agent-status-updater.js <agent-name> <status> <current-task>');
    console.error('Example: node agent-status-updater.js alfred working "task-45: Building feature"');
    process.exit(1);
  }
  
  (async () => {
    const result = await update(agentName, status, currentTask);
    if (result.success) {
      console.log('✅ Status updated successfully');
      process.exit(0);
    } else {
      console.error('❌ Update failed:', result.error);
      process.exit(1);
    }
  })();
}
