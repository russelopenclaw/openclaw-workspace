/**
 * Second Brain - Natural Language Parser (JavaScript Version)
 * 
 * Parses user commands into structured actions for:
 * - Remember: [URL/content]
 * - Remind me to [task] [when]
 * - Create event: [details]
 * - Recurring: [pattern]
 */

/**
 * Main parser - determines command type and parses accordingly
 * @param {string} input - User input to parse
 * @returns {Object|null} Parsed command or null
 */
function parseCommand(input) {
  const trimmed = input.trim();
  
  // Try each parser in order of specificity
  const parsers = [
    tryParseRecurring,
    tryParseRemember,
    tryParseReminder,
    tryParseEvent
  ];
  
  for (const parser of parsers) {
    const result = parser(trimmed);
    if (result) {
      return result;
    }
  }
  
  return null;
}

/**
 * Parse "Remind me..." commands
 * Patterns:
 * - "Remind me to call mom this afternoon"
 * - "Remind me tomorrow morning to submit the report"
 * - "Remind me in 2 hours to check the oven"
 */
function tryParseReminder(input) {
  const patterns = [
    /^remind me (?:to )?(.+?) (?:this|tomorrow|next|in|at|on|for|that)[:\s]*(.+)?$/i,
    /^remind me (.+?) (?:this|tomorrow|next|in|at|on|for|until)[:\s]*(.+)?$/i,
    /^remind me (?:to )?(.+)$/i
  ];
  
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      let task;
      let when;
      
      if (match[2]) {
        // Has explicit when clause
        task = match[1].trim();
        when = (match[2] || match[3] || '').trim();
      } else {
        // Task and when are mixed
        const parsed = extractTaskAndWhen(match[1]);
        task = parsed.task;
        when = parsed.when;
      }
      
      if (task && when) {
        return {
          type: 'reminder',
          confidence: 0.85,
          raw: input,
          task,
          when,
          isRecurring: false
        };
      }
    }
  }
  
  return null;
}

/**
 * Parse "Remember:" commands
 */
function tryParseRemember(input) {
  const patterns = [
    /^(remember|save|bookmark)[:\s]+(.+)$/i,
    /^(remember this|save this)[:\s]+(.+)$/i
  ];
  
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      const content = match[2].trim();
      
      // Detect type from content
      let itemType = 'note';
      let url = undefined;
      
      if (isURL(content)) {
        url = content;
        itemType = detectTypeFromURL(content);
      } else {
        // It's a note
        itemType = 'note';
      }
      
      return {
        type: 'remember',
        confidence: 0.9,
        raw: input,
        itemType,
        content,
        url,
        title: extractTitle(content)
      };
    }
  }
  
  return null;
}

/**
 * Parse event creation commands
 */
function tryParseEvent(input) {
  const patterns = [
    /^(i have|create event|meeting|appointment|lunch|dinner|breakfast).+$/i,
    /^schedule (?:a|an|the)? (.+)$/i,
    /^book (?:a|an|the)? (.+)$/i
  ];
  
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      // Extract title and when from the input
      const { task: title, when } = extractTaskAndWhen(input);
      
      if (title && when) {
        return {
          type: 'event',
          confidence: 0.8,
          raw: input,
          title: title.charAt(0).toUpperCase() + title.slice(1),
          when,
          allDay: false
        };
      }
    }
  }
  
  return null;
}

/**
 * Parse recurring event/reminder commands
 */
function tryParseRecurring(input) {
  const patterns = [
    /^(every|each|recurring) (daily|weekly|monthly|yearly) (?:at|on)?[:\s]*(.+)?$/i,
    /^(every|each) (monday|tuesday|wednesday|thursday|friday|saturday|sunday) (?:at|on)?[:\s]*(.+)?$/i,
    /^(every|each) (week|month|year) (?:on|at)?[:\s]*(.+)?$/i
  ];
  
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      // Simplified - would need more sophisticated parsing
      if (input.match(/every|each|recurring/i)) {
        return {
          type: 'recurring',
          confidence: 0.75,
          raw: input,
          frequency: detectFrequency(input),
          interval: 1,
          task: extractTask(input),
          title: extractTitle(input)
        };
      }
    }
  }
  
  return null;
}

// Helper functions

function isURL(text) {
  const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
  return urlPattern.test(text.trim());
}

function detectTypeFromURL(url) {
  const lower = url.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be') || lower.includes('vimeo.com')) {
    return 'video';
  } else if (lower.includes('medium.com') || lower.includes('article') || lower.includes('blog')) {
    return 'article';
  }
  return 'link';
}

function extractTitle(text) {
  return text.split('\n')[0].substring(0, 100);
}

function extractTaskAndWhen(text) {
  const timeIndicators = [
    'this morning', 'this afternoon', 'this evening', 'tonight',
    'tomorrow morning', 'tomorrow afternoon', 'tomorrow evening',
    'next week', 'next month', 'next year',
    'in 1 hour', 'in 2 hours', 'in 30 minutes',
    'at \\d+:\\d+', 'on \\w+ \\d+',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  ];
  
  const pattern = new RegExp(`(${timeIndicators.join('|')})`, 'i');
  const match = text.match(pattern);
  
  if (match && match.index) {
    const task = text.substring(0, match.index).trim().replace(/^(to|for)\s+/i, '');
    const when = text.substring(match.index).trim();
    return { task, when };
  }
  
  // Fallback: treat last part as when
  const parts = text.split(/\s+(?:at|on|in|for|this|tomorrow|next)/i);
  if (parts.length > 1) {
    return {
      task: parts[0].trim(),
      when: parts.slice(1).join(' ').trim()
    };
  }
  
  return { task: text, when: 'soon' };
}

function extractTask(text) {
  return text.replace(/^(remind me to|i have|create|schedule|book)\s+/i, '').trim();
}

function detectFrequency(text) {
  const lower = text.toLowerCase();
  if (lower.includes('daily') || lower.includes('every day')) return 'daily';
  if (lower.includes('monthly') || lower.includes('every month')) return 'monthly';
  if (lower.includes('yearly') || lower.includes('every year')) return 'yearly';
  if (lower.includes('weekly') || lower.includes('every week')) return 'weekly';
  if (lower.match(/every (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/)) return 'weekly';
  return 'weekly'; // default
}

module.exports = {
  parseCommand,
  extractTaskAndWhen,
  isURL
};
