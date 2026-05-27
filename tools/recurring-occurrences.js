/**
 * Second Brain - Recurring Event Occurrence Generator
 * 
 * Generates specific occurrences from recurring events.
 * Use this to show upcoming instances of recurring events.
 */

const { getNextOccurrence, rruleToHuman } = require('./recurrence-parser.js');

/**
 * Generate next N occurrences of a recurring event
 * @param {object} event - Event with recurrence field
 * @param {number} count - Number of occurrences to generate
 * @param {Date} fromDate - Start from this date (default: now)
 * @returns {Array} Array of occurrence objects with dates
 */
function generateOccurrences(event, count = 5, fromDate = new Date()) {
  if (!event.recurrence) {
    // Not a recurring event, return single occurrence
    return [{
      ...event,
      start: event.start,
      end: event.end,
      isInstance: false
    }];
  }
  
  const occurrences = [];
  let nextDate = new Date(event.start);
  
  // If the start date is in the past, find the next occurrence after fromDate
  if (nextDate < fromDate) {
    nextDate = getNextOccurrence(event.recurrence, fromDate);
    // If getNextOccurrence returns a date before fromDate, keep searching
    while (nextDate && nextDate < fromDate) {
      nextDate = getNextOccurrence(event.recurrence, new Date(nextDate.getTime() + 86400000)); // Add 1 day
    }
  }
  
  for (let i = 0; i < count && nextDate; i++) {
    // Calculate duration from original event
    const originalStart = new Date(event.start);
    const originalEnd = new Date(event.end);
    const duration = originalEnd.getTime() - originalStart.getTime();
    
    const occurrenceEnd = new Date(nextDate.getTime() + duration);
    
    occurrences.push({
      id: `${event.id}-occ-${i}`,
      title: event.title,
      description: event.description,
      start: nextDate.toISOString(),
      end: occurrenceEnd.toISOString(),
      location: event.location,
      isInstance: true,
      isRecurring: true,
      parentEventId: event.id,
      recurrenceDescription: event.recurrenceDescription || rruleToHuman(event.recurrence)
    });
    
    // Get next occurrence
    // For DAILY frequency, getNextOccurrence already adds 1 day, so don't add extra
    // For WEEKLY/MONTHLY/YEARLY, we need to search forward to avoid duplicate
    const parts = event.recurrence.split(';');
    const freq = parts.find(p => p.startsWith('FREQ='))?.split('=')[1];
    
    if (freq === 'DAILY') {
      // getNextOccurrence will add exactly 1 day (or the interval)
      nextDate = getNextOccurrence(event.recurrence, nextDate);
    } else {
      // For non-daily frequencies, add 1 day to ensure we get the next occurrence
      const searchDate = new Date(nextDate.getTime() + 86400000); // Add 1 day
      nextDate = getNextOccurrence(event.recurrence, searchDate);
    }
  }
  
  return occurrences;
}

/**
 * Get all occurrences within a date range
 * @param {Array} events - Array of events (may include recurring)
 * @param {Date} startDate - Range start
 * @param {Date} endDate - Range end
 * @returns {Array} All occurrences within the range
 */
function getOccurrencesInRange(events, startDate, endDate) {
  const allOccurrences = [];
  
  events.forEach(event => {
    if (event.recurrence) {
      // Generate occurrences for this recurring event
      const occurrences = generateOccurrences(event, 100, startDate); // Generate up to 100 occurrences
      
      // Filter to only include occurrences within the range
      occurrences.forEach(occurrence => {
        const occDate = new Date(occurrence.start);
        if (occDate >= startDate && occDate <= endDate) {
          allOccurrences.push(occurrence);
        }
      });
    } else {
      // Regular event, include if in range
      const eventDate = new Date(event.start);
      if (eventDate >= startDate && eventDate <= endDate) {
        allOccurrences.push({
          ...event,
          isInstance: false,
          isRecurring: false
        });
      }
    }
  });
  
  // Sort by date
  allOccurrences.sort((a, b) => new Date(a.start) - new Date(b.start));
  
  return allOccurrences;
}

/**
 * Format recurring event for display
 * @param {object} event - Event with recurrence field
 * @returns {string} Formatted display string
 */
function formatRecurringEvent(event) {
  if (!event.recurrence) {
    return event.title;
  }
  
  const humanReadable = rruleToHuman(event.recurrence);
  return `${event.title} (${humanReadable})`;
}

module.exports = {
  generateOccurrences,
  getOccurrencesInRange,
  formatRecurringEvent
};
