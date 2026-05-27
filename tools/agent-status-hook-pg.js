/**
 * Agent Status Hook for OpenClaw - PostgreSQL Version
 * Automatically updates agent status in PostgreSQL database
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: 'mission_control',
  user: 'alfred',
  password: process.env.DB_PASSWORD || 'AlfredDB2026Secure',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * Update agent status in PostgreSQL
 */
async function updateAgentStatus(agent, status, currentTask) {
  try {
    await pool.query(
      `INSERT INTO agents (name, status, current_task, last_activity)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (name) DO UPDATE SET
         status = $2,
         current_task = $3,
         last_activity = NOW()`,
      [agent, status, currentTask]
    );
    
    console.log(`[Agent Status Hook] ${agent} status updated to ${status}`);
    return { success: true };
  } catch (error) {
    console.error('[Agent Status Hook] Error updating status:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Update subagent status in PostgreSQL
 */
async function updateSubagentStatus(runId, status, task, label = 'Unnamed Subagent') {
  try {
    await pool.query(
      `INSERT INTO subagents (run_id, label, task, status, started_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (run_id) DO UPDATE SET
         status = $4,
         task = $3,
         completed_at = CASE WHEN $4 IN ('done', 'completed', 'idle') THEN NOW() ELSE subagents.completed_at END`,
      [runId, label, task, status]
    );
    
    console.log(`[Agent Status Hook] Subagent ${runId} status: ${status}`);
    return { success: true };
  } catch (error) {
    console.error('[Agent Status Hook] Error updating subagent:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Called when a message is received
 */
async function onMessageReceived(messages, session) {
  try {
    const taskSummary = extractTaskSummary(messages);
    await updateAgentStatus('alfred', 'working', taskSummary);
  } catch (error) {
    console.error('[Agent Status Hook] Error in onMessageReceived:', error);
  }
}

/**
 * Called when a task is completed
 */
async function onTaskComplete(taskId) {
  try {
    // Update task status in database
    await pool.query(
      `UPDATE tasks SET column_name = 'done', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [taskId]
    );
    
    // Set Alfred to idle
    await updateAgentStatus('alfred', 'idle', 'Task completed');
    console.log('[Agent Status Hook] Task completed:', taskId);
  } catch (error) {
    console.error('[Agent Status Hook] Error in onTaskComplete:', error);
  }
}

/**
 * Called when a subagent is spawned
 */
async function onSubagentSpawn(runId, label, task) {
  try {
    await updateSubagentStatus(runId, 'running', task, label);
  } catch (error) {
    console.error('[Agent Status Hook] Error in onSubagentSpawn:', error);
  }
}

/**
 * Called when a subagent completes
 */
async function onSubagentComplete(runId, taskId) {
  try {
    // Update subagent status
    await pool.query(
      `UPDATE subagents SET status = 'done', completed_at = NOW() 
       WHERE run_id = $1`,
      [runId]
    );
    
    // Try to find taskId if not provided
    let effectiveTaskId = taskId;
    if (!effectiveTaskId) {
      // First, try to find task by linked_subagent
      const linkedResult = await pool.query(
        `SELECT id FROM tasks WHERE linked_subagent = $1 LIMIT 1`,
        [runId]
      );
      
      if (linkedResult.rows.length > 0) {
        effectiveTaskId = linkedResult.rows[0].id;
        console.log(`[Hook] Found task ${effectiveTaskId} via linked_subagent`);
      } else {
        // Try to extract task ID from subagent label (e.g., "Alfred - Auto Status Update Hook (Task-43)")
        const subagentResult = await pool.query(
          `SELECT label FROM subagents WHERE run_id = $1 LIMIT 1`,
          [runId]
        );
        
        if (subagentResult.rows.length > 0) {
          const label = subagentResult.rows[0].label;
          const taskMatch = label.match(/Task[- ]?(\d+)/i);
          if (taskMatch) {
            const taskNum = taskMatch[1];
            const candidateId = `task-${taskNum.toLowerCase()}`;
            
            // Verify this task exists
            const verifyResult = await pool.query(
              `SELECT id FROM tasks WHERE id = $1 LIMIT 1`,
              [candidateId]
            );
            
            if (verifyResult.rows.length > 0) {
              effectiveTaskId = candidateId;
              console.log(`[Hook] Extracted task ${effectiveTaskId} from label: ${label}`);
            }
          }
        }
      }
    }
    
    // Update task status if taskId found
    if (effectiveTaskId) {
      await pool.query(
        `UPDATE tasks SET 
           column_name = 'done', 
           completed_at = NOW(), 
           updated_at = NOW()
         WHERE id = $1`,
        [effectiveTaskId]
      );
      console.log(`[Hook] Task ${effectiveTaskId} marked done automatically`);
    }
    
    // Set Alfred to idle
    await pool.query(
      `UPDATE agents SET 
         status = 'idle', 
         last_activity = NOW()
       WHERE name = 'alfred'`
    );
    
    console.log(`[Hook] Subagent ${runId} completed, task ${effectiveTaskId || 'N/A'} updated, agent set to idle`);
  } catch (error) {
    console.error('[Hook] Error in onSubagentComplete:', error);
  }
}

/**
 * Extract task summary from user message
 */
function extractTaskSummary(messages) {
  if (!messages || messages.length === 0) return 'No task specified';
  const lastUserMessage = messages[messages.length - 1];
  const content = lastUserMessage.content || lastUserMessage.text || '';
  const summary = content.length > 50 ? content.substring(0, 50) + '...' : content;
  return summary || 'Processing request';
}

/**
 * Track subagent (wrapper)
 */
async function trackSubagent(subagentInfo, taskInfo) {
  try {
    const { runId, label, task } = subagentInfo;
    const taskId = taskInfo?.taskId;
    await onSubagentSpawn(runId, label || 'Unnamed', task || 'Unknown task');
    
    // If taskId is provided, link it to the subagent in the database
    if (taskId) {
      try {
        await pool.query(
          `UPDATE tasks SET linked_subagent = $1, started_at = COALESCE(started_at, NOW()), updated_at = NOW()
           WHERE id = $1`,
          [runId, taskId]
        );
        console.log(`[Hook] Linked task ${taskId} to subagent ${runId}`);
      } catch (err) {
        console.error('[Hook] Error linking task to subagent:', err);
      }
    }
  } catch (error) {
    console.error('[Agent Status Hook] Error tracking subagent:', error);
  }
}

/**
 * Complete subagent (wrapper)
 */
async function completeSubagent(subagentInfo, taskInfo) {
  try {
    const { runId } = subagentInfo;
    const taskId = taskInfo?.taskId;
    await onSubagentComplete(runId, taskId);
  } catch (error) {
    console.error('[Agent Status Hook] Error completing subagent:', error);
  }
}

/**
 * Heartbeat function - refreshes agent statuses
 */
async function onHeartbeat() {
  try {
    const now = new Date();
    
    // Reset agents that have been "working" for >1 hour without activity
    await pool.query(
      `UPDATE agents 
       SET status = 'idle', current_task = 'Auto-reset by heartbeat (stale)', last_activity = NOW()
       WHERE status = 'working' AND last_activity < NOW() - INTERVAL '1 hour'`
    );
    
    console.log('[Agent Status Hook] Heartbeat complete - stale agents reset');
  } catch (error) {
    console.error('[Agent Status Hook] Heartbeat error:', error);
  }
}

// Cleanup pool on exit
process.on('beforeExit', async () => {
  await pool.end();
});

module.exports = {
  onMessageReceived,
  onTaskComplete,
  onSubagentSpawn,
  onSubagentComplete,
  trackSubagent,
  completeSubagent,
  onHeartbeat,
  updateAgentStatus,
  updateSubagentStatus,
  extractTaskSummary,
};
