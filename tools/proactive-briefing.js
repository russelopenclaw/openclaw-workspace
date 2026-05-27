/**
 * Proactive Briefing Generator
 * 
 * Generates daily briefing for Kevin:
 * - Calendar events today
 * - Weather forecast
 * - Task progress summary
 * - Blockers or issues
 * 
 * Call at 8 AM local time or on-demand.
 * 
 * MIGRATION: 2026-03-05 - Migrated task operations from JSON to PostgreSQL
 * Note: Calendar events and reminders still use JSON files (not part of this migration)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Pool } = require('pg');

const POSTGRES_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'mission_control',
  user: 'alfred',
  password: 'AlfredDB2026Secure'
};

const WORKSPACE = '/home/kevin/.openclaw/workspace';
const CALENDAR_DIR = path.join(WORKSPACE, 'calendar');
const EVENTS_FILE = path.join(CALENDAR_DIR, 'events.json');
const REMINDERS_FILE = path.join(CALENDAR_DIR, 'reminders.json');
const ERRORS_FILE = path.join(WORKSPACE, '.learnings/ERRORS.md');

/**
 * Get today's date info
 */
function getTodayInfo() {
  const now = new Date();
  return {
    date: now.toISOString().split('T')[0],
    dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
    timestamp: now.toISOString()
  };
}

/**
 * Load calendar events for today (still using JSON file)
 */
function getTodayEvents() {
  try {
    if (!fs.existsSync(EVENTS_FILE)) {
      return { events: [], message: 'No calendar events file' };
    }
    
    const data = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
    const today = getTodayInfo().date;
    
    const todaysEvents = (data.events || []).filter(event => {
      const eventDate = event.date || event.start?.split('T')[0];
      return eventDate === today;
    });
    
    return {
      events: todaysEvents,
      count: todaysEvents.length,
      message: todaysEvents.length > 0 
        ? `${todaysEvents.length} event(s) today`
        : 'No events today'
    };
  } catch (error) {
    return { events: [], error: error.message };
  }
}

/**
 * Get reminders due soon (still using JSON file)
 */
function getDueReminders() {
  try {
    if (!fs.existsSync(REMINDERS_FILE)) {
      return { reminders: [], message: 'No reminders file' };
    }
    
    const data = JSON.parse(fs.readFileSync(REMINDERS_FILE, 'utf8'));
    const now = new Date();
    
    const dueReminders = (data.reminders || []).filter(reminder => {
      if (!reminder.dueDate || reminder.notified) return false;
      const dueDate = new Date(reminder.dueDate);
      return dueDate <= now;
    });
    
    return {
      reminders: dueReminders,
      count: dueReminders.length,
      message: dueReminders.length > 0
        ? `${dueReminders.length} reminder(s) due`
        : 'No due reminders'
    };
  } catch (error) {
    return { reminders: [], error: error.message };
  }
}

/**
 * Get task progress summary from PostgreSQL
 */
async function getTaskProgress() {
  const pool = new Pool(POSTGRES_CONFIG);
  
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE column_name = 'done') as done,
        COUNT(*) FILTER (WHERE column_name = 'in-progress') as in_progress,
        COUNT(*) FILTER (WHERE column_name = 'backlog') as backlog,
        COUNT(*) FILTER (WHERE column_name = 'review') as review
      FROM tasks
    `);
    
    const stats = result.rows[0];
    const completionRate = parseInt(stats.total) > 0 
      ? Math.round((parseInt(stats.done) / parseInt(stats.total)) * 100) 
      : 0;
    
    // Get active agents from PostgreSQL
    const agentsResult = await pool.query(`
      SELECT name, current_task 
      FROM agents 
      WHERE status = 'working'
    `);
    
    const activeAgents = agentsResult.rows.map(row => ({
      name: row.name,
      task: row.current_task
    }));
    
    return {
      stats: {
        total: parseInt(stats.total),
        done: parseInt(stats.done),
        inProgress: parseInt(stats.in_progress),
        backlog: parseInt(stats.backlog),
        review: parseInt(stats.review)
      },
      completionRate,
      activeAgents,
      message: `${stats.done}/${stats.total} tasks done (${completionRate}%), ${stats.in_progress} in progress`
    };
  } catch (error) {
    console.error('Failed to get task progress:', error.message);
    return { summary: null, error: error.message };
  } finally {
    await pool.end();
  }
}

/**
 * Generate proactive task suggestions from PostgreSQL data
 */
async function generateProactiveSuggestions() {
  const pool = new Pool(POSTGRES_CONFIG);
  
  try {
    const suggestions = [];
    
    // Get high-priority backlog tasks
    const backlogResult = await pool.query(`
      SELECT id, title, priority, assignee
      FROM tasks
      WHERE column_name = 'backlog'
        AND priority = 'high'
        AND assignee = 'alfred'
      ORDER BY created_at ASC
      LIMIT 5
    `);
    
    const backlogHighPriority = backlogResult.rows;
    
    // Get tasks stuck in progress >1 day
    const stuckResult = await pool.query(`
      SELECT id, title, assignee, started_at,
             EXTRACT(EPOCH FROM (NOW() - started_at)) / 3600 AS hours_in_progress
      FROM tasks
      WHERE column_name = 'in-progress'
        AND started_at < NOW() - INTERVAL '1 day'
      ORDER BY started_at ASC
    `);
    
    const inProgressLongTime = stuckResult.rows;
    
    // Get tasks done but not tested
    const untestedResult = await pool.query(`
      SELECT t.id, t.title
      FROM tasks t
      LEFT JOIN task_history th ON t.id = th.task_id 
        AND (th.note LIKE '%tested%' OR th.note LIKE '%verified%')
      WHERE t.column_name = 'done'
        AND th.task_id IS NULL
      LIMIT 10
    `);
    
    const untestedFeatures = untestedResult.rows;
    
    // Generate suggestions
    
    // Suggestion 1: Complete high-priority backlog
    if (backlogHighPriority.length > 0) {
      suggestions.push({
        priority: 'high',
        category: '🎯 Quick Win',
        title: `Complete high-priority backlog (${backlogHighPriority.length} tasks)`,
        description: `Start with: "${backlogHighPriority[0].title}"`,
        impact: 'Unblocks dependent work, increases completion rate',
        effort: '1-2 hours'
      });
    }
    
    // Suggestion 2: Address stuck in-progress tasks
    if (inProgressLongTime.length > 0) {
      suggestions.push({
        priority: 'high',
        category: '⚠️ Unstick Progress',
        title: `Review ${inProgressLongTime.length} task(s) in progress >1 day`,
        description: `Longest: "${inProgressLongTime[0].title}" (${Math.floor(inProgressLongTime[0].hours_in_progress)}h)`,
        impact: 'Reset stuck agents, reassign if needed, maintain velocity',
        effort: '15 minutes'
      });
    }
    
    // Suggestion 3: Automation improvement
    suggestions.push({
      priority: 'medium',
      category: '🤖 System Improvement',
      title: 'Enhance proactive automation',
      description: 'Add automatic dependency resolution or smart prioritization',
      impact: 'Reduce manual task assignment, improve agent autonomy',
      effort: '2-3 hours'
    });
    
    // Suggestion 4: Quality/Testing
    if (untestedFeatures.length > 0) {
      suggestions.push({
        priority: 'medium',
        category: '✅ Quality Assurance',
        title: `Add E2E tests for ${untestedFeatures.length} completed feature(s)`,
        description: 'Ensure completed work actually functions in production',
        impact: 'Prevent regressions, increase confidence in deployments',
        effort: '1-2 hours'
      });
    }
    
    // Suggestion 5: Documentation/Knowledge
    suggestions.push({
      priority: 'low',
      category: '📚 Knowledge Management',
      title: 'Document system architecture and learnings',
      description: 'Create comprehensive docs for future maintenance and scaling',
      impact: 'Reduce onboarding time, preserve institutional knowledge',
      effort: '2-4 hours'
    });
    
    // Sort by priority and return top 5
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    
    return {
      suggestions: suggestions.slice(0, 5),
      count: suggestions.length,
      message: `${suggestions.length} proactive suggestions generated`
    };
  } catch (error) {
    console.error('Failed to generate suggestions:', error.message);
    return { suggestions: [], error: error.message };
  } finally {
    await pool.end();
  }
}

/**
 * Get weather forecast (via wttr.in)
 */
function getWeather() {
  try {
    const output = execSync('curl -s "wttr.in/60614?format=%C+%t"', {
      encoding: 'utf8',
      timeout: 5000
    }).trim();
    
    return {
      forecast: output,
      message: output || 'Weather data unavailable'
    };
  } catch (error) {
    return { forecast: null, error: error.message };
  }
}

/**
 * Check for blockers/issues
 */
function getBlockers() {
  try {
    if (!fs.existsSync(ERRORS_FILE)) {
      return { blockers: [], message: 'No blockers' };
    }
    
    const content = fs.readFileSync(ERRORS_FILE, 'utf8');
    const lines = content.split('\n');
    
    // Get recent error headers
    const recentErrors = lines
      .filter(line => line.startsWith('##'))
      .slice(0, 5)
      .map(line => line.replace(/^##+\s*/, ''));
    
    return {
      blockers: recentErrors,
      message: recentErrors.length > 0
        ? `${recentErrors.length} recent error(s) to review`
        : 'No recent blockers'
    };
  } catch (error) {
    return { blockers: [], error: error.message };
  }
}

/**
 * Generate full daily briefing
 */
async function generateBriefing() {
  const today = getTodayInfo();
  
  const [events, reminders, tasks, weather, blockers, suggestions] = await Promise.all([
    Promise.resolve(getTodayEvents()),
    Promise.resolve(getDueReminders()),
    getTaskProgress(),
    Promise.resolve(getWeather()),
    Promise.resolve(getBlockers()),
    generateProactiveSuggestions()
  ]);
  
  // Format briefing
  const sections = [];
  
  // Header
  sections.push(`Good morning, Kevin. Here's your briefing for ${today.dayOfWeek}, ${today.date}:\n`);
  
  // Weather
  sections.push(`🌤️ **Weather**: ${weather.message}`);
  
  // Calendar
  if (events.events.length > 0) {
    const eventList = events.events.map(e => `  - ${e.title || e.summary}`).join('\n');
    sections.push(`\n📅 **Calendar** (${events.count} events):\n${eventList}`);
  } else {
    sections.push(`\n📅 **Calendar**: ${events.message}`);
  }
  
  // Reminders
  if (reminders.reminders.length > 0) {
    const reminderList = reminders.reminders.map(r => `  - ${r.task}`).join('\n');
    sections.push(`\n⏰ **Due Reminders**:\n${reminderList}`);
  }
  
  // Task Progress
  sections.push(`\n📊 **Tasks**: ${tasks.message}`);
  if (tasks.activeAgents.length > 0) {
    const agentList = tasks.activeAgents.map(a => `  - **${a.name}**: ${a.task}`).join('\n');
    sections.push(`\n🤖 **Active Agents**:\n${agentList}`);
  }
  
  // Proactive Task Suggestions
  if (suggestions.suggestions.length > 0) {
    sections.push(`\n💡 **Proactive Suggestions** (${suggestions.count} high-impact tasks I identified):\n`);
    suggestions.suggestions.forEach((s, i) => {
      sections.push(`${i + 1}. **${s.category}**: ${s.title}`);
      sections.push(`   ${s.description}`);
      sections.push(`   Impact: ${s.impact}`);
      sections.push(`   Effort: ${s.effort}\n`);
    });
    sections.push(`*Reply with task number(s) and I'll start immediately.*`);
  }
  
  // Blockers
  if (blockers.blockers.length > 0) {
    const blockerList = blockers.blockers.map(b => `  - ${b}`).join('\n');
    sections.push(`\n⚠️ **Recent Issues**:\n${blockerList}`);
  }
  
  // Closing
  sections.push(`\n---\n*I'll check in again this evening with a progress summary.*`);
  
  return {
    ok: true,
    briefing: sections.join('\n'),
    sections: {
      today,
      events,
      reminders,
      tasks,
      weather,
      blockers
    }
  };
}

/**
 * Generate evening summary (what shipped today)
 */
async function generateEveningSummary() {
  const pool = new Pool(POSTGRES_CONFIG);
  const today = getTodayInfo().date;
  
  try {
    // Find tasks completed today from PostgreSQL
    const result = await pool.query(`
      SELECT id, title, column_name, completed_at
      FROM tasks
      WHERE column_name = 'done'
        AND completed_at >= $1::date
    `, [today]);
    
    const completedToday = result.rows;
    
    // Get task progress
    const tasks = await getTaskProgress();
    
    const sections = [];
    sections.push(`Good evening, Kevin. Here's what shipped today:\n`);
    
    if (completedToday.length > 0) {
      const taskList = completedToday.map(t => `✅ **${t.title}**`).join('\n');
      sections.push(taskList);
    } else {
      sections.push('No tasks completed today.');
    }
    
    sections.push(`\nOverall progress: ${tasks.message}`);
    sections.push(`\n---\n*Rest well. I'll have your morning briefing ready at 8 AM.*`);
    
    return {
      ok: true,
      summary: sections.join('\n'),
      completedToday: completedToday.length
    };
  } catch (error) {
    console.error('Failed to generate evening summary:', error.message);
    return {
      ok: false,
      error: error.message,
      summary: 'Failed to generate evening summary'
    };
  } finally {
    await pool.end();
  }
}

module.exports = {
  generateBriefing,
  generateEveningSummary,
  generateProactiveSuggestions,
  getTodayEvents,
  getDueReminders,
  getTaskProgress,
  getWeather,
  getBlockers
};

// Self-test
if (require.main === module) {
  (async () => {
    console.log('Generating proactive briefing...\n');
    const result = await generateBriefing();
    console.log(result.briefing);
  })();
}
