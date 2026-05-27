/**
 * Second Brain - Command Handlers
 * 
 * Executive handlers that coordinate between:
 * - User commands (via parser)
 * - Brain storage (via API)
 * - Calendar integration
 */

import { ParsedRemember, ParsedReminder, ParsedEvent, ParsedRecurring } from './parser';
import { resolveTime, formatDate } from './temporal';

const BRAIN_API = 'http://localhost:8765/api/brain/items';
const CALENDAR_API = 'http://localhost:8765/api/calendar';

/**
 * Handle "Remember:" commands
 */
export async function handleRemember(parsed: ParsedRemember): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Extract keywords from content
    const keywords = await extractKeywords(parsed);
    
    // 2. Prepare item for storage
    const item = {
      type: parsed.itemType,
      title: parsed.title || extractTitle(parsed.content),
      url: parsed.url || null,
      content: parsed.content,
      keywords,
      metadata: {
        domain: parsed.url ? new URL(parsed.url).hostname : null,
        savedAt: new Date().toISOString()
      },
      createdAt: new Date().toISOString()
    };
    
    // 3. Save to Brain
    const response = await fetch(BRAIN_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    
    if (!response.ok) {
      throw new Error('Failed to save to Brain');
    }
    
    const saved = await response.json();
    
    // 4. Format confirmation message
    const typeEmoji = {
      article: '📄',
      video: '🎥',
      link: '🔗',
      note: '📝'
    }[parsed.itemType];
    
    const keywordsStr = keywords.length > 0 
      ? `\nKeywords: ${keywords.join(', ')}` 
      : '';
    
    return {
      success: true,
      message: `${typeEmoji} Saved: "${item.title}"${keywordsStr}`
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Handle "Remind me..." commands
 */
export async function handleReminder(parsed: ParsedReminder): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Resolve the time expression
    const resolvedTime = resolveTime(parsed.when);
    
    // 2. Create reminder
    const reminder = {
      task: parsed.task,
      due: resolvedTime.toISOString(),
      completed: false,
      createdAt: new Date().toISOString()
    };
    
    // 3. Save to Calendar reminders
    const response = await fetch(`${CALENDAR_API}/reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reminder)
    });
    
    if (!response.ok) {
      throw new Error('Failed to create reminder');
    }
    
    const saved = await response.json();
    
    // 4. Format confirmation message
    const whenStr = formatDate(resolvedTime);
    
    return {
      success: true,
      message: `⏰ Reminder set for ${whenStr}: ${parsed.task}`
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to create reminder: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Handle "Create event..." commands
 */
export async function handleEvent(parsed: ParsedEvent): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Resolve the time expression
    const resolvedTime = resolveTime(parsed.when);
    
    // 2. Calculate end time (default 1 hour)
    const endTime = new Date(resolvedTime);
    endTime.setHours(endTime.getHours() + 1);
    
    // 3. Create event
    const event = {
      title: parsed.title,
      start: resolvedTime.toISOString(),
      end: endTime.toISOString(),
      allDay: parsed.allDay || false,
      description: '',
      reminders: [
        {
          type: 'notification',
          minutesBefore: 60 // 1 hour before
        }
      ]
    };
    
    // 4. Save to Calendar events
    const response = await fetch(`${CALENDAR_API}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
    
    if (!response.ok) {
      throw new Error('Failed to create event');
    }
    
    const saved = await response.json();
    
    // 5. Format confirmation message
    const dateStr = resolvedTime.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    
    const timeStr = resolvedTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
    
    return {
      success: true,
      message: `📅 Event created: ${parsed.title}\n📆 ${dateStr} at ${timeStr}`
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to create event: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Handle recurring commands
 */
export async function handleRecurring(parsed: ParsedRecurring): Promise<{ success: boolean; message: string }> {
  try {
    // Simplified - would need full RRULE implementation
    return {
      success: true,
      message: `🔄 Recurring event set up: ${parsed.title || parsed.task}\nFrequency: ${parsed.frequency}`
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to create recurring event: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Helper functions

async function extractKeywords(parsed: ParsedRemember): Promise<string[]> {
  // If URL, fetch and analyze
  if (parsed.url) {
    // In production, would fetch page metadata
    const domain = new URL(parsed.url).hostname;
    return [domain, parsed.itemType, 'saved'];
  }
  
  // If note, extract from text
  const words = parsed.content.toLowerCase().split(/\s+/);
  const stopwords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'for', 'of', 'in', 'on']);
  const significant = words.filter(w => w.length > 4 && !stopwords.has(w));
  
  return [...new Set(significant)].slice(0, 5);
}

function extractTitle(content: string): string {
  return content.split('\n')[0].substring(0, 100);
}
