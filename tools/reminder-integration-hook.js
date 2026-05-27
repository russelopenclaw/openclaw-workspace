#!/usr/bin/env node

/**
 * Second Brain - Alfred Integration Hook
 * 
 * Integration point for Alfred main agent to handle "Remind me to..." commands.
 * 
 * This hook is called when the main agent parses a "Remind me" command.
 * It creates the reminder and returns a user-friendly confirmation.
 * 
 * @example
 * // In main agent workflow:
 * const reminderHook = require('./tools/reminder-integration-hook.js');
 * 
 * if (command.type === 'reminder') {
 *   const result = await reminderHook.handle(command);
 *   await message.send({ channel: 'telegram', message: result.message });
 * }
 */

const { parseCommand } = require('./brain-parser-node');
const { handleReminder, checkDueReminders, getAllReminders } = require('./reminder-handler-node');

/**
 * Handle a "Remind me to..." command from user message
 * 
 * @param {string|Object} input - User message string OR parsed command
 * @returns {Promise<{success: boolean, message: string, reminderCount: number}>}
 */
async function handle(input) {
  try {
    // Parse if string input
    let parsed = typeof input === 'string' ? parseCommand(input) : input;
    
    if (!parsed || parsed.type !== 'reminder') {
      return {
        success: false,
        message: 'Not a reminder command'
      };
    }
    
    // Create reminder
    const result = await handleReminder(parsed);
    
    // Get current reminder count
    const allReminders = getAllReminders();
    
    return {
      success: result.success,
      message: result.message,
      reminderCount: allReminders.length
    };
  } catch (error) {
    return {
      success: false,
      message: `Error: ${error.message}`,
      reminderCount: 0
    };
  }
}

/**
 * Quick check for due reminders (for heartbeat)
 * Returns formatted notification message
 * 
 * @returns {Promise<{hasDue: boolean, message: string, count: number}>}
 */
async function check() {
  try {
    const due = checkDueReminders();
    
    if (!due || due.length === 0) {
      return {
        hasDue: false,
        message: 'No reminders due',
        count: 0
      };
    }
    
    let message = '⏰ **Reminders Due:**\n\n';
    due.forEach((r, i) => {
      message += `${i + 1}. ${r.task}\n`;
    });
    
    return {
      hasDue: true,
      message,
      count: due.length
    };
  } catch (error) {
    return {
      hasDue: false,
      message: `Error: ${error.message}`,
      count: 0
    };
  }
}

/**
 * Get status summary
 * 
 * @returns {{total: number, pending: number, notified: number}}
 */
function getStatus() {
  const all = getAllReminders();
  return {
    total: all.length,
    pending: all.filter(r => !r.notified).length,
    notified: all.filter(r => r.notified).length
  };
}

module.exports = {
  handle,
  check,
  getStatus,
  checkDueReminders,
  getAllReminders
};
