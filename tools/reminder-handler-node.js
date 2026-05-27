/**
 * Second Brain - Reminder Handler (JavaScript Version)
 * 
 * Node.js compatible reminder handler for runtime use.
 * Handles "Remind me to [task] [when]" commands.
 * 
 * Usage:
 * ```javascript
 * const reminderHandler = require('./tools/reminder-handler-node.js');
 * 
 * // Create reminder
 * const result = await reminderHandler.handleReminder({
 *   task: 'call Kevin',
 *   when: 'at 3pm'
 * });
 * 
 * // Check due reminders (heartbeat)
 * const due = reminderHandler.checkDueReminders();
 * ```
 */

const fs = require('fs');
const path = require('path');
const { resolveTime, formatDate } = require('./temporal-resolver-node');

// File paths
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || '/home/kevin/.openclaw/workspace';
const REMINDERS_FILE = path.join(WORKSPACE_DIR, 'calendar', 'reminders.json');

/**
 * Handle "Remind me to..." command
 * 
 * @param {Object} parsed - Parsed reminder with task and when
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function handleReminder(parsed) {
  try {
    // 1. Resolve the time expression using temporal resolver
    const resolvedTime = resolveTime(parsed.when);
    
    // 2. Create unique ID
    const id = generateReminderId();
    const isoTime = resolvedTime.toISOString();
    
    // 3. Create reminder object
    const reminder = {
      id,
      task: parsed.task,
      dueDate: isoTime,
      createdAt: new Date().toISOString(),
      notified: false
    };
    
    // 4. Load existing reminders
    const remindersData = loadReminders();
    
    // 5. Add new reminder
    remindersData.reminders.push(reminder);
    
    // 6. Update metadata and save
    remindersData.metadata.lastUpdated = new Date().toISOString();
    saveReminders(remindersData);
    
    // 7. Format confirmation message
    const whenStr = formatReminderTime(resolvedTime);
    
    return {
      success: true,
      message: `⏰ Reminder set for ${whenStr}: ${parsed.task}`
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to create reminder: ${error.message || 'Unknown error'}`
    };
  }
}

/**
 * Load reminders from file
 */
function loadReminders() {
  try {
    if (fs.existsSync(REMINDERS_FILE)) {
      const content = fs.readFileSync(REMINDERS_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('Error loading reminders:', error);
  }
  
  // Return default structure
  return {
    reminders: [],
    metadata: {
      lastUpdated: new Date().toISOString(),
      version: '1.0'
    }
  };
}

/**
 * Save reminders to file
 */
function saveReminders(data) {
  try {
    // Ensure directory exists
    const dir = path.dirname(REMINDERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(REMINDERS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving reminders:', error);
    throw new Error('Failed to save reminders to disk');
  }
}

/**
 * Generate unique reminder ID
 */
function generateReminderId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `rem_${timestamp}_${random}`;
}

/**
 * Format reminder time for display
 */
function formatReminderTime(date) {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffHours / 24;
  
  const isToday = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now.getTime() + 86400000);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  
  if (isToday) {
    return `today at ${formatTime(date)}`;
  } else if (isTomorrow) {
    return `tomorrow at ${formatTime(date)}`;
  } else if (diffDays < 7) {
    return `on ${formatDayOfWeek(date)} at ${formatTime(date)}`;
  } else {
    return formatDate(date);
  }
}

/**
 * Format time string from date
 */
function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
}

/**
 * Format day of week
 */
function formatDayOfWeek(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long'
  });
}

/**
 * Check for due reminders (heartbeat function)
 * 
 * @returns {Array} Array of reminders that are due
 */
function checkDueReminders() {
  const now = new Date();
  const remindersData = loadReminders();
  const dueReminders = [];
  
  for (const reminder of remindersData.reminders) {
    // Skip already notified reminders
    if (reminder.notified) {
      continue;
    }
    
    const dueDate = new Date(reminder.dueDate);
    
    // Check if reminder is due (within next 5 minutes window)
    const diffMs = dueDate.getTime() - now.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    
    // Due if: before now OR within next 5 minutes
    if (diffMinutes <= 5) {
      dueReminders.push(reminder);
    }
  }
  
  return dueReminders;
}

/**
 * Mark reminder as notified
 */
function markReminderNotified(reminderId) {
  const remindersData = loadReminders();
  let found = false;
  
  for (const reminder of remindersData.reminders) {
    if (reminder.id === reminderId) {
      reminder.notified = true;
      found = true;
      break;
    }
  }
  
  if (found) {
    remindersData.metadata.lastUpdated = new Date().toISOString();
    saveReminders(remindersData);
  }
  
  return found;
}

/**
 * Get all reminders (for debugging/inspection)
 */
function getAllReminders() {
  const remindersData = loadReminders();
  return remindersData.reminders;
}

/**
 * Delete a reminder by ID
 */
function deleteReminder(reminderId) {
  const remindersData = loadReminders();
  const initialLength = remindersData.reminders.length;
  
  remindersData.reminders = remindersData.reminders.filter(r => r.id !== reminderId);
  
  if (remindersData.reminders.length < initialLength) {
    remindersData.metadata.lastUpdated = new Date().toISOString();
    saveReminders(remindersData);
    return true;
  }
  
  return false;
}

module.exports = {
  handleReminder,
  checkDueReminders,
  markReminderNotified,
  getAllReminders,
  deleteReminder,
  loadReminders
};
