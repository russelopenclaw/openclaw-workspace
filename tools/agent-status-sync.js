#!/usr/bin/env node
/**
 * Agent Status Sync Tool - PostgreSQL Version
 * Ensures agent statuses in PostgreSQL match actual task state
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: 'mission_control',
  user: 'alfred',
  password: process.env.DB_PASSWORD || 'AlfredDB2026Secure',
});

async function syncAgentStatus() {
  console.log('🔄 Syncing agent statuses...');
  
  try {
    // Get all agents
    const agentsResult = await pool.query('SELECT * FROM agents');
    
    // Get tasks by assignee
    const tasksResult = await pool.query(
      `SELECT assignee, column_name, COUNT(*) as count 
       FROM tasks 
       WHERE assignee IS NOT NULL 
       GROUP BY assignee, column_name`
    );
    
    const tasksByAssignee = {};
    for (const row of tasksResult.rows) {
      if (!tasksByAssignee[row.assignee]) {
        tasksByAssignee[row.assignee] = {};
      }
      tasksByAssignee[row.assignee][row.column_name] = parseInt(row.count);
    }
    
    let changes = 0;
    
    for (const agent of agentsResult.rows) {
      const tasks = tasksByAssignee[agent.name] || {};
      const inProgressTasks = tasks['in-progress'] || 0;
      
      const shouldBeWorking = inProgressTasks > 0;
      const isMarkedWorking = agent.status === 'working';
      
      if (shouldBeWorking && !isMarkedWorking) {
        console.log(`  ⚠️  ${agent.name}: Has ${inProgressTasks} in-progress task(s) but marked idle`);
        await pool.query(
          `UPDATE agents SET status = 'working', last_activity = NOW() WHERE name = $1`,
          [agent.name]
        );
        changes++;
      } else if (!shouldBeWorking && isMarkedWorking) {
        console.log(`  ⚠️  ${agent.name}: Marked working but no in-progress tasks (STALE)`);
        await pool.query(
          `UPDATE agents SET status = 'idle', last_activity = NOW() WHERE name = $1`,
          [agent.name]
        );
        changes++;
      }
    }
    
    if (changes === 0) {
      console.log('  ✅ All agent statuses are accurate');
    } else {
      console.log(`  ✅ Fixed ${changes} stale agent status(es)`);
    }
    
  } catch (error) {
    console.error('Sync error:', error.message);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  syncAgentStatus();
}

module.exports = { syncAgentStatus };
