/**
 * Agent Status Hook - DEPRECATED
 * 
 * ⚠️  This file is DEPRECATED as of 2026-03-05
 * 
 * All agent status operations now use PostgreSQL via:
 *   - tools/agent-status-updater.js (PostgreSQL only, single source of truth)
 *   - PostgreSQL table: mission_control.agents
 * 
 * The old JSON file approach (kanban/tasks.json agents section) is deprecated.
 * 
 * Migration:
 *   OLD: const hook = require('./agent-status-hook.js');
 *        await hook.updateAgentStatus('alfred', 'working', 'task');
 * 
 *   NEW: const agentStatus = require('./agent-status-updater.js');
 *        await agentStatus.update('alfred', 'working', 'task');
 * 
 * Historical Note:
 *   This file previously managed agent and subagent status in JSON files.
 *   All functionality has been replaced by agent-status-updater.js which uses
 *   PostgreSQL as the single source of truth.
 */

// Export deprecated functions that point to the new implementation
const agentStatusUpdater = require('./agent-status-updater.js');

module.exports = {
  // Deprecated - use agent-status-updater.js instead
  updateAgentStatus: agentStatusUpdater.update,
  getAgentStatus: agentStatusUpdater.get,
  
  // Placeholder functions - no longer needed with PostgreSQL approach
  updateSubagentStatus: async () => {
    console.warn('[Agent Status Hook] updateSubagentStatus is deprecated - subagent tracking now via sessions API');
    return { success: true, deprecated: true };
  },
  
  onMessageReceived: async () => {
    console.warn('[Agent Status Hook] onMessageReceived is deprecated');
  },
  
  onTaskComplete: async () => {
    console.warn('[Agent Status Hook] onTaskComplete is deprecated');
  },
  
  onSubagentSpawn: async () => {
    console.warn('[Agent Status Hook] onSubagentSpawn is deprecated');
  },
  
  onSubagentComplete: async () => {
    console.warn('[Agent Status Hook] onSubagentComplete is deprecated');
  },
  
  trackSubagent: async () => {
    console.warn('[Agent Status Hook] trackSubagent is deprecated');
  },
  
  completeSubagent: async () => {
    console.warn('[Agent Status Hook] completeSubagent is deprecated');
  },
  
  onHeartbeat: async () => {
    console.warn('[Agent Status Hook] onHeartbeat is deprecated - use PostgreSQL queries directly');
  },
  
  extractTaskSummary: (messages) => {
    console.warn('[Agent Status Hook] extractTaskSummary is deprecated');
    if (!messages || messages.length === 0) return 'No task specified';
    const lastUserMessage = messages[messages.length - 1];
    const content = lastUserMessage.content || lastUserMessage.text || '';
    const summary = content.length > 50 ? content.substring(0, 50) + '...' : content;
    return summary || 'Processing request';
  }
};
