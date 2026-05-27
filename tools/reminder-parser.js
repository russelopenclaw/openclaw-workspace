#!/usr/bin/env node

/**
 * Reminder Parser
 * 
 * Parses natural language reminders like:
 * - "Remind me to call Mom at 4:30"
 * - "Remind me to buy milk at 2pm tomorrow"
 * - "Remind me to submit the report at 9:00 AM"
 * 
 * Creates PostgreSQL reminder entry + optional Google Calendar sync
 * 
 * Usage:
 *   const parser = require('./tools/reminder-parser.js');
 *   const result = await parser.parse("Remind me to call Mom at 4:30", 'kevin');
 */

const { Pool } = require('pg');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const POSTGRES_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'mission_control',
  user: 'alfred',
  password: 'AlfredDB2026Secure'
};

/**
 * Parse natural language reminder
 * @param {string} text - User's natural language input
 * @param {string} userId - User identifier (e.g., 'kevin')
 * @returns {Promise<Object>} - Parsed reminder data
 */
async function parse(text, userId = 'kevin') {
  // Pattern: "Remind me to [TASK] at [TIME] [optional: today/tomorrow/DATE]"
  const patterns = [
    {
      // "Remind me to call Mom at 4:30" or "Remind me to call Mom at 4pm"
      regex: /remind me to (.+?) at (\d{1,2}(?::\d{2})?)(?:\s*(am|pm))?(?:\s*(today|tomorrow))?/i,
      extract: (match) => ({
        task: match[1].trim(),
        time: normalizeTime(match[2], match[3]),
        date: match[4] ? resolveDate(match[4]) : resolveDate('today')
      })
    },
    {
      // "Remind me at 4:30 to call Mom" or "Remind me at 2pm to buy milk"
      regex: /remind me at (\d{1,2}(?::\d{2})?)(?:\s*(am|pm))?(?:\s*(today|tomorrow))? to (.+)/i,
      extract: (match) => ({
        task: match[4].trim(),
        time: normalizeTime(match[1], match[2]),
        date: match[3] ? resolveDate(match[3]) : resolveDate('today')
      })
    }
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (match) {
      const extracted = pattern.extract(match);
      return {
        success: true,
        userId,
        title: extracted.task,
        description: `Natural language reminder: "${text}"`,
        due_date: extracted.date,
        due_time: extracted.time,
        parsed_at: new Date().toISOString(),
        original_text: text
      };
    }
  }

  return {
    success: false,
    error: 'No reminder pattern detected',
    suggestions: [
      'Try: "Remind me to [task] at [time]"',
      'Try: "Remind me at [time] to [task]"',
      'Include AM/PM for clarity (e.g., "4:30 PM")'
    ]
  };
}

/**
 * Normalize time to HH:MM:SS format
 * Handles: "4:30", "4", "2pm", "9am", "14:00"
 */
function normalizeTime(timeStr, ampm) {
  let hours, minutes = 0;
  
  if (timeStr.includes(':')) {
    [hours, minutes] = timeStr.split(':').map(Number);
  } else {
    // Handle "2pm" or "9am" or just "14"
    const match = timeStr.match(/^(\d{1,2})(?:\s*(am|pm))?$/i);
    if (match) {
      hours = parseInt(match[1]);
      ampm = ampm || match[2];
    } else {
      hours = parseInt(timeStr);
    }
  }
  
  if (ampm) {
    const lower = ampm.toLowerCase();
    if (lower === 'pm' && hours < 12) hours += 12;
    if (lower === 'am' && hours === 12) hours = 0;
  }
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
}

/**
 * Resolve date keyword to YYYY-MM-DD
 */
function resolveDate(keyword) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  if (keyword === 'tomorrow') {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  
  return today;
}

/**
 * Insert reminder into PostgreSQL
 */
async function insertReminder(parsedData) {
  if (!parsedData.success) {
    throw new Error('Cannot insert: parsing failed');
  }

  const pool = new Pool(POSTGRES_CONFIG);
  
  try {
    // Generate ID from title + date (e.g., "call-mom-2026-03-18")
    const id = parsedData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 30) + '-' + parsedData.due_date;
    
    const query = `
      INSERT INTO reminders (
        id,
        title, 
        description, 
        due_date, 
        due_time,
        completed,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())
      RETURNING id, title, due_date, due_time, created_at;
    `;
    
    const values = [
      id,
      parsedData.title,
      parsedData.description,
      parsedData.due_date,
      parsedData.due_time
    ];
    
    const result = await pool.query(query, values);
    return {
      success: true,
      reminder: result.rows[0],
      message: `✅ Reminder created: "${parsedData.title}" at ${parsedData.due_time} on ${parsedData.due_date}`
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      query: error.query
    };
  } finally {
    await pool.end();
  }
}

/**
 * Sync to Google Calendar (optional - requires OAuth setup)
 */
async function syncToGoogleCalendar(reminderId, title, dueDate, dueTime) {
  // TODO: Implement GCal API integration
  // Requires: gcal OAuth credentials, calendar ID
  // Creates event with reminder at due_date + due_time
  console.log('[TODO] Google Calendar sync not yet implemented');
  return { synced: false, reason: 'Not implemented' };
}

/**
 * Main entry point
 */
async function createReminder(text, userId = 'kevin') {
  console.log(`[Reminder Parser] Processing: "${text}"`);
  
  // Step 1: Parse natural language
  const parsed = await parse(text, userId);
  
  if (!parsed.success) {
    console.log('[Reminder Parser] Parse failed:', parsed.error);
    return parsed;
  }
  
  console.log('[Reminder Parser] Parsed:', parsed);
  
  // Step 2: Insert into PostgreSQL
  const result = await insertReminder(parsed);
  
  if (result.success) {
    console.log('[Reminder Parser]', result.message);
    
    // Step 3: Optional GCal sync (future)
    // await syncToGoogleCalendar(result.reminder.id, parsed.title, parsed.due_date, parsed.due_time);
  }
  
  return result;
}

module.exports = {
  parse,
  insertReminder,
  createReminder,
  syncToGoogleCalendar
};

// CLI usage
if (require.main === module) {
  const text = process.argv[2];
  if (!text) {
    console.log('Usage: node tools/reminder-parser.js "Remind me to call Mom at 4:30"');
    process.exit(1);
  }
  
  createReminder(text).then(result => {
    console.log(JSON.stringify(result, null, 2));
  }).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}
