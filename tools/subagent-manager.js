/**
 * Subagent Manager with Automatic Task Status Updates
 * 
 * Wrapper around OpenClaw's subagent system that automatically
 * updates PostgreSQL task status when subagents complete.
 * 
 * Usage:
 *   const subagentMgr = require('./tools/subagent-manager.js');
 *   const result = await subagentMgr.spawnAndTrack({ task, label, taskId });
 */

const { execSync } = require('child_process');
const path = require('path');

const HOOKS = require(path.join(__dirname, 'openclaw-hooks.js'));

/**
 * Spawn a subagent and track it in PostgreSQL
 */
async function spawnAndTrack(options) {
  const { task, label, taskId, runtime = 'subagent', agentId } = options;
  
  try {
    // Call the hook for subagent spawn
    const runId = generateRunId();
    await HOOKS.onSubagentSpawn(
      { runId, label, task },
      { taskId }
    );
    
    console.log(`[Subagent Manager] Spawning subagent for task ${taskId || 'N/A'}: ${label || 'Unnamed'}`);
    
    // For now, return metadata - actual spawning happens via OpenClaw tool
    // The caller should use sessions_spawn or subagents tool
    return {
      runId,
      label,
      task,
      taskId,
      spawned: true,
      note: 'Call OpenClaw sessions_spawn tool with these params, then call completeAndTrack() when done'
    };
    
  } catch (error) {
    console.error('[Subagent Manager] Spawn error:', error);
    return { spawned: false, error: error.message };
  }
}

/**
 * Mark subagent as complete and update task status
 */
async function completeAndTrack(runId, taskId) {
  try {
    console.log(`[Subagent Manager] Completing subagent ${runId}, task ${taskId || 'N/A'}`);
    
    await HOOKS.onSubagentComplete(
      { runId },
      { taskId }
    );
    
    return { completed: true, runId, taskId };
    
  } catch (error) {
    console.error('[Subagent Manager] Complete error:', error);
    return { completed: false, error: error.message };
  }
}

/**
 * Generate a unique run ID
 */
function generateRunId() {
  return `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Execute OpenClaw subagent command and track completion
 * This is a convenience wrapper for CLI usage
 */
function spawnWithTracking(options) {
  const { task, label, taskId } = options;
  const runId = generateRunId();
  
  // Log spawn
  console.log(`[Subagent Manager] Spawning: ${label || 'Task'} (Task: ${taskId || 'N/A'})`);
  
  // Note: Actual subagent spawning requires OpenClaw tool access
  // This is a placeholder for the integration point
  return { runId, label, task, taskId };
}

module.exports = {
  spawnAndTrack,
  completeAndTrack,
  generateRunId,
  spawnWithTracking
};
