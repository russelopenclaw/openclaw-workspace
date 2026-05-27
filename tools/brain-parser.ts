/**
 * Second Brain - Natural Language Parser
 * 
 * Parses user commands into structured actions for:
 * - Remember: [URL/content]
 * - Remind me to [task] [when]
 * - Create event: [details]
 * - Recurring: [pattern]
 */

// Command parse result types
export interface ParsedCommand {
  type: 'remember' | 'reminder' | 'event' | 'recurring';
  confidence: number;
  raw: string;
}

export interface ParsedRemember extends ParsedCommand {
  type: 'remember';
  itemType: 'article' | 'video' | 'link' | 'note';
  content: string;
  url?: string;
  title?: string;
}

export interface ParsedReminder extends ParsedCommand {
  type: 'reminder';
  task: string;
  when: string;
  isRecurring?: false;
}

export interface ParsedEvent extends ParsedCommand {
  type: 'event';
  title: string;
  when: string;
  allDay?: boolean;
}

export interface ParsedRecurring extends ParsedCommand {
  type: 'recurring';
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  dayOfWeek?: string;
  time?: string;
  task?: string;
  title?: string;
}

/**
 * Main parser - determines command type and parses accordingly
 */
export function parseCommand(input: string): ParsedCommand | null {
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
 * Parse "Remember:" commands
 * Patterns:
 * - "Remember: [URL]"
 * - "Save this: [URL]"
 * - "Bookmark this article: [URL]"
 */
function tryParseRemember(input: string): ParsedRemember | null {
  const patterns = [
    /^(remember|save|bookmark)[:\s]+(.+)$/i,
    /^(remember this|save this)[:\s]+(.+)$/i
  ];
  
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      const content = match[2].trim();
      
      // Detect type from content
      let itemType: 'article' | 'video' | 'link' | 'note' = 'note';
      let url: string | undefined;
      
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
 * Parse "Remind me..." commands
 * Patterns:
 * - "Remind me to call mom this afternoon"
 * - "Remind me tomorrow morning to submit the report"
 * - "Remind me in 2 hours to check the oven"
 */
function tryParseReminder(input: string): ParsedReminder | null {
  const patterns = [
    /^remind me (?:to )?(.+?) (?:this|tomorrow|next|in|at|on|for|that)[:\s]*(.+)?$/i,
    /^remind me (.+?) (?:this|tomorrow|next|in|at|on|for|until)[:\s]*(.+)?$/i,
    /^remind me (?:to )?(.+)$/i
  ];
  
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      let task: string;
      let when: string;
      
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
 * Parse event creation commands
 * Patterns:
 * - "I have a doctor's appointment at 8:30 on May 15th"
 * - "Meeting with John tomorrow at 2pm"
 * - "Dinner reservation Friday night at 7"
 */
function tryParseEvent(input: string): ParsedEvent | null {
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
 * Patterns:
 * - "Every Monday at 9am I have team standup"
 * - "Remind me every Friday to submit timesheet"
 * - "Monthly team lunch on the first Tuesday"
 */
function tryParseRecurring(input: string): ParsedRecurring | null {
  const patterns = [
    /^(every|each|recurring) (daily|weekly|monthly|yearly) (?:at|on)?[:\s]*(.+)?$/i,
    /^(every|each) (monday|tuesday|wednesday|thursday|friday|saturday|sunday) (?:at|on)?[:\s]*(.+)?$/i,
    /^(every|each) (week|month|year) (?:on|at)?[:\s]*(.+)?$/i
  ];
  
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      // Simplified - would need more sophisticated parsing
      // For now, detect if it's a recurring command
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

function isURL(text: string): boolean {
  const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
  return urlPattern.test(text.trim());
}

function detectTypeFromURL(url: string): 'article' | 'video' | 'link' {
  const lower = url.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be') || lower.includes('vimeo.com')) {
    return 'video';
  } else if (lower.includes('medium.com') || lower.includes('article') || lower.includes('blog')) {
    return 'article';
  }
  return 'link';
}

function extractTitle(text: string): string {
  // Simple title extraction - would be enhanced with actual metadata fetching
  return text.split('\n')[0].substring(0, 100);
}

function extractTaskAndWhen(text: string): { task: string; when: string } {
  // Look for time indicators and split there
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

function extractTask(text: string): string {
  // Remove common prefixes
  return text.replace(/^(remind me to|i have|create|schedule|book)\s+/i, '').trim();
}

function detectFrequency(text: string): 'daily' | 'weekly' | 'monthly' | 'yearly' {
  const lower = text.toLowerCase();
  if (lower.includes('daily') || lower.includes('every day')) return 'daily';
  if (lower.includes('monthly') || lower.includes('every month')) return 'monthly';
  if (lower.includes('yearly') || lower.includes('every year')) return 'yearly';
  if (lower.includes('weekly') || lower.includes('every week')) return 'weekly';
  if (lower.match(/every (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/)) return 'weekly';
  return 'weekly'; // default
}
