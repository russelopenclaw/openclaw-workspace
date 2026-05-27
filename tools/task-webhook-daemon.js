#!/usr/bin/env node

/**
 * Task Webhook Daemon
 * 
 * Listens to PostgreSQL NOTIFY events and triggers OpenClaw actions:
 * 
 * Events:
 *   task_status_changed → Log to dashboard, notify Alfred
 *   agent_work_complete → Trigger validation
 *   task_assigned_to_alfred → Auto-process if backlog/ready
 * 
 * Usage:
 *   node tools/task-webhook-daemon.js &  # Run as background daemon
 *   # Or via systemd service
 * 
 * Architecture:
 *   PostgreSQL LISTEN → Daemon → OpenClaw skills/sessions
 */

const { Pool } = require('pg');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const WORKSPACE = process.env.WORKSPACE || '/home/kevin/.openclaw/workspace';
const POOL_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'mission_control',
  user: process.env.DB_USER || 'alfred',
  password: process.env.DB_PASSWORD || 'AlfredDB2026Secure',
};

// Event handlers
const handlers = {
  /**
   * Task status changed (BACKLOG → READY → IN_PROGRESS → VALIDATION → DONE)
   */
  async task_status_changed(payload) {
    const { task_id, from, to, title, assignee } = JSON.parse(payload);
    
    console.log(`[Webhook] Task ${task_id}: ${from} → ${to}`);
    console.log(`  Title: ${title}`);
    console.log(`  Assignee: ${assignee || 'unassigned'}`);
    
    // Log to dashboard file
    const dashboardLog = path.join(WORKSPACE, '.learnings/TASK-TRANSITIONS.log');
    const entry = `[${new Date().toISOString()}] ${task_id}: "${title}" ${from}→${to} (${assignee || 'unassigned'})`;
    fs.appendFileSync(dashboardLog, entry + '\n');
    
    // If moved to IN_PROGRESS, mark agent as working
    if (to === 'IN_PROGRESS' && assignee) {
      console.log(`  → Agent ${assignee} should be working`);
      // TODO: Update agents table via agent-status-updater.js
    }
    
    // If moved to VALIDATION, trigger validation agent
    if (to === 'VALIDATION') {
      console.log(`  → Triggering validation agent...`);
      // TODO: Call validation-agent.js
      // spawn('node', [path.join(WORKSPACE, 'tools/validation-agent.js'), task_id]);
    }
    
    // If moved to READY, auto-assign if agent available
    if (to === 'READY' && assignee === 'alfred') {
      console.log(`  → Ready for Alfred assignment`);
      // Alfred will pick up on next heartbeat
    }
  },
  
  /**
   * Agent work complete - trigger validation
   */
  async agent_work_complete(payload) {
    const { task_id, agent, run_id } = JSON.parse(payload);
    
    console.log(`[Webhook] Agent ${agent} completed task ${task_id}`);
    console.log(`  Run ID: ${run_id}`);
    console.log(`  → Moving to VALIDATION`);
    
    // This would be called by the agent-workflow-hook.js
    // Already handled in that hook
  },
  
  /**
   * New task assigned to Alfred - auto-process backlog
   */
  async task_assigned_to_alfred(payload) {
    const { task_id, column } = JSON.parse(payload);
    
    console.log(`[Webhook] Task ${task_id} assigned to Alfred`);
    console.log(`  Column: ${column}`);
    
    if (column === 'READY') {
      console.log(`  → Alfred should start this task`);
      // Alfred processes on next heartbeat
    }
  },
};

/**
 * Listen to PostgreSQL NOTIFY channels
 */
async function listenToChannels() {
  const pool = new Pool(POOL_CONFIG);
  
  // Connect client for LISTEN
  const client = await pool.connect();
  
  try {
    // Subscribe to channels
    await client.query('LISTEN task_status_changed');
    await client.query('LISTEN agent_work_complete');
    await client.query('LISTEN task_assigned_to_alfred');
    
    console.log('[Webhook Daemon] Listening to PostgreSQL notifications...');
    console.log('  ✓ task_status_changed');
    console.log('  ✓ agent_work_complete');
    console.log('  ✓ task_assigned_to_alfred');
    console.log('');
    
    // Handle notifications
    client.on('notification', (msg) => {
      const { channel, payload } = msg;
      
      if (handlers[channel]) {
        handlers[channel](payload).catch(err => {
          console.error(`[Webhook] Handler error for ${channel}:`, err);
        });
      }
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('[Webhook Daemon] Shutting down...');
      await client.query('UNLISTEN task_status_changed');
      await client.query('UNLISTEN agent_work_complete');
      await client.query('UNLISTEN task_assigned_to_alfred');
      await client.release();
      process.exit(0);
    });
    
    // Keep running
    await new Promise(() => {}); // Never resolves
    
  } catch (error) {
    console.error('[Webhook Daemon] Error:', error);
    await client.release();
    process.exit(1);
  }
}

// CLI execution
if (require.main === module) {
  console.log('[Webhook Daemon] Starting...');
  console.log(`  Workspace: ${WORKSPACE}`);
  console.log(`  Database: ${POOL_CONFIG.database}@${POOL_CONFIG.host}:${POOL_CONFIG.port}`);
  console.log('');
  
  listenToChannels().catch(err => {
    console.error('[Webhook Daemon] Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { listenToChannels, handlers };
