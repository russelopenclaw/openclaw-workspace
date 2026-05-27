#!/usr/bin/env node
/**
 * PostgreSQL Data Migration Script
 * Migrates JSON data from old file-based system to PostgreSQL
 */

const fs = require('fs');
const { Pool } = require('pg');
const path = require('path');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'mission_control',
  user: 'alfred',
  password: 'AlfredDB2026Secure',
});

const WORKSPACE = '/home/kevin/.openclaw/workspace';

async function migrateAgents() {
  console.log('📊 Migrating agents...');
  const agentStatus = JSON.parse(fs.readFileSync(path.join(WORKSPACE, 'alfred-hub/agent-status.json'), 'utf8'));
  
  for (const [name, data] of Object.entries(agentStatus.agents)) {
    await pool.query(
      `INSERT INTO agents (name, status, current_task, last_activity)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO UPDATE SET
         status = $2,
         current_task = $3,
         last_activity = $4`,
      [name, data.status, data.currentTask, data.lastActivity]
    );
    console.log(`  ✅ Agent: ${name}`);
  }
}

async function migrateTasks() {
  console.log('📋 Migrating tasks...');
  const tasksData = JSON.parse(fs.readFileSync(path.join(WORKSPACE, 'kanban/tasks.json'), 'utf8'));
  
  let migrated = 0;
  let historyMigrated = 0;
  
  for (const task of tasksData.tasks) {
    // Map 'column' field carefully (reserved word)
    await pool.query(
      `INSERT INTO tasks (
         id, title, column_name, assignee, priority, description,
         parent_task_id, linked_subagent, created_at, started_at, completed_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
         title = $2,
         column_name = $3,
         assignee = $4,
         priority = $5,
         description = $6,
         updated_at = NOW()`,
      [
        task.id,
        task.title,
        task.column,  // Maps to column_name
        task.assignee || null,
        task.priority,
        task.description || null,
        null,  // parent_task_id (not in current schema)
        task.linkedSubagent || null,
        task.createdAt,
        task.startedAt || null,
        task.completedAt || null,
        new Date().toISOString()
      ]
    );
    migrated++;
    
    // Migrate task history
    if (task.history && task.history.length > 0) {
      for (const hist of task.history) {
        await pool.query(
          `INSERT INTO task_history (task_id, status, timestamp, note)
           VALUES ($1, $2, $3, $4)`,
          [task.id, hist.status, hist.timestamp, hist.note]
        );
        historyMigrated++;
      }
    }
  }
  
  console.log(`  ✅ Tasks: ${migrated} rows`);
  console.log(`  ✅ History: ${historyMigrated} rows`);
}

async function migrateSubagents() {
  console.log('🤖 Migrating subagents...');
  const subagentsData = JSON.parse(fs.readFileSync(path.join(WORKSPACE, 'kanban/subagents.json'), 'utf8'));
  
  let migrated = 0;
  
  // Migrate active subagents
  for (const sub of subagentsData.active || []) {
    await pool.query(
      `INSERT INTO subagents (run_id, label, task, status, runtime, total_tokens, started_at, completed_at, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (run_id) DO UPDATE SET
         status = $4,
         task = $3`,
      [
        sub.runId,
        sub.label,
        sub.task,
        sub.status,
        sub.runtime || null,
        sub.totalTokens || 0,
        sub.startedAt,
        sub.completedAt || null,
        sub.note || null
      ]
    );
    migrated++;
  }
  
  // Migrate recent subagents
  for (const sub of subagentsData.recent || []) {
    await pool.query(
      `INSERT INTO subagents (run_id, label, task, status, runtime, total_tokens, started_at, completed_at, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (run_id) DO NOTHING`,
      [
        sub.runId,
        sub.label,
        sub.task,
        sub.status,
        sub.runtime || null,
        sub.totalTokens || 0,
        sub.startedAt,
        sub.completedAt || null,
        sub.note || null
      ]
    );
    migrated++;
  }
  
  console.log(`  ✅ Subagents: ${migrated} rows`);
}

async function verifyMigration() {
  console.log('🔍 Verifying migration...');
  
  const counts = {
    agents: await pool.query('SELECT COUNT(*) FROM agents'),
    tasks: await pool.query('SELECT COUNT(*) FROM tasks'),
    subagents: await pool.query('SELECT COUNT(*) FROM subagents'),
    history: await pool.query('SELECT COUNT(*) FROM task_history'),
  };
  
  console.log('\n📊 Migration Results:');
  console.log(`  Agents: ${counts.agents.rows[0].count}`);
  console.log(`  Tasks: ${counts.tasks.rows[0].count}`);
  console.log(`  Subagents: ${counts.subagents.rows[0].count}`);
  console.log(`  Task History: ${counts.history.rows[0].count}`);
  
  return counts;
}

async function main() {
  console.log('🚀 Starting PostgreSQL Data Migration...\n');
  
  try {
    await migrateAgents();
    console.log('');
    await migrateTasks();
    console.log('');
    await migrateSubagents();
    console.log('');
    const counts = await verifyMigration();
    
    console.log('\n✅ MIGRATION COMPLETE!');
    console.log(`Total rows migrated: ${
      parseInt(counts.agents.rows[0].count) +
      parseInt(counts.tasks.rows[0].count) +
      parseInt(counts.subagents.rows[0].count) +
      parseInt(counts.history.rows[0].count)
    }`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
