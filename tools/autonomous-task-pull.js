/**
 * Autonomous Task Pull System
 * 
 * Automatically assigns work to idle agents by:
 * 1. Finding idle agents (status="idle" in PostgreSQL agents table)
 * 2. Finding their highest-priority backlog tasks
 * 3. Auto-spawning subagents
 * 4. Updating task status and agent status
 * 
 * Call this from heartbeat checks.
 * 
 * MIGRATION: 2026-03-05 - Migrated from JSON to PostgreSQL
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
 * Find idle agents from PostgreSQL
 */
async function findIdleAgents() {
  const pool = new Pool(POSTGRES_CONFIG);
  
  try {
    const result = await pool.query(
      'SELECT name, status, current_task FROM agents WHERE status = $1',
      ['idle']
    );
    
    return result.rows.map(row => row.name);
  } catch (error) {
    console.error('Failed to find idle agents:', error.message);
    return [];
  } finally {
    await pool.end();
  }
}

/**
 * Find highest-priority backlog task for an agent with met dependencies
 */
async function findReadyTask(agentName) {
  const pool = new Pool(POSTGRES_CONFIG);
  
  try {
    // Get all backlog tasks for this agent, filtering out ones with incomplete parent tasks
    const result = await pool.query(`
      SELECT t.id, t.title, t.description, t.priority, t.assignee, t.column_name, t.parent_task_id,
             parent.column_name as parent_column,
             CASE t.priority
               WHEN 'critical' THEN 0
               WHEN 'high' THEN 1
               WHEN 'medium' THEN 2
               WHEN 'low' THEN 3
               ELSE 99
             END as priority_order
      FROM tasks t
      LEFT JOIN tasks parent ON t.parent_task_id = parent.id
      WHERE t.assignee = $1 
        AND t.column_name = 'backlog'
      ORDER BY priority_order ASC, t.created_at ASC
    `, [agentName]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    // Check dependencies for each task (in priority order)
    for (const task of result.rows) {
      const depsMet = await dependenciesMet(task.parent_task_id, task.parent_column);
      if (depsMet) {
        return {
          id: task.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          assignee: task.assignee,
          column: task.column_name
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Failed to find ready task:', error.message);
    return null;
  } finally {
    await pool.end();
  }
}

/**
 * Check if task dependencies are met (parent task is 'done')
 * Note: PostgreSQL schema uses parent_task_id (single parent) instead of dependencies array
 */
async function dependenciesMet(parentTaskId, parentColumn) {
  // No parent = no dependencies
  if (!parentTaskId) return true;
  
  // Parent task must be in 'done' column
  return parentColumn === 'done';
}

/**
 * Generate spawn config for a task
 */
function generateSpawnConfig(task) {
  return {
    task: `## Task: ${task.title} (${task.id})\n\n${task.description}\n\n**Priority:** ${task.priority}\n**Assigned to:** ${task.assignee}\n\nContinue the Second Brain implementation. Check dependencies in mission_control database (tasks table) before starting.`,
    label: `${task.assignee === 'alfred' ? 'Alfred' : task.assignee} - ${task.title}`,
    runtime: 'subagent',
    mode: 'run'
  };
}

/**
 * Update task and agent status when task is assigned
 */
async function assignTask(taskId, agentName, subagentRunId) {
  const pool = new Pool(POSTGRES_CONFIG);
  
  try {
    await pool.query('BEGIN');
    
    // Update task status
    await pool.query(`
      UPDATE tasks 
      SET column_name = 'in-progress',
          started_at = NOW(),
          updated_at = NOW(),
          linked_subagent = $1
      WHERE id = $2
    `, [subagentRunId, taskId]);
    
    // Add to task history
    await pool.query(`
      INSERT INTO task_history (task_id, status, note, created_at)
      VALUES ($1, $2, $3, NOW())
    `, [taskId, 'in-progress', `Auto-assigned by heartbeat, subagent spawned: ${subagentRunId}`]);
    
    // Update agent status
    await pool.query(`
      UPDATE agents
      SET status = 'working',
          current_task = (SELECT title FROM tasks WHERE id = $1),
          last_activity = NOW()
      WHERE name = $2
    `, [taskId, agentName]);
    
    await pool.query('COMMIT');
    return true;
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Failed to assign task:', error.message);
    return false;
  } finally {
    await pool.end();
  }
}

/**
 * Main function: Auto-assign tasks to idle agents
 * 
 * @param {Function} spawnFn - Function to call sessions_spawn (passed from heartbeat)
 * @returns {Object} Results: { assignments: [], message: "" }
 */
async function autoAssignTasks(spawnFn) {
  const idleAgents = await findIdleAgents();
  
  if (idleAgents.length === 0) {
    return { ok: true, message: 'No idle agents found', assignments: [] };
  }
  
  const assignments = [];
  
  for (const agentName of idleAgents) {
    const task = await findReadyTask(agentName);
    if (!task) {
      console.log(`Agent ${agentName} is idle but has no ready backlog tasks`);
      continue;
    }
    
    // Spawn subagent
    const spawnConfig = generateSpawnConfig(task);
    
    console.log(`Auto-spawning ${agentName} for task: ${task.title}`);
    
    // Call spawn function (will be provided by heartbeat)
    const result = await spawnFn(spawnConfig);
    const runId = result.runId || result.sessionId || 'unknown';
    
    // Update task and agent status in PostgreSQL
    const assigned = await assignTask(task.id, agentName, runId);
    
    if (assigned) {
      assignments.push({
        agent: agentName,
        task: task.title,
        taskId: task.id,
        subagentRunId: runId
      });
    }
  }
  
  if (assignments.length > 0) {
    console.log(`Auto-assigned ${assignments.length} task(s) to idle agents`);
  }
  
  return {
    ok: true,
    assignments,
    message: `Auto-assigned ${assignments.length} task(s): ${assignments.map(a => a.task).join(', ')}`
  };
}

module.exports = {
  autoAssignTasks,
  findIdleAgents,
  findReadyTask,
  dependenciesMet,
  generateSpawnConfig,
  assignTask
};

// Self-test
if (require.main === module) {
  (async () => {
    console.log('Running autonomous task pull self-test...');
    
    const idleAgents = await findIdleAgents();
    console.log('Idle agents:', idleAgents);
    
    for (const agent of idleAgents) {
      const task = await findReadyTask(agent);
      console.log(`  ${agent} next task:`, task ? task.title : 'None');
    }
  })();
}
