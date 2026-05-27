#!/usr/bin/env node

/**
 * Kanban Board Review - Periodic Board Management
 * 
 * Reviews Kanban state, identifies blocked tasks,
 * reassigns work, and resumes execution.
 * 
 * Run:
 *   - Hourly via cron
 *   - On-demand: node tools/kanban-review.js
 *   - From heartbeat: require('./tools/kanban-review').quickReview()
 * 
 * Workflow:
 *   1. Review board state (count by column)
 *   2. Identify blocked tasks (>1h no activity)
 *   3. Reassign READY tasks to idle agents
 *   4. Resume stuck IN_PROGRESS tasks
 *   5. Log review results
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const WORKSPACE = process.env.WORKSPACE || '/home/kevin/.openclaw/workspace';
const POOL_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'mission_control',
  user: process.env.DB_USER || 'alfred',
  password: process.env.DB_PASSWORD || 'AlfredDB2026Secure',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

/**
 * Get board state (count per column)
 */
async function getBoardState() {
  const pool = new Pool(POOL_CONFIG);
  
  try {
    const result = await pool.query(`
      SELECT column_name, count(*) as count,
        ARRAY_AGG(id ORDER BY created_at DESC) as task_ids
      FROM tasks 
      GROUP BY column_name 
      ORDER BY column_name
    `);
    
    const board = {};
    for (const row of result.rows) {
      board[row.column_name] = {
        count: parseInt(row.count),
        tasks: row.task_ids,
      };
    }
    
    return board;
  } catch (error) {
    console.error('[KanbanReview] Failed to get board state:', error);
    return {};
  } finally {
    await pool.end();
  }
}

/**
 * Get tasks stuck in a column for >N minutes
 */
async function getStuckTasks(column, thresholdMinutes) {
  const pool = new Pool(POOL_CONFIG);
  
  try {
    const result = await pool.query(`
      SELECT id, title, assignee, column_name, updated_at,
        EXTRACT(EPOCH FROM (NOW() - updated_at)) / 60 as minutes_stuck
      FROM tasks 
      WHERE column_name = $1
        AND updated_at < NOW() - INTERVAL '${thresholdMinutes} minutes'
      ORDER BY updated_at ASC
    `, [column]);
    
    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      assignee: row.assignee,
      column: row.column_name,
      updatedAt: row.updated_at,
      minutesStuck: Math.round(row.minutes_stuck),
    }));
  } catch (error) {
    console.error('[KanbanReview] Failed to get stuck tasks:', error);
    return [];
  } finally {
    await pool.end();
  }
}

/**
 * Get idle agents from PostgreSQL
 */
async function getIdleAgents() {
  const pool = new Pool(POOL_CONFIG);
  
  try {
    const result = await pool.query(`
      SELECT name, status, current_task, last_activity
      FROM agents
      WHERE status = 'idle'
      ORDER BY last_activity ASC
    `);
    
    return result.rows.map(row => ({
      name: row.name,
      status: row.status,
      currentTask: row.current_task,
      lastActivity: row.last_activity,
    }));
  } catch (error) {
    console.error('[KanbanReview] Failed to get idle agents:', error);
    return [];
  } finally {
    await pool.end();
  }
}

/**
 * Get READY tasks waiting for assignment
 */
async function getReadyTasks() {
  const pool = new Pool(POOL_CONFIG);
  
  try {
    const result = await pool.query(`
      SELECT id, title, assignee, priority, created_at
      FROM tasks 
      WHERE column_name = 'READY'
      ORDER BY 
        CASE priority
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
          ELSE 4
        END,
        created_at ASC
    `);
    
    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      assignee: row.assignee,
      priority: row.priority,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('[KanbanReview] Failed to get READY tasks:', error);
    return [];
  } finally {
    await pool.end();
  }
}

/**
 * Reassign READY task to agent
 */
async function assignTaskToAgent(taskId, agentName) {
  const pool = new Pool(POOL_CONFIG);
  
  try {
    await pool.query(`
      UPDATE tasks 
      SET column_name = 'IN_PROGRESS',
          assignee = $1,
          started_at = COALESCE(started_at, NOW()),
          updated_at = NOW()
      WHERE id = $2
    `, [agentName, taskId]);
    
    await pool.query(`
      UPDATE agents
      SET status = 'working',
          current_task = $1,
          last_activity = NOW()
      WHERE name = $2
    `, [`task-${taskId}`, agentName]);
    
    console.log(`✓ Task ${taskId} assigned to ${agentName} → IN_PROGRESS`);
    return { success: true, task: taskId, agent: agentName };
  } catch (error) {
    console.error('[KanbanReview] Failed to assign task:', error);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

/**
 * Resume stuck task (touch timestamp, trigger reconsideration)
 */
async function resumeStuckTask(taskId) {
  const pool = new Pool(POOL_CONFIG);
  
  try {
    await pool.query(`
      UPDATE tasks 
      SET updated_at = NOW()
      WHERE id = $1
    `, [taskId]);
    
    console.log(`✓ Task ${taskId} resumed (timestamp reset)`);
    return { success: true, task: taskId };
  } catch (error) {
    console.error('[KanbanReview] Failed to resume task:', error);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

/**
 * Log review to file
 */
function logReview(board, blocked, reassigned, resumed) {
  const logFile = path.join(WORKSPACE, '.learnings/KANBAN-REVIEW.log');
  const entry = [
    `[${new Date().toISOString()}] Kanban Review`,
    `  Board: BACKLOG=${board.BACKLOG?.count || 0}, READY=${board.READY?.count || 0}, IN_PROGRESS=${board.IN_PROGRESS?.count || 0}, VALIDATION=${board.VALIDATION?.count || 0}, DONE=${board.DONE?.count || 0}, BLOCKED=${board.BLOCKED?.count || 0}`,
    `  Blocked: ${blocked.length} task(s)`,
    `  Reassigned: ${reassigned.length} task(s)`,
    `  Resumed: ${resumed.length} task(s)`,
    '',
  ].join('\n');
  
  fs.appendFileSync(logFile, entry);
}

/**
 * Main review function
 */
async function reviewKanban(options = {}) {
  const {
    thresholdBlocked = 60, // Minutes for BLOCKED detection
    thresholdInProgress = 30, // Minutes for IN_PROGRESS stuck detection
    dryRun = false,
  } = options;
  
  console.log('[KanbanReview] Starting Kanban board review...');
  console.log('================================================');
  
  // 1. Review board state
  const board = await getBoardState();
  
  console.log('Board State:');
  for (const [column, data] of Object.entries(board)) {
    console.log(`  ${column}: ${data.count} task(s)`);
  }
  console.log('');
  
  // 2. Identify blocked tasks
  const blockedTasks = await getStuckTasks('BLOCKED', thresholdBlocked);
  const stuckTasks = await getStuckTasks('IN_PROGRESS', thresholdInProgress);
  
  if (blockedTasks.length) {
    console.log(`⚠ Blocked Tasks (${blockedTasks.length}):`);
    blockedTasks.forEach(t => {
      console.log(`  - ${t.id}: "${t.title}" (${t.minutesStuck} min stuck)`);
    });
    console.log('');
  }
  
  if (stuckTasks.length) {
    console.log(`⚠ Stuck IN_PROGRESS Tasks (${stuckTasks.length}):`);
    stuckTasks.forEach(t => {
      console.log(`  - ${t.id}: "${t.title}" (${t.minutesStuck} min no progress)`);
    });
    console.log('');
  }
  
  // 3. Get idle agents and READY tasks
  const idleAgents = await getIdleAgents();
  const readyTasks = await getReadyTasks();
  
  console.log(`Agents: ${idleAgents.length} idle`);
  console.log(`READY Tasks: ${readyTasks.length} waiting`);
  console.log('');
  
  // 4. Reassign work
  const reassigned = [];
  for (const agent of idleAgents) {
    if (readyTasks.length) {
      const task = readyTasks.shift();
      if (!dryRun) {
        const result = await assignTaskToAgent(task.id, agent.name);
        if (result.success) reassigned.push(result);
      } else {
        console.log(`[DRY RUN] Would assign ${task.id} to ${agent.name}`);
        reassigned.push({ task: task.id, agent: agent.name, dryRun: true });
      }
    }
  }
  
  // 5. Resume stuck tasks
  const resumed = [];
  for (const task of stuckTasks) {
    if (!dryRun) {
      const result = await resumeStuckTask(task.id);
      if (result.success) resumed.push(result);
    } else {
      console.log(`[DRY RUN] Would resume ${task.id}`);
      resumed.push({ task: task.id, dryRun: true });
    }
  }
  
  // 6. Log review
  logReview(board, blockedTasks, reassigned, resumed);
  
  console.log('================================================');
  console.log('Review Complete:');
  console.log(`  Reassigned: ${reassigned.length} task(s)`);
  console.log(`  Resumed: ${resumed.length} task(s)`);
  console.log(`  Logged: .learnings/KANBAN-REVIEW.log`);
  console.log('');
  
  return {
    board,
    blocked: blockedTasks.length,
    stuck: stuckTasks.length,
    reassigned: reassigned.length,
    resumed: resumed.length,
    dryRun,
  };
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    thresholdBlocked: parseInt(args.includes('--threshold') ? args[args.indexOf('--threshold') + 1] : '60'),
  };
  
  reviewKanban(options)
    .then(result => {
      if (result.dryRun) {
        console.log('DRY RUN - No changes made');
      }
      process.exit(0);
    })
    .catch(err => {
      console.error('[KanbanReview] Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { reviewKanban, getBoardState, getStuckTasks, getIdleAgents, getReadyTasks };
