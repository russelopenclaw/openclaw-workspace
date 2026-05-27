#!/usr/bin/env node
/**
 * Telegram /status Command Handler
 * Quick system status check via Telegram
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'mission_control',
  user: 'alfred',
  password: process.env.DB_PASSWORD || 'AlfredDB2026Secure',
});

async function getStatusReport() {
  try {
    // Get task stats
    const taskStats = await pool.query(`
      SELECT column_name, COUNT(*) as count 
      FROM tasks 
      GROUP BY column_name
    `);

    // Get agent status
    const agents = await pool.query(`
      SELECT name, status, current_task, last_activity 
      FROM agents 
      ORDER BY name
    `);

    // Get recent activity
    const recent = await pool.query(`
      SELECT label, task, status, started_at, completed_at
      FROM subagents 
      ORDER BY started_at DESC 
      LIMIT 3
    `);

    // Get recent errors
    const errorLog = await pool.query(`
      SELECT COUNT(*) as count 
      FROM task_history 
      WHERE status = 'error' 
      AND timestamp > NOW() - INTERVAL '24 hours'
    `);

    // Format report
    const tasks = {};
    taskStats.rows.forEach(row => {
      tasks[row.column_name] = parseInt(row.count);
    });

    let report = '📊 **System Status**\n\n';
    report += '**Tasks**:\n';
    report += `  🔄 In Progress: ${tasks['in-progress'] || 0}\n`;
    report += `  📋 Backlog: ${tasks.backlog || 0}\n`;
    report += `  ✅ Done: ${tasks.done || 0}\n\n`;

    report += '**Agents**:\n';
    agents.rows.forEach(agent => {
      const emoji = agent.status === 'working' ? '🟢' : '🟡';
      const time = new Date(agent.last_activity).toLocaleTimeString();
      report += `  ${emoji} ${agent.name}: ${agent.status}\n`;
      report += `     └─ ${agent.current_task || 'Idle'}\n`;
      report += `     └─ Active: ${time}\n`;
    });

    if (recent.rows.length > 0) {
      report += '\n**Recent Activity**:\n';
      recent.rows.forEach((sub, i) => {
        report += `  ${i + 1}. ${sub.label}\n`;
        report += `     └─ ${sub.status}\n`;
      });
    }

    return report;

  } catch (error) {
    console.error('[Status Command] Error:', error);
    return '❌ Error retrieving status: ' + error.message;
  } finally {
    await pool.end();
  }
}

// If run directly from command line
if (require.main === module) {
  getStatusReport().then(report => {
    console.log(report);
  });
}

module.exports = { getStatusReport };
