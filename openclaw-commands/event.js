/**
 * Event Command Handler
 * 
 * Parses "Create event [details]" commands and saves calendar events.
 * Uses temporal resolver to parse natural language time expressions.
 * 
 * Usage:
 *   - "Create event Team meeting tomorrow at 2pm"
 *   - "Create event Doctor appointment next Monday at 10am"
 *   - "Create event Birthday party on March 15th at 6pm"
 */

const fs = require('fs');
const path = require('path');
const { resolveTime, formatDate, getTimeDescription } = require('../tools/temporal-resolver-node.js');
const { parseRecurrence, rruleToHuman, extractTime, extractTimeStrict } = require('../tools/recurrence-parser.js');

// Path to events.json file
const EVENTS_FILE = path.join(__dirname, '..', 'calendar', 'events.json');

/**
 * Generate unique event ID
 * @returns {string} Unique ID
 */
function generateId() {
  return `evt-${Date.now()}`;
}

/**
 * Parse event details from user input
 * @param {string} input - User input after "Create event" prefix
 * @returns {{title: string, when: string, description: string, location: string}} Parsed details
 */
function parseEventDetails(input) {
  const text = input.trim();
  
  // Default values
  let title = text;
  let when = '';
  let description = '';
  let location = '';
  
  // Try to extract time expressions (more specific patterns first)
  const timePatterns = [
    // "tomorrow at 2pm" or "tomorrow 2pm"
    /(tomorrow\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
    // "today at 2pm" or "today 2pm"
    /(today\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
    // "next Monday at 10am" or "next Monday 10am"
    /(next\s+\w+\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
    // "this Monday at 10am" or "this Monday 10am"
    /(this\s+\w+\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
    // "March 15th at 6pm" or "March 15 at 6pm" or "March 15th 6pm" or just "March 15th"
    /((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)/i,
    // "in 2 hours" or "in 30 minutes"
    /(in\s+\d+\s+(?:hour|minute|day|week)s?)/i,
    // Standalone "tomorrow", "today", etc.
    /\b(tomorrow)\b/i,
    /\b(today)\b/i,
    /\b(soon|later|asap)\b/i,
  ];
  
  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      when = match[1];
      // Remove the time expression from title
      title = text.replace(match[1], '').trim();
      break;
    }
  }
  
  // If no time found, default to 'today'
  if (!when) {
    when = 'today';
  }
  
  // Try to extract location (look for "at" followed by a place, but not time-related "at")
  // Avoid matching "at 2pm", "at 10am", etc.
  const locationPattern = /\s+at\s+(?!(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)?|tomorrow|today|next|this))([A-Z][a-zA-Z\s]+)/i;
  const locationMatch = title.match(locationPattern);
  if (locationMatch) {
    location = locationMatch[1].trim();
    title = title.replace(locationPattern, '').trim();
  }
  
  // Clean up extra whitespace in title
  title = title.replace(/\s+/g, ' ').trim();
  
  // Remove trailing prepositions
  title = title.replace(/\s+(on|at|in|for)\s*$/i, '').trim();
  
  return { title, when, description, location };
}

/**
 * Load events from file
 * @returns {{events: Array, metadata: object}} Events data
 */
function loadEvents() {
  try {
    if (!fs.existsSync(EVENTS_FILE)) {
      return { events: [], metadata: { lastUpdated: new Date().toISOString(), version: '1.0' } };
    }
    
    const data = fs.readFileSync(EVENTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading events:', error);
    return { events: [], metadata: { lastUpdated: new Date().toISOString(), version: '1.0' } };
  }
}

/**
 * Save events to file
 * @param {{events: Array, metadata: object}} data - Events data to save
 * @returns {boolean} Success status
 */
function saveEvents(data) {
  try {
    data.metadata.lastUpdated = new Date().toISOString();
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving events:', error);
    return false;
  }
}

/**
 * Format date for user display
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDisplayDate(date) {
  const options = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  };
  
  return date.toLocaleString('en-US', options);
}

/**
 * Calculate end time (default 1 hour after start)
 * @param {Date} startDate - Start date
 * @param {string} inputHint - Optional hint about duration
 * @returns {Date} End date
 */
function calculateEndDate(startDate, inputHint = '') {
  // Check if duration is mentioned
  const durationPatterns = [
    /for\s+(\d+)\s+(hour|minute)s?/i,
    /(\d+)\s+(hour|minute)\s+(long|duration)/i,
  ];
  
  for (const pattern of durationPatterns) {
    const match = inputHint.match(pattern);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      const endDate = new Date(startDate);
      
      if (unit === 'hour') {
        endDate.setHours(endDate.getHours() + value);
      } else if (unit === 'minute') {
        endDate.setMinutes(endDate.getMinutes() + value);
      }
      
      return endDate;
    }
  }
  
  // Default: 1 hour
  const endDate = new Date(startDate);
  endDate.setHours(endDate.getHours() + 1);
  return endDate;
}

/**
 * Process "Create event" command
 * @param {string} input - User input after "Create event" prefix
 * @returns {Promise<{success: boolean, message: string, event?: object}>}
 */
async function processCreateEventCommand(input) {
  const text = input.trim();
  
  if (!text) {
    return {
      success: false,
      message: '❌ Please provide event details. Example: "Create event Team meeting tomorrow at 2pm"',
    };
  }
  
  // Check for recurrence patterns
  const recurrence = parseRecurrence(text);
  
  // Parse event details
  let details = parseEventDetails(text);
  
  // If recurring event, extract title from recurrence pattern
  let title = details.title;
  if (recurrence.matched) {
    // Remove recurrence pattern from title for cleaner display
    // More comprehensive regex to catch all recurrence patterns
    title = text.replace(/every\s+(weekday|\d+\s+weeks?\s+on\s+\w+|\d+(?:st|nd|rd|th)?\s+(?:of\s+)?month|\w+\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\w+)/gi, '').trim();
    // Also remove "create event" prefix
    title = title.replace(/^create\s+event\s+/i, '').trim();
    title = title.replace(/\s+/g, ' ').trim();
    title = title.replace(/\s+(on|at|in|for)\s*$/i, '').trim();
    
    // If title is empty after removing recurrence, use a default
    if (!title || title.length < 3) {
      title = details.title.replace(/^create\s+event\s+/i, '').trim();
    }
  }
  
  // Resolve the time using temporal resolver
  const startDate = resolveTime(details.when);
  const endDate = calculateEndDate(startDate, text);
  
  // Create event object
  const event = {
    id: generateId(),
    title: title,
    description: details.description,
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    location: details.location || undefined,
    createdAt: new Date().toISOString(),
  };
  
  // Add recurrence information if it's a recurring event
  if (recurrence.matched && recurrence.recurrence) {
    event.recurrence = recurrence.recurrence;
    event.recurrenceDescription = recurrence.description;
    
    // Extract time from recurrence if available
    // Don't override if we already have a specific time from the event
    if (recurrence.time && !details.when.match(/\d{1,2}\s*(?:am|pm)/i)) {
      const timeMatch = recurrence.time.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        const ampm = timeMatch[3]?.toLowerCase();
        
        // Validate this is actually a time (has am/pm or is in HH:MM format)
        const isValidTime = ampm || timeMatch[2];
        
        if (isValidTime) {
          if (ampm === 'pm' && hours < 12) {
            hours += 12;
          } else if (ampm === 'am' && hours === 12) {
            hours = 0;
          }
          
          // Update start and end times with the recurrence time
          startDate.setHours(hours, minutes, 0, 0);
          endDate.setHours(hours + 1, minutes, 0, 0);
          event.start = startDate.toISOString();
          event.end = endDate.toISOString();
        }
      }
    }
  }
  
  // Load existing events and add new one
  const data = loadEvents();
  data.events.push(event);
  
  // Save to file
  if (!saveEvents(data)) {
    return {
      success: false,
      message: '❌ Failed to save event to calendar.',
    };
  }
  
  // Build confirmation message
  const formattedDate = formatDisplayDate(startDate);
  let message = recurrence.matched 
    ? `✅ Recurring event created: ${title}\n\n`
    : `✅ Event created: ${title}\n\n`;
  
  message += `📅 ${formattedDate}\n`;
  
  if (recurrence.matched && recurrence.description) {
    const humanReadable = rruleToHuman(recurrence.recurrence);
    message += `🔁 ${humanReadable}\n`;
  }
  
  if (event.location) {
    message += `📍 ${event.location}\n`;
  }
  
  if (event.description) {
    message += `📝 ${event.description}\n`;
  }
  
  return {
    success: true,
    message,
    event,
  };
}

/**
 * Main handler for "Create event" commands
 * @param {string} userInput - Full user input
 * @returns {Promise<{handled: boolean, response?: string}>}
 */
async function handle(userInput) {
  // Check if this is a "Create event" command
  const eventPattern = /^create\s+event\s+(.+)$/i;
  const match = userInput.match(eventPattern);
  
  if (!match) {
    return { handled: false };
  }
  
  const details = match[1];
  const result = await processCreateEventCommand(details);
  
  return {
    handled: true,
    response: result.message,
    event: result.event,
  };
}

// Export for use as module
module.exports = {
  handle,
  processCreateEventCommand,
  parseEventDetails,
  loadEvents,
  saveEvents,
};

// If run directly (for testing)
if (require.main === module) {
  const testInputs = [
    'Create event Team meeting tomorrow at 2pm',
    'Create event Doctor appointment next Monday at 10am',
    'Create event Birthday party on March 15th at 6pm',
    'Create event Quick sync in 2 hours',
  ];
  
  console.log('Testing Event Command Handler\n');
  console.log('=' .repeat(50));
  
  testInputs.forEach(async (input, index) => {
    console.log(`\nTest ${index + 1}: ${input}`);
    console.log('-'.repeat(50));
    
    const result = await handle(input);
    console.log(result.response || 'Not handled');
  });
}
