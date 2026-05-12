/**
 * Second Brain - Recurrence Pattern Parser
 * 
 * Parses natural language recurrence patterns into RRULE-like format:
 * - "Every Monday at 9am" → FREQ=WEEKLY;BYDAY=MO
 * - "Every weekday at 8am" → FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR
 * - "Every 1st of month at 6pm" → FREQ=MONTHLY;BYMONTHDAY=1
 * - "Every 2 weeks on Friday" → FREQ=WEEKLY;INTERVAL=2;BYDAY=FR
 */

/**
 * Day name to RRULE day code mapping
 */
const DAY_CODES = {
  sunday: 'SU',
  monday: 'MO',
  tuesday: 'TU',
  wednesday: 'WE',
  thursday: 'TH',
  friday: 'FR',
  saturday: 'SA'
};

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Parse recurrence pattern from text
 * @param {string} text - Text containing recurrence pattern
 * @returns {{recurrence: string|null, time: string|null, description: string, matched: boolean}} Parsed recurrence info
 */
function parseRecurrence(text) {
  const normalized = text.toLowerCase().trim();
  
  // Pattern: "Every [N] [week|month|year] on [Day]" or "Every [Day] at [time]"
  // Pattern: "Every weekday at [time]"
  // Pattern: "Every [ordinal] of month at [time]"
  
  let recurrence = null;
  let time = null;
  let description = '';
  let matched = false;
  
  // Try each pattern in order of specificity
  
  // 1. "Every weekday at [time]" - special case for Monday-Friday
  const weekdayPattern = /every\s+weekday\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
  let match = normalized.match(weekdayPattern);
  if (match) {
    time = match[1] || '9am';
    recurrence = 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
    description = 'Every weekday';
    matched = true;
  }
  
  // 2. "Every [N] weeks on [Day]" - e.g., "Every 2 weeks on Friday"
  if (!matched) {
    const weeksPattern = /every\s+(\d+)\s+weeks?\s+(?:on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i;
    match = normalized.match(weeksPattern);
    if (match) {
      const interval = match[1];
      const day = match[2].toUpperCase();
      const dayCode = DAY_CODES[day.toLowerCase()];
      time = extractTime(normalized);
      recurrence = `FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${dayCode}`;
      description = `Every ${interval} weeks on ${match[2]}`;
      matched = true;
    }
  }
  
  // 3. "Every [N] months on [Day]" or "Every [N]th of month"
  if (!matched) {
    const monthOrdinalPattern = /every\s+(?:(\d+)(?:st|nd|rd|th))\s+(?:of\s+)?month(?:\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?/i;
    match = normalized.match(monthOrdinalPattern);
    if (match) {
      const day = parseInt(match[1]);
      // Extract time from the match if present, otherwise search the whole text
      time = match[2] || extractTimeStrict(normalized);
      recurrence = `FREQ=MONTHLY;BYMONTHDAY=${day}`;
      description = `Every ${day}${getOrdinalSuffix(day)} of month`;
      matched = true;
    }
  }
  
  // 4. "Every [N] months" (without specific day)
  if (!matched) {
    const monthsPattern = /every\s+(\d+)\s+months?(?:\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?/i;
    match = normalized.match(monthsPattern);
    if (match) {
      const interval = match[1];
      // Extract time from the match if present
      time = match[2] || extractTimeStrict(normalized);
      recurrence = `FREQ=MONTHLY;INTERVAL=${interval}`;
      description = `Every ${interval} months`;
      matched = true;
    }
  }
  
  // 5. "Every [N] years" 
  if (!matched) {
    const yearsPattern = /every\s+(\d+)\s+years?(?:\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?/i;
    match = normalized.match(yearsPattern);
    if (match) {
      const interval = match[1];
      time = match[2] || extractTimeStrict(normalized);
      recurrence = `FREQ=YEARLY;INTERVAL=${interval}`;
      description = `Every ${interval} years`;
      matched = true;
    }
  }
  
  // 6. "Every [N] weeks" (without specific day)
  if (!matched) {
    const simpleWeeksPattern = /every\s+(\d+)\s+weeks?(?:\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?/i;
    match = normalized.match(simpleWeeksPattern);
    if (match) {
      const interval = match[1];
      time = match[2] || extractTimeStrict(normalized);
      recurrence = `FREQ=WEEKLY;INTERVAL=${interval}`;
      description = `Every ${interval} weeks`;
      matched = true;
    }
  }
  
  // 7. "Every [Day] at [time]" - e.g., "Every Monday at 9am"
  if (!matched) {
    const dayPattern = /every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
    match = normalized.match(dayPattern);
    if (match) {
      const day = match[1].toLowerCase();
      const dayCode = DAY_CODES[day];
      time = match[2] || '9am';
      recurrence = `FREQ=WEEKLY;BYDAY=${dayCode}`;
      description = `Every ${match[1]}`;
      matched = true;
    }
  }
  
  // 8. "Every week" (simple weekly)
  if (!matched) {
    const weekPattern = /every\s+week/i;
    match = normalized.match(weekPattern);
    if (match) {
      time = extractTime(normalized);
      recurrence = 'FREQ=WEEKLY';
      description = 'Every week';
      matched = true;
    }
  }
  
  // 9. "Every day" 
  if (!matched) {
    const dayPattern = /every\s+day/i;
    match = normalized.match(dayPattern);
    if (match) {
      time = extractTime(normalized);
      recurrence = 'FREQ=DAILY';
      description = 'Every day';
      matched = true;
    }
  }
  
  return {
    recurrence,
    time,
    description,
    matched
  };
}

/**
 * Extract time from recurrence text (strict - requires am/pm or colon)
 * @param {string} text - Text containing time expression
 * @returns {string|null} Extracted time or null
 */
function extractTimeStrict(text) {
  // Match time patterns with am/pm or with colon (HH:MM format)
  const timePattern = /(\d{1,2}(?::\d{2})\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))/i;
  const match = text.match(timePattern);
  return match ? match[1] : null;
}

/**
 * Extract time from recurrence text (lenient - matches any number)
 * @param {string} text - Text containing time expression
 * @returns {string|null} Extracted time or null
 */
function extractTime(text) {
  const timePattern = /(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
  const match = text.match(timePattern);
  return match ? match[1] : null;
}

/**
 * Get ordinal suffix for a number
 * @param {number} num - Number
 * @returns {string} Ordinal suffix (st, nd, rd, th)
 */
function getOrdinalSuffix(num) {
  if (num >= 11 && num <= 13) {
    return 'th';
  }
  switch (num % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

/**
 * Parse RRULE string into human-readable format
 * @param {string} rrule - RRULE string
 * @returns {string} Human-readable description
 */
function rruleToHuman(rrule) {
  if (!rrule) return '';
  
  const parts = rrule.split(';');
  const freq = parts.find(p => p.startsWith('FREQ='))?.split('=')[1];
  const interval = parts.find(p => p.startsWith('INTERVAL='))?.split('=')[1];
  const byday = parts.find(p => p.startsWith('BYDAY='))?.split('=')[1];
  const bymonthday = parts.find(p => p.startsWith('BYMONTHDAY='))?.split('=')[1];
  
  let description = '';
  
  if (freq === 'DAILY') {
    description = 'Daily';
  } else if (freq === 'WEEKLY') {
    if (interval) {
      description = `Every ${interval} weeks`;
    } else {
      description = 'Weekly';
    }
    if (byday) {
      const days = byday.split(',').map(code => {
        return Object.keys(DAY_CODES).find(key => DAY_CODES[key] === code);
      }).filter(Boolean);
      if (days.length === 5 && days.every(d => ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(d))) {
        description = 'Every weekday';
      } else if (days.length === 1) {
        description += ` on ${days[0]}`;
      }
    }
  } else if (freq === 'MONTHLY') {
    if (interval) {
      description = `Every ${interval} months`;
    } else {
      description = 'Monthly';
    }
    if (byday && /^\d[TUWFSM]{2}$/.test(byday)) {
      // Ordinal weekday pattern (e.g., 3TU = 3rd Tuesday)
      const ordinal = parseInt(byday.charAt(0));
      const dayCode = byday.substring(1);
      const dayName = Object.keys(DAY_CODES).find(key => DAY_CODES[key] === dayCode);
      description += ` on the ${ordinal}${getOrdinalSuffix(ordinal)} ${dayName}`;
    } else if (bymonthday) {
      const day = parseInt(bymonthday);
      description += ` on the ${day}${getOrdinalSuffix(day)}`;
    }
  } else if (freq === 'YEARLY') {
    if (interval) {
      description = `Every ${interval} years`;
    } else {
      description = 'Yearly';
    }
  }
  
  return description;
}

/**
 * Calculate next occurrence of a recurring event
 * @param {string} rrule - RRULE string
 * @param {Date} fromDate - Start calculating from this date
 * @returns {Date|null} Next occurrence date or null
 */
function getNextOccurrence(rrule, fromDate = new Date()) {
  if (!rrule) return null;
  
  const parts = rrule.split(';');
  const freq = parts.find(p => p.startsWith('FREQ='))?.split('=')[1];
  const interval = parseInt(parts.find(p => p.startsWith('INTERVAL='))?.split('=')[1]) || 1;
  const byday = parts.find(p => p.startsWith('BYDAY='))?.split('=')[1];
  const bymonthday = parseInt(parts.find(p => p.startsWith('BYMONTHDAY='))?.split('=')[1]);
  
  const result = new Date(fromDate);
  
  if (freq === 'DAILY') {
    result.setDate(result.getDate() + interval);
  } else if (freq === 'WEEKLY') {
    // Handle multiple days (e.g., MO,TU,WE,TH,FR for weekdays)
    if (byday && byday.includes(',')) {
      const days = byday.split(',');
      
      // Find the next matching day
      let daysToAdd = 1;
      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(fromDate);
        checkDate.setDate(checkDate.getDate() + daysToAdd);
        const checkDay = checkDate.getDay();
        const dayCode = Object.values(DAY_CODES)[checkDay];
        
        if (days.includes(dayCode)) {
          result.setDate(result.getDate() + daysToAdd);
          // Preserve the time from fromDate
          result.setHours(fromDate.getHours(), fromDate.getMinutes(), fromDate.getSeconds(), fromDate.getMilliseconds());
          break;
        }
        daysToAdd++;
      }
    } else {
      // Single day or interval-based
      result.setDate(result.getDate() + (interval * 7));
      
      // Adjust to specific day if BYDAY is set
      if (byday) {
        const targetDay = Object.keys(DAY_CODES).find(key => DAY_CODES[key] === byday);
        if (targetDay) {
          const targetDayIndex = DAY_NAMES.indexOf(targetDay);
          const currentDay = result.getDay();
          const diff = targetDayIndex - currentDay;
          result.setDate(result.getDate() + diff);
        }
      }
    }
  } else if (freq === 'MONTHLY') {
    // Check for ordinal weekday pattern (e.g., BYDAY=3TU for 3rd Tuesday)
    if (byday && /^\d[TUWFSM]{2}$/.test(byday)) {
      const ordinal = parseInt(byday.charAt(0));
      const dayCode = byday.substring(1);
      const targetDay = Object.keys(DAY_CODES).find(key => DAY_CODES[key] === dayCode);
      
      if (targetDay) {
        const targetDayIndex = DAY_NAMES.indexOf(targetDay);
        
        // Move to next month
        result.setMonth(result.getMonth() + interval);
        result.setDate(1); // Start from first of month
        
        // Find the nth occurrence of the target day
        let foundCount = 0;
        let dayOfMonth = 1;
        const daysInMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
        
        while (dayOfMonth <= daysInMonth && foundCount < ordinal) {
          const checkDate = new Date(result.getFullYear(), result.getMonth(), dayOfMonth);
          if (checkDate.getDay() === targetDayIndex) {
            foundCount++;
            if (foundCount === ordinal) {
              result.setDate(dayOfMonth);
              break;
            }
          }
          dayOfMonth++;
        }
      }
    } else if (bymonthday) {
      result.setDate(bymonthday);
    } else {
      result.setMonth(result.getMonth() + interval);
    }
  } else if (freq === 'YEARLY') {
    result.setFullYear(result.getFullYear() + interval);
  }
  
  return result;
}

module.exports = {
  parseRecurrence,
  extractTime,
  getOrdinalSuffix,
  rruleToHuman,
  getNextOccurrence,
  DAY_CODES
};
