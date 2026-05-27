#!/usr/bin/env node

/**
 * Second Brain - Reminder Heartbeat Hook
 * 
 * Checks for due reminders and prepares notification for user.
 * Called during heartbeat cycles (2-4 times per day).
 * 
 * Usage:
 * ```bash
 * node tools/reminder-heartbeat-hook.js
 * ```
 * 
 * Output:
 * - Returns JSON with due reminders
 * - Can be called from message.send or notification handlers
 */

const path = require('path');
const { checkDueReminders, markReminderNotified } = require('./reminder-handler-node');

/**
 * Format reminder notification message
 * Format each reminder individually for better readability
 */
function formatNotification(reminder) {
  // Format the due date/time
  const dueDate = new Date(reminder.dueDate);
  const now = new Date();
  const isToday = dueDate.toDateString() === now.toDateString();
  const timeStr = dueDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
  const dateStr = isToday ? 'today' : dueDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
  
  return `⏰ **Reminder Due**

**${reminder.task}**
Scheduled for: ${timeStr} ${dateStr}

Reply "done" when completed.`;
}

/**
 * Main heartbeat function - checks and notifies
 * Returns array of notifications to send
 */
async function checkReminders() {
  try {
    const dueReminders = checkDueReminders();
    
    if (dueReminders.length === 0) {
      return {
        status: 'ok',
        notify: false,
        message: 'No reminders due',
        reminderCount: 0,
        notifications: []
      };
    }
    
    const notifications = [];
    
    // Format each reminder individually
    for (const reminder of dueReminders) {
      const message = formatNotification(reminder);
      notifications.push({
        id: reminder.id,
        task: reminder.task,
        message: message
      });
    }
    
    // Mark reminders as notified
    for (const reminder of dueReminders) {
      markReminderNotified(reminder.id);
      console.log(`✓ Notified: ${reminder.task}`);
    }
    
    return {
      status: 'success',
      notify: true,
      message: notifications.length > 0 
        ? `${notifications.length} reminder(s) due` 
        : 'No reminders due',
      reminderCount: dueReminders.length,
      notifications: notifications
    };
  } catch (error) {
    console.error('Error in reminder heartbeat:', error);
    return {
      status: 'error',
      notify: false,
      message: `Error checking reminders: ${error.message}`,
      reminderCount: 0,
      notifications: []
    };
  }
}

// Run if called directly
if (require.main === module) {
  checkReminders().then(result => {
    console.log('\nResult:', JSON.stringify(result, null, 2));
    process.exit(result.status === 'error' ? 1 : 0);
  });
}

module.exports = {
  checkReminders,
  formatNotification
};
