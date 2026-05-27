#!/usr/bin/env node
/**
 * Simple Reminder Checker - Sends alerts ONLY when reminders are due within 30 min
 * No spammy "check" messages - silent unless there's something to report
 * 
 * Usage: node tools/simple-reminder-check.js
 * Output: JSON {found: true/false, message: "..."} for caller to handle
 */

const { execSync } = require('child_process');

const DB_CMD = 'PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d mission_control';

/**
 * Check for due reminders
 */
async function checkReminders() {
  try {
    // Get reminders due within next 30 minutes (or already due but not notified)
    const sql = `
      SELECT id, title, due_date, due_time, description 
      FROM reminders 
      WHERE completed = false 
        AND (
          (due_date = CURRENT_DATE AND due_time BETWEEN CURRENT_TIME AND (CURRENT_TIME + INTERVAL '30 minutes'))
          OR (due_date = CURRENT_DATE AND due_time < CURRENT_TIME AND notified_at IS NULL)
        )
      ORDER BY due_date, due_time
    `;
    
    const result = execSync(`${DB_CMD} -t -A -F '|' -c "${sql}"`, { encoding: 'utf8', stdio: 'pipe' });
    const lines = result.trim().split('\n').filter(l => l);
    
    if (lines.length === 0) {
      // Silent - nothing to report
      console.log(JSON.stringify({ found: false }));
      return;
    }
    
    // Build alert message
    const now = new Date();
    const messages = [];
    
    for (const line of lines) {
      const [id, title, dueDate, dueTime, description] = line.split('|');
      const dueDateTime = new Date(`${dueDate}T${dueTime}`);
      const minutesUntil = Math.round((dueDateTime - now) / 60000);
      
      let timeText;
      if (minutesUntil <= 0) {
        timeText = `**NOW**`;
      } else if (minutesUntil < 60) {
        timeText = `in ${minutesUntil} minutes`;
      } else {
        const hours = Math.floor(minutesUntil / 60);
        const mins = minutesUntil % 60;
        timeText = `in ${hours}h ${mins > 0 ? mins + 'm' : ''}`;
      }
      
      messages.push(`🔔 **${title}**\n⏰ ${timeText}\n${description ? `📝 ${description}` : ''}`);
    }
    
    const fullMessage = messages.join('\n\n');
    
    // Output as JSON for caller to parse and send via message tool
    console.log(JSON.stringify({
      found: true,
      count: messages.length,
      message: fullMessage,
      action: 'send-telegram',
      target: '8177470832'
    }));
    
    // Mark as notified
    const ids = lines.map(l => l.split('|')[0]).join("','");
    execSync(`${DB_CMD} -c "UPDATE reminders SET notified_at = NOW() WHERE id IN ('${ids}') AND notified_at IS NULL"`, { stdio: 'pipe' });
    
  } catch (e) {
    console.error('Error checking reminders:', e.message);
    console.log(JSON.stringify({ found: false, error: e.message }));
  }
}

// Run
checkReminders();
