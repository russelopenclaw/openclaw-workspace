/**
 * Auto Status Sync
 * 
 * Syncs subagent completion status between:
 * - sessions_list tool output
 * - PostgreSQL subagents table
 * - PostgreSQL tasks table
 * 
 * Call this at the start of every heartbeat.
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
 * Find completions by comparing active sessions with PostgreSQL subagents table
 */
async function findCompletions(activeSessions) {
  const pool = new Pool(POSTGRES_CONFIG);
  
  try {
    // Get active subagents from PostgreSQL
    const result = await pool.query(
      'SELECT run_id, label, task, started_at FROM subagents WHERE status = $1',
      ['running']
    );
    
    // Extract active runIds from sessions_list output
    const activeRunIds = new Set(
      activeSessions
        .filter(s => s.key && s.key.includes('subagent:'))
        .map(s => {
          const match = s.key.match(/subagent:([a-f0-9-]+)/i);
          return match ? match[1] : null;
        })
        .filter(Boolean)
    );
    
    // Find subagents in DB but not in active sessions = completed
    const completions = [];
    for (const dbSubagent of result.rows) {
      if (!activeRunIds.has(dbSubagent.run_id)) {
        completions.push({
          runId: dbSubagent.run_id,
          label: dbSubagent.label,
          task: dbSubagent.task,
          startedAt: dbSubagent.started_at
        });
      }
    }
    
    return completions;
  } catch (error) {
    console.error('Failed to find completions:', error.message);
    return [];
  } finally {
    await pool.end();
  }
}

/**
 * Mark subagent as completed in PostgreSQL
 */
async function completeSubagent(completion) {
  const pool = new Pool(POSTGRES_CONFIG);
  
  try {
    await pool.query(`
      UPDATE subagents
      SET status = $1,
          completed_at = NOW(),
          runtime = EXTRACT(EPOCH FROM (NOW() - started_at)) / 60 || 'm',
          last_updated = NOW()
      WHERE run_id = $2
    `, ['done', completion.runId]);
    
    console.log(`Marked subagent ${completion.runId} (${completion.label}) as done`);
    return true;
  } catch (error) {
    console.error('Failed to complete subagent:', error.message);
    return false;
  } finally {
    await pool.end();
  }
}

/**
 * Calculate runtime string
 */
function calculateRuntime(startedAt) {
  const start = new Date(startedAt);
  const end = new Date();
  const minutes = Math.floor((end - start) / 60000);
  return `${minutes}m`;
}

/**
 * Update task status when subagent completes
 */
async function completeTask(completion) {
  const pool = new Pool(POSTGRES_CONFIG);
  
  try {
    // Find task with matching linked_subagent
    const result = await pool.query(`
      UPDATE tasks
      SET column_name = 'done',
          completed_at = NOW(),
          updated_at = NOW()
      WHERE linked_subagent = $1
        AND column_name = 'in-progress'
      RETURNING id, title, assignee
    `, [completion.runId]);
    
    if (result.rows.length === 0) {
      // Try fuzzy match by assignee and label
      const fuzzyResult = await pool.query(`
        UPDATE tasks
        SET column_name = 'done',
            completed_at = NOW(),
            updated_at = NOW()
        WHERE column_name = 'in-progress'
          AND assignee IS NOT NULL
          AND $1 ILIKE '%' || assignee || '%'
        RETURNING id, title, assignee
        LIMIT 1
      `, [completion.label]);
      
      if (fuzzyResult.rows.length === 0) {
        console.log(`No task found for subagent ${completion.runId}`);
        return null;
      }
      
      const task = fuzzyResult.rows[0];
      console.log(`  → Fuzzy matched task: ${task.title}`);
      
      // Add to task history
      await pool.query(`
        INSERT INTO task_history (task_id, status, note, created_at)
        VALUES ($1, $2, $3, NOW())
      `, [task.id, 'done', `Completed by subagent: ${completion.label}`]);
      
      // Update agent to idle
      await pool.query(`
        UPDATE agents
        SET status = 'idle',
            current_task = 'Awaiting next task',
            last_activity = NOW()
        WHERE name = $1
      `, [task.assignee]);
      
      return task;
    }
    
    const task = result.rows[0];
    console.log(`  → Task completed: ${task.title}`);
    
    // Add to task history
    await pool.query(`
      INSERT INTO task_history (task_id, status, note, created_at)
      VALUES ($1, $2, $3, NOW())
    `, [task.id, 'done', `Completed by subagent: ${completion.label}`]);
    
    // Update agent status to idle
    if (task.assignee) {
      await pool.query(`
        UPDATE agents
        SET status = 'idle',
            current_task = 'Awaiting next task',
            last_activity = NOW()
        WHERE name = $1
      `, [task.assignee]);
    }
    
    return task;
  } catch (error) {
    console.error('Failed to complete task:', error.message);
    return null;
  } finally {
    await pool.end();
  }
}

/**
 * Main sync function
 */
async function syncStatus(activeSessions) {
  const timestamp = new Date().toLocaleTimeString();
  
  // Find completions
  const completions = await findCompletions(activeSessions);
  
  if (completions.length === 0) {
    return {
      ok: true,
      completions: [],
      tasksUpdated: 0,
      message: 'No completions detected'
    };
  }
  
  console.log(`[${timestamp}] Found ${completions.length} completed subagent(s)`);
  
  // Process each completion
  const updatedTaskIds = [];
  for (const completion of completions) {
    console.log(`[${timestamp}] Completing subagent: ${completion.label}`);
    
    // Update subagents table
    await completeSubagent(completion);
    
    // Update tasks table and agent status
    const updatedTask = await completeTask(completion);
    if (updatedTask) {
      updatedTaskIds.push(updatedTask.id);
    }
  }
  
  return {
    ok: true,
    completions: completions.map(c => ({
      label: c.label,
      runId: c.runId,
      task: c.task
    })),
    tasksUpdated: updatedTaskIds.length,
    updatedTaskIds,
    message: `Synced ${completions.length} completion(s), updated ${updatedTaskIds.length} task(s)`
  };
}

/**
 * Quick health check - verify PostgreSQL connection and get counts
 */
async function healthCheck() {
  const pool = new Pool(POSTGRES_CONFIG);
  
  try {
    const [subagentCount, taskCount] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM subagents WHERE status = $1', ['running']),
      pool.query('SELECT COUNT(*) as count FROM tasks WHERE column_name = $1', ['in-progress'])
    ]);
    
    return {
      ok: true,
      activeSubagents: parseInt(subagentCount.rows[0].count),
      inProgressTasks: parseInt(taskCount.rows[0].count)
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  } finally {
    await pool.end();
  }
}

module.exports = {
  syncStatus,
  findCompletions,
  completeSubagent,
  completeTask,
  healthCheck
};

// Self-test
if (require.main === module) {
  (async () => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] Running auto status sync self-test...`);
    
    const health = await healthCheck();
    console.log(`[${timestamp}] Health check:`, health);
    
    console.log(`\n[${timestamp}] To test fully, call syncStatus() with actual sessions_list output`);
  })();
}
