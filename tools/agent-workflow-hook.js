#!/usr/bin/env node

/**
 * Agent Workflow Hook
 * 
 * Enforces Alfred's workflow protocol:
 * 1. When agent completes → move task to VALIDATION
 * 2. When validation passes → move to DONE
 * 3. When validation fails → move to READY with feedback
 * 
 * Integrates with sub-agent runs to detect completion.
 * 
 * Usage:
 *   // In sub-agent script:
 *   const workflow = require('./tools/agent-workflow-hook.js');
 *   await workflow.onTaskComplete(taskId, deliverablePath);
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

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
 * Called when agent completes task → moves to VALIDATION
 */
async function onTaskComplete(taskId, deliverablePath, runId) {
  console.log(`[WorkflowHook] Task ${taskId} completed by agent → moving to VALIDATION`);
  
  const pool = new Pool(POOL_CONFIG);
  
  try {
    // Move task to VALIDATION column with completion timestamp
    await pool.query(`
      UPDATE tasks 
      SET column_name = 'VALIDATION',
          completed_at = NOW(),
          updated_at = NOW(),
          linked_subagent = COALESCE($1, linked_subagent)
      WHERE id = $2
      RETURNING id, title, column_name, deliverables, validation_criteria
    `, [runId, taskId]);
    
    console.log(`✓ Task ${taskId} moved from IN_PROGRESS to VALIDATION`);
    console.log(`  Deliverable: ${deliverablePath || 'N/A'}`);
    console.log(`  Waiting for Alfred's validation...`);
    
    // Log to history
    await pool.query(`
      INSERT INTO task_history (task_id, action, actor, notes)
      VALUES ($1, 'agent_complete', $2, $3)
    `, [
      taskId,
      `worker-agent:${runId || 'unknown'}`,
      `Completed at ${new Date().toISOString()}, deliverable: ${deliverablePath || 'N/A'}`
    ]);
    
    return { success: true, column: 'VALIDATION' };
    
  } catch (error) {
    console.error('[WorkflowHook] Failed to update task:', error);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

/**
 * Called by Alfred to transition task between states
 */
async function transitionTask(taskId, fromColumn, toColumn, notes = '') {
  const pool = new Pool(POOL_CONFIG);
  
  try {
    await pool.query(`
      UPDATE tasks
      SET column_name = $1, updated_at = NOW()
      WHERE id = $2 AND column_name = $3
      RETURNING id, title, column_name
    `, [toColumn, taskId, fromColumn]);
    
    console.log(`✓ Task ${taskId}: ${fromColumn} → ${toColumn}`);
    if (notes) {
      console.log(`  Notes: ${notes}`);
    }
    
    // Log to history
    await pool.query(`
      INSERT INTO task_history (task_id, action, actor, notes)
      VALUES ($1, 'transition', 'alfred', $2)
    `, [taskId, `${fromColumn} → ${toColumn}: ${notes}`]);
    
    return { success: true, from: fromColumn, to: toColumn };
    
  } catch (error) {
    console.error('[WorkflowHook] Transition failed:', error);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

/**
 * Validate task readiness (called before starting IN_PROGRESS)
 */
async function validateTaskReadiness(taskId) {
  const pool = new Pool(POOL_CONFIG);
  
  try {
    const result = await pool.query(`
      SELECT id, title, deliverables, validation_criteria, column_name
      FROM tasks 
      WHERE id = $1
    `, [taskId]);
    
    if (!result.rows[0]) {
      return { ready: false, reason: 'Task not found' };
    }
    
    const task = result.rows[0];
    
    // Check required fields
    const issues = [];
    
    if (!task.deliverables) {
      issues.push('Missing deliverables field');
    }
    
    if (!task.validation_criteria || task.validation_criteria.length === 0) {
      issues.push('Missing validation_criteria');
    }
    
    if (task.column_name !== 'READY' && task.column_name !== 'BACKLOG') {
      issues.push(`Task is in ${task.column_name}, not READY or BACKLOG`);
    }
    
    return {
      ready: issues.length === 0,
      issue s: issues,
      task,
    };
    
  } catch (error) {
    console.error('[WorkflowHook] Readiness check failed:', error);
    return { ready: false, reason: error.message };
  } finally {
    await pool.end();
  }
}

module.exports = {
  onTaskComplete,
  transitionTask,
  validateTaskReadiness,
};
