#!/usr/bin/env node
/**
 * Recurring Reminder Manager
 * 
 * Auto-generates next occurrence when a recurring reminder is completed.
 * Called after marking a reminder as completed.
 * 
 * Usage:
 *   const manager = require('./tools/recurring-reminder-manager.js');
 *   await manager.handleRecurringReminder(reminderId);
 */

const { execSync } = require('child_process');
const { getNextOccurrence, rruleToHuman } = require('./recurrence-parser.js');

const DB_CMD = 'PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d mission_control';

/**
 * Handle completion of a potentially recurring reminder
 * @param {string} reminderId - The ID of the completed reminder
 * @returns {object} Result with next occurrence info or null if not recurring
 */
async function handleRecurringReminder(reminderId) {
  try {
    // Fetch the reminder details
    const sql = `SELECT * FROM reminders WHERE id = '${reminderId}'`;
    const result = execSync(`${DB_CMD} -t -A -F '|' -c "${sql}"`, { encoding: 'utf8', stdio: 'pipe' });
    
    const line = result.trim();
    if (!line) {
      return { error: 'Reminder not found' };
    }
    
    const [id, title, dueDate, dueTime, recurringRule, recurringUntil, completed, notifiedAt, description] = line.split('|');
    
    // Check if this is a recurring reminder
    if (!recurringRule || !completed) {
      return { recurring: false };
    }
    
    // Check if we've passed the recurring_until date
    if (recurringUntil) {
      const untilDate = new Date(recurringUntil);
      if (new Date() > untilDate) {
        return { recurring: false, reason: 'Past recurring_until date' };
      }
    }
    
    // Calculate next occurrence
    const currentDate = new Date(`${dueDate}T${dueTime || '12:00'}`);
    const nextDate = getNextOccurrence(recurringRule, currentDate);
    
    if (!nextDate) {
      return { error: 'Could not calculate next occurrence' };
    }
    
    // Generate new reminder ID
    const baseId = id.replace(/-occ-\d+$/, ''); // Remove occurrence suffix if present
    const occurrenceCount = await getOccurrenceCount(baseId);
    const newId = `${baseId}-occ-${occurrenceCount}`;
    
    // Format dates for SQL
    const nextDueDate = nextDate.toISOString().split('T')[0];
    const nextDueTime = dueTime || '09:00:00';
    const humanReadable = rruleToHuman(recurringRule);
    const newTitle = `${title.replace(/\s+\(occ\s+\d+\)$/, '')} (occ ${occurrenceCount})`;
    
    // Insert new reminder
    const insertSql = `INSERT INTO reminders (id, title, due_date, due_time, recurring_rule, recurring_until, description) 
      VALUES ('${newId}', '${newTitle.replace(/'/g, "''")}', '${nextDueDate}', '${nextDueTime}', '${recurringRule}', '${recurringUntil || ''}', '${(description || '').replace(/'/g, "''")}')`;
    
    execSync(`${DB_CMD} -c "${insertSql}"`, { stdio: 'pipe' });
    
    return {
      recurring: true,
      nextId: newId,
      nextDate: nextDueDate,
      nextTime: nextDueTime,
      humanReadable,
      title: newTitle
    };
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * Count existing occurrences for a base reminder ID
 * @param {string} baseId - Base reminder ID (without -occ-N suffix)
 * @returns {number} Next occurrence number
 */
async function getOccurrenceCount(baseId) {
  try {
    const sql = `SELECT COUNT(*) FROM reminders WHERE id LIKE '${baseId}-occ-%'`;
    const result = execSync(`${DB_CMD} -t -c "${sql}"`, { encoding: 'utf8', stdio: 'pipe' });
    return parseInt(result.trim()) + 1;
  } catch (e) {
    return 1;
  }
}

/**
 * Generate upcoming occurrences for display (next N occurrences)
 * @param {string} reminderId - Reminder ID
 * @param {number} count - Number of occurrences to generate
 * @returns {Array} Array of upcoming occurrence dates
 */
function generateUpcomingOccurrences(reminderId, count = 3) {
  try {
    const sql = `SELECT title, due_date, due_time, recurring_rule, recurring_until FROM reminders WHERE id = '${reminderId}'`;
    const result = execSync(`${DB_CMD} -t -A -F '|' -c "${sql}"`, { encoding: 'utf8', stdio: 'pipe' });
    
    const line = result.trim();
    if (!line) {
      return [];
    }
    
    const [title, dueDate, dueTime, recurringRule, recurringUntil] = line.split('|');
    
    if (!recurringRule) {
      return [];
    }
    
    const occurrences = [];
    let nextDate = new Date(`${dueDate}T${dueTime || '12:00'}`);
    const untilDate = recurringUntil ? new Date(recurringUntil) : new Date('2099-12-31');
    
    for (let i = 0; i < count; i++) {
      nextDate = getNextOccurrence(recurringRule, nextDate);
      
      if (!nextDate || nextDate > untilDate) {
        break;
      }
      
      occurrences.push({
        date: nextDate.toISOString().split('T')[0],
        time: dueTime,
        title: title,
        humanReadable: rruleToHuman(recurringRule)
      });
    }
    
    return occurrences;
  } catch (e) {
    console.error('Error generating occurrences:', e.message);
    return [];
  }
}

/**
 * Standalone test mode
 */
async function runStandalone() {
  console.log('🔄 Testing recurring reminder manager...\n');
  
  // Test with the Deacons Meeting reminder
  const testId = 'rem-1772639702287';
  console.log(`Testing with reminder: ${testId}`);
  
  const upcoming = generateUpcomingOccurrences(testId, 5);
  console.log('\n📅 Upcoming occurrences:');
  upcoming.forEach((occ, i) => {
    console.log(`  ${i + 1}. ${occ.date} at ${occ.time} - ${occ.humanReadable}`);
  });
}

module.exports = {
  handleRecurringReminder,
  generateUpcomingOccurrences,
  getOccurrenceCount
};

// CLI mode
if (require.main === module) {
  runStandalone();
}
