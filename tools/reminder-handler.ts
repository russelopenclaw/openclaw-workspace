/**
 * Second Brain - Reminder Handler
 * 
 * Handles "Remind me to [task] [when]" commands
 * 
 * Usage:
 * 1. Parse with brain-parser.ts
 * 2. Call handleReminder with parsed result
 * 3. Reminder saved to /calendar/reminders.json
 * 
 * Examples:
 * - "Remind me to call Kevin at 3pm"
 * - "Remind me to check emails tomorrow morning"
 * - "Remind me to deploy next Monday"
 */

import { ParsedReminder } from './brain-parser';
import { resolveTime, formatDate } from './brain-temporal';
import * as fs from 'fs';
import * as path from 'path';

// File paths
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || '/home/kevin/.openclaw/workspace';
const REMINDERS_FILE = path.join(WORKSPACE_DIR, 'calendar', 'reminders.json');

/**
 * Reminder object structure
 */
export interface Reminder {
  id: string;
  task: string;
  dueDate: string; // ISO timestamp
  createdAt: string; // ISO timestamp
  notified: boolean;
}

/**
 * Reminder file structure
 */
interface RemindersFile {
  reminders: Reminder[];
  metadata: {
    lastUpdated: string;
    version: string;
  };
}

/**
 * Handle "Remind me to..." command
 * 
 * @param parsed - Parsed reminder from brain-parser
 * @returns Promise with success status and message
 */
export async function handleReminder(parsed: ParsedReminder): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Resolve the time expression using temporal resolver
    const resolvedTime = resolveTime(parsed.when);
    
    // 2. Create unique ID
    const id = generateReminderId();
    
    // 3. Create reminder object
    const reminder: Reminder = {
      id,
      task: parsed.task,
      dueDate: resolvedTime.toISOString(),
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
      message: formatSuccessMessage(parsed.task, whenStr)
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to create reminder: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Load reminders from file
 */
function loadReminders(): RemindersFile {
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
function saveReminders(data: RemindersFile): void {
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
function generateReminderId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `rem_${timestamp}_${random}`;
}

/**
 * Format reminder time for display
 */
function formatReminderTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffHours / 24;
  
  // Check if it's today
  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === new Date(now.getTime() + 86400000).toDateString();
  
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
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
}

/**
 * Format day of week
 */
function formatDayOfWeek(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long'
  });
}

/**
 * Format success message for user
 */
function formatSuccessMessage(task: string, when: string): string {
  return `⏰ Reminder set for ${when}: ${task}`;
}

/**
 * Check for due reminders (heartbeat function)
 * 
 * @returns Array of reminders that are due
 */
export function checkDueReminders(): Reminder[] {
  const now = new Date();
  const remindersData = loadReminders();
  const dueReminders: Reminder[] = [];
  
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
export function markReminderNotified(reminderId: string): boolean {
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
export function getAllReminders(): Reminder[] {
  const remindersData = loadReminders();
  return remindersData.reminders;
}

/**
 * Delete a reminder by ID
 */
export function deleteReminder(reminderId: string): boolean {
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
