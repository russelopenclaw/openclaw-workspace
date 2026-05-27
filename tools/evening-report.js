#!/usr/bin/env node
/**
 * Evening Report Generator
 * 
 * Generates an evening summary and queues it for Telegram delivery.
 * Called by OpenClaw cron at 8 PM daily.
 * 
 * Usage: node evening-report.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORKSPACE = '/home/kevin/.openclaw/workspace';
const BRIEFING_QUEUE = path.join(WORKSPACE, '.briefing-queue.json');
const DB_PASS = 'AlfredDB2026Secure';
const DB_CMD = `PGPASSWORD=${DB_PASS} psql -h localhost -U alfred -d mission_control -t -A`;

// Get current date info
function getDateInfo() {
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return {
    dayName: days[now.getDay()],
    month: months[now.getMonth()],
    date: now.getDate(),
    year: now.getFullYear(),
    fullDate: `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`
  };
}

// Get tasks completed today
function getCompletedToday() {
  try {
    const result = execSync(
      `${DB_CMD} -c "SELECT title FROM tasks WHERE column_name = 'done' AND updated_at::date = CURRENT_DATE ORDER BY updated_at DESC;"`,
      { timeout: 5000, encoding: 'utf8' }
    ).trim();
    if (!result) return [];
    return result.split('\n').filter(Boolean);
  } catch (e) {
    return [];
  }
}

// Get tasks moved to in-progress today
function getInProgressToday() {
  try {
    const result = execSync(
      `${DB_CMD} -c "SELECT title, column_name FROM tasks WHERE column_name = 'in-progress' AND updated_at::date = CURRENT_DATE ORDER BY updated_at DESC;"`,
      { timeout: 5000, encoding: 'utf8' }
    ).trim();
    if (!result) return [];
    return result.split('\n').filter(Boolean).map(line => {
      const [title, col] = line.split('|');
      return title;
    });
  } catch (e) {
    return [];
  }
}

// Get overall task stats
function getTaskStats() {
  try {
    const result = execSync(
      `${DB_CMD} -c "SELECT COUNT(*) as total, COUNT(CASE WHEN column_name='done' THEN 1 END) as done, COUNT(CASE WHEN column_name='in-progress' THEN 1 END) as in_progress, COUNT(CASE WHEN column_name='backlog' THEN 1 END) as backlog FROM tasks WHERE column_name NOT IN ('archived');"`,
      { timeout: 5000, encoding: 'utf8' }
    ).trim();
    const [total, done, inProgress, backlog] = result.split('|').map(Number);
    if (total > 0) {
      const pct = Math.round((done / total) * 100);
      return { total, done, inProgress, backlog, pct };
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Get agent status
function getAgentStatus() {
  try {
    const result = execSync(
      `${DB_CMD} -c "SELECT name, status, current_task FROM agents ORDER BY name;"`,
      { timeout: 5000, encoding: 'utf8' }
    ).trim();
    if (!result) return [];
    return result.split('\n').filter(Boolean).map(line => {
      const [name, status, task] = line.split('|');
      return { name, status, task: task || 'idle' };
    });
  } catch (e) {
    return [];
  }
}

// Get new learnings today
function getNewLearnings() {
  try {
    const learningsFile = path.join(WORKSPACE, '.learnings', 'LEARNINGS.md');
    if (!fs.existsSync(learningsFile)) return [];
    const content = fs.readFileSync(learningsFile, 'utf8');
    const today = new Date().toISOString().split('T')[0];
    // Simple heuristic: lines added today (check mtime of file)
    const stat = fs.statSync(learningsFile);
    if (stat.mtime.toISOString().split('T')[0] === today) {
      return ['Learnings file updated today'];
    }
    return [];
  } catch (e) {
    return [];
  }
}

// Get new errors today
function getNewErrors() {
  try {
    const errorsFile = path.join(WORKSPACE, '.learnings', 'ERRORS.md');
    if (!fs.existsSync(errorsFile)) return [];
    const content = fs.readFileSync(errorsFile, 'utf8');
    const today = new Date().toISOString().split('T')[0];
    const stat = fs.statSync(errorsFile);
    if (stat.mtime.toISOString().split('T')[0] === today) {
      // Count active (unresolved) errors
      const activeCount = (content.match(/## \d{4}-\d{2}-\d{2}/g) || []).length;
      return [`${activeCount} error entries`];
    }
    return [];
  } catch (e) {
    return [];
  }
}

// Generate report text
function generateReport() {
  const date = getDateInfo();
  let report = `🌙 **Evening Report — ${date.fullDate}**\n\n`;

  // Completed tasks
  const completed = getCompletedToday();
  if (completed.length > 0) {
    report += `✅ **Completed Today**:\n`;
    for (const task of completed) {
      report += `  - ${task}\n`;
    }
    report += '\n';
  } else {
    report += `✅ **Completed Today**: Nothing new completed\n\n`;
  }

  // In-progress
  const inProgress = getInProgressToday();
  if (inProgress.length > 0) {
    report += `🔄 **In Progress**:\n`;
    for (const task of inProgress) {
      report += `  - ${task}\n`;
    }
    report += '\n';
  }

  // Overall stats
  const stats = getTaskStats();
  if (stats) {
    report += `📊 **Overall Progress**: ${stats.done}/${stats.total} done (${stats.pct}%), ${stats.inProgress} active, ${stats.backlog} in backlog\n\n`;
  }

  // Agent status
  const agents = getAgentStatus();
  if (agents.length > 0) {
    report += `🤖 **Agents**:\n`;
    for (const agent of agents) {
      const icon = agent.status === 'working' ? '🔧' : '💤';
      report += `  - ${icon} **${agent.name}**: ${agent.task}\n`;
    }
    report += '\n';
  }

  // Learnings
  const learnings = getNewLearnings();
  if (learnings.length > 0) {
    report += `📝 **Learnings**: ${learnings.join(', ')}\n\n`;
  }

  // Errors
  const errors = getNewErrors();
  if (errors.length > 0) {
    report += `⚠️ **Errors**: ${errors.join(', ')}\n\n`;
  }

  report += `---\n*Rest well. I'll have your morning briefing ready at 7 AM.*`;

  return report;
}

// Queue report for Telegram delivery
function queueReport(report) {
  let queue = [];
  if (fs.existsSync(BRIEFING_QUEUE)) {
    try {
      queue = JSON.parse(fs.readFileSync(BRIEFING_QUEUE, 'utf8'));
    } catch (e) {
      queue = [];
    }
  }

  queue.push({
    type: 'evening',
    message: report,
    timestamp: new Date().toISOString(),
    target: 'telegram:8177470832',
    sent: false
  });

  fs.writeFileSync(BRIEFING_QUEUE, JSON.stringify(queue, null, 2));
}

// Main
try {
  const report = generateReport();
  console.log(report);
  
  queueReport(report);
  console.log('\n✅ Evening report queued for Telegram delivery');
} catch (e) {
  console.error('Error generating evening report:', e.message);
  process.exit(1);
}