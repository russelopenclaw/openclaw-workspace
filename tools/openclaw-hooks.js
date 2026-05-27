/**
 * OpenClaw Hook Integration - PostgreSQL Version
 */

const path = require('path');
const TOOLS_DIR = __dirname;
const hook = require(path.join(TOOLS_DIR, 'agent-status-hook-pg'));

module.exports = {
  onSessionStart: async (session) => {
    try {
      await hook.updateAgentStatus('alfred', 'working', 'Session started');
      console.log('[OpenClaw Hooks] Session started - Alfred status set to working');
    } catch (error) {
      console.error('[OpenClaw Hooks] Error in onSessionStart:', error);
    }
  },

  onMessageReceived: async (messages, session) => {
    try {
      await hook.onMessageReceived(messages, session);
      console.log('[OpenClaw Hooks] Message received - Alfred status updated');
    } catch (error) {
      console.error('[OpenClaw Hooks] Error in onMessageReceived:', error);
    }
  },

  onSubagentSpawn: async (subagentInfo, taskInfo) => {
    try {
      await hook.trackSubagent(subagentInfo, taskInfo);
      console.log('[OpenClaw Hooks] Subagent spawned:', subagentInfo.label || subagentInfo.runId, 'Task:', taskInfo?.taskId || 'N/A');
    } catch (error) {
      console.error('[OpenClaw Hooks] Error in onSubagentSpawn:', error);
    }
  },

  onSubagentComplete: async (subagentInfo, taskInfo) => {
    try {
      await hook.completeSubagent(subagentInfo, taskInfo);
      console.log('[OpenClaw Hooks] Subagent completed:', subagentInfo.runId, 'Task:', taskInfo?.taskId || 'N/A');
    } catch (error) {
      console.error('[OpenClaw Hooks] Error in onSubagentComplete:', error);
    }
  },

  onTaskComplete: async (taskId) => {
    try {
      await hook.onTaskComplete(taskId);
      console.log('[OpenClaw Hooks] Task completed - Alfred status set to idle');
    } catch (error) {
      console.error('[OpenClaw Hooks] Error in onTaskComplete:', error);
    }
  },

  onHeartbeat: async () => {
    try {
      await hook.onHeartbeat();
    } catch (error) {
      console.error('[OpenClaw Hooks] Error in onHeartbeat:', error);
    }
  }
};
