/**
 * Second Brain - Temporal Expression Resolver (JavaScript Version)
 * 
 * Converts fuzzy time expressions to concrete dates:
 * - "this afternoon" → Today 3:00 PM
 * - "tomorrow morning" → Tomorrow 9:00 AM
 * - "in 2 hours" → Now + 2 hours
 */

/**
 * Resolve a natural language time expression to a concrete Date
 * @param {string} expression - Time expression to resolve
 * @param {Date} baseDate - Base date for calculations (default: now)
 * @returns {Date} Resolved date
 */
function resolveTime(expression, baseDate = new Date()) {
  const normalized = expression.toLowerCase().trim();
  
  // Try each resolver in order
  const resolvers = [
    () => resolveRelativeTime(normalized, baseDate),
    () => resolveDayOfWeek(normalized, baseDate),
    () => resolveAbsoluteDate(normalized, baseDate),
    () => resolveTimeOfDay(normalized, baseDate),
    () => resolveFuzzyTime(normalized, baseDate)
  ];
  
  for (const resolver of resolvers) {
    const result = resolver();
    if (result) {
      return result;
    }
  }
  
  // Fallback: return baseDate
  console.warn(`Could not resolve time expression: "${expression}"`);
  return baseDate;
}

/**
 * Resolve relative time expressions
 * - "in 2 hours"
 * - "in 30 minutes"
 * - "tomorrow"
 */
function resolveRelativeTime(expr, base) {
  // "in X hours/minutes/days"
  const inPattern = /in (\d+) (hour|minute|day|week)s?/i;
  const inMatch = expr.match(inPattern);
  if (inMatch) {
    const value = parseInt(inMatch[1]);
    const unit = inMatch[2].toLowerCase();
    const result = new Date(base);
    
    switch (unit) {
      case 'hour': result.setHours(result.getHours() + value); break;
      case 'minute': result.setMinutes(result.getMinutes() + value); break;
      case 'day': result.setDate(result.getDate() + value); break;
      case 'week': result.setDate(result.getDate() + value * 7); break;
    }
    
    return result;
  }
  
 // "X hours/minutes/days" (without "in")
  const justPattern = /(\d+) (hour|minute|day|week)s?/i;
  const justMatch = expr.match(justPattern);
  if (justMatch && expr.length < 20) { // Only if it's a short expression
    const value = parseInt(justMatch[1]);
    const unit = justMatch[2].toLowerCase();
    const result = new Date(base);
    
    switch (unit) {
      case 'hour': result.setHours(result.getHours() + value); break;
      case 'minute': result.setMinutes(result.getMinutes() + value); break;
      case 'day': result.setDate(result.getDate() + value); break;
      case 'week': result.setDate(result.getDate() + value * 7); break;
    }
    
    return result;
  }
  
  // "tomorrow"
  if (expr === 'tomorrow') {
    const result = new Date(base);
    result.setDate(result.getDate() + 1);
    result.setHours(9, 0, 0, 0); // Default to 9 AM
    return result;
  }
  
  // "today"
  if (expr === 'today') {
    const result = new Date(base);
    result.setHours(14, 0, 0, 0); // Default to 2 PM
    return result;
  }
  
  return null;
}

/**
 * Resolve day of week expressions
 * - "Monday", "Tuesday", etc.
 * - "next Monday"
 * - "this Monday"
 */
function resolveDayOfWeek(expr, base) {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayMatch = expr.match(/(?:next|this)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
  
  if (dayMatch) {
    const dayName = dayMatch[1].toLowerCase();
    const dayIndex = days.indexOf(dayName);
    const currentDay = base.getDay();
    
    let daysUntil = dayIndex - currentDay;
    
    // If "next" specified, go to next week
    if (expr.includes('next') && daysUntil <= 0) {
      daysUntil += 7;
    }
    
    // If day already passed this week, go to next week
    if (daysUntil < 0 || (daysUntil === 0 && base.getHours() > 12)) {
      daysUntil += 7;
    }
    
    // Default to morning (9 AM)
    const result = new Date(base);
    result.setDate(result.getDate() + daysUntil);
    result.setHours(9, 0, 0, 0);
    
    return result;
  }
  
  return null;
}

/**
 * Resolve absolute date expressions
 * - "May 15th"
 * - "March 1"
 * - "12/25"
 * - "March 15th at 6pm"
 */
function resolveAbsoluteDate(expr, base) {
  // "Month Day" or "Month Dayst/nd/rd/th" with optional time
  const monthDayPattern = /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i;
  const monthMatch = expr.match(monthDayPattern);
  
  if (monthMatch) {
    const months = {
      january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
      july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
    };
    
    const month = months[monthMatch[1].toLowerCase()];
    const day = parseInt(monthMatch[2]);
    const hoursStr = monthMatch[3];
    const minutesStr = monthMatch[4];
    const ampm = monthMatch[5]?.toLowerCase();
    
    // Use current year, or next year if date has passed
    let year = base.getFullYear();
    const targetDate = new Date(year, month, day);
    if (targetDate < base) {
      year++;
    }
    
    const result = new Date(year, month, day);
    
    // Set time if provided
    if (hoursStr) {
      let hours = parseInt(hoursStr);
      const minutes = minutesStr ? parseInt(minutesStr) : 0;
      
      if (ampm === 'pm' && hours < 12) {
        hours += 12;
      } else if (ampm === 'am' && hours === 12) {
        hours = 0;
      }
      
      result.setHours(hours, minutes, 0, 0);
    } else {
      result.setHours(9, 0, 0, 0); // Default to 9 AM
    }
    
    return result;
  }
  
  return null;
}

/**
 * Resolve time of day expressions
 * - "this afternoon"
 * - "tomorrow morning"
 * - "tonight"
 */
function resolveTimeOfDay(expr, base) {
  // Check for modifiers
  const isTomorrow = expr.includes('tomorrow');
  const isNext = expr.includes('next');
  
  // Create base date
  const result = new Date(base);
  if (isTomorrow) {
    result.setDate(result.getDate() + 1);
  } else if (isNext) {
    result.setDate(result.getDate() + 7);
  }
  
  // Set time based on time of day
  if (expr.includes('morning')) {
    result.setHours(9, 0, 0, 0);
    return result;
  }
  
  if (expr.includes('afternoon')) {
    result.setHours(15, 0, 0, 0); // 3 PM
    return result;
  }
  
  if (expr.includes('evening')) {
    result.setHours(18, 0, 0, 0); // 6 PM
    return result;
  }
  
  if (expr.includes('night') || expr.includes('tonight')) {
    result.setHours(20, 0, 0, 0); // 8 PM
    return result;
  }
  
  if (expr.includes('noon')) {
    result.setHours(12, 0, 0, 0);
    return result;
  }
  
  if (expr.includes('midnight')) {
    result.setHours(0, 0, 0, 0);
    return result;
  }
  
  // Look for explicit time like "at 8:30" or "at 2pm"
  const atTimePattern = /at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
  let timeMatch = expr.match(atTimePattern);
  
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const ampm = timeMatch[3]?.toLowerCase();
    
    if (ampm === 'pm' && hours < 12) {
      hours += 12;
    } else if (ampm === 'am' && hours === 12) {
      hours = 0;
    }
    
    result.setHours(hours, minutes, 0, 0);
    return result;
  }
  
  // Also check for time without "at" like "3pm" or "2:30 pm"
  const timeOnlyPattern = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i;
  timeMatch = expr.match(timeOnlyPattern);
  
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const ampm = timeMatch[3]?.toLowerCase();
    
    if (ampm === 'pm' && hours < 12) {
      hours += 12;
    } else if (ampm === 'am' && hours === 12) {
      hours = 0;
    }
    
    result.setHours(hours, minutes, 0, 0);
    return result;
  }
  
  return null;
}

/**
 * Resolve fuzzy time expressions
 * - "soon"
 * - "later"
 * - "ASAP"
 */
function resolveFuzzyTime(expr, base) {
  if (expr === 'soon' || expr === 'asap') {
    const result = new Date(base);
    result.setHours(result.getHours() + 1); // 1 hour from now
    return result;
  }
  
  if (expr === 'later') {
    const result = new Date(base);
    result.setHours(result.getHours() + 3); // 3 hours from now
    return result;
  }
  
  return null;
}

/**
 * Format a date for display
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  };
  
  return date.toLocaleString('en-US', options);
}

/**
 * Get display-friendly time description
 * @param {Date} date - Date to describe
 * @param {Date} base - Base date (default: now)
 * @returns {string} Time description
 */
function getTimeDescription(date, base = new Date()) {
  const diffMs = date.getTime() - base.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffHours / 24;
  
  if (diffHours < 1) {
    return 'in less than an hour';
  } else if (diffHours < 24) {
    const hours = Math.round(diffHours);
    return `in ${hours} hour${hours > 1 ? 's' : ''}`;
  } else if (diffDays < 2) {
    return 'tomorrow';
  } else {
    return formatDate(date);
  }
}

module.exports = {
  resolveTime,
  formatDate,
  getTimeDescription
};
