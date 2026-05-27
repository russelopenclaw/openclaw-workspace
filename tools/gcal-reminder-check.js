#!/usr/bin/env node
/**
 * Google Calendar Reminder Checker
 * Checks GCal events and sends alerts for events starting within 30 minutes
 * 
 * Usage: node tools/gcal-reminder-check.js
 * Output: JSON {found: true/false, message: "..."} for caller to handle
 */

const { execSync } = require('child_process');

const GOG_CMD = 'gog calendar events --from today --days 1 --json 2>/dev/null';

/**
 * Check Google Calendar for upcoming events
 */
async function checkGCalReminders() {
  try {
    // Get today's events from GCal
    const result = execSync(GOG_CMD, { encoding: 'utf8', stdio: 'pipe' });
    
    if (!result.trim()) {
      console.log(JSON.stringify({ found: false }));
      return;
    }
    
    const data = JSON.parse(result);
    const events = data.events || [];
    
    if (events.length === 0) {
      console.log(JSON.stringify({ found: false }));
      return;
    }
    
    // Filter events starting within next 30 minutes
    const now = new Date();
    const thirtyMinFromNow = new Date(now.getTime() + 30 * 60 * 1000);
    
    const upcomingEvents = events.filter(event => {
      const startTime = new Date(event.start?.dateTime || event.start?.date);
      return startTime >= now && startTime <= thirtyMinFromNow;
    });
    
    if (upcomingEvents.length === 0) {
      console.log(JSON.stringify({ found: false }));
      return;
    }
    
    // Build alert messages
    const messages = upcomingEvents.map(event => {
      const startTime = new Date(event.start?.dateTime || event.start?.date);
      const minutesUntil = Math.round((startTime - now) / 60000);
      
      let timeText;
      if (minutesUntil <= 0) {
        timeText = '**NOW**';
      } else if (minutesUntil < 60) {
        timeText = `in ${minutesUntil} minutes`;
      } else {
        const hours = Math.floor(minutesUntil / 60);
        const mins = minutesUntil % 60;
        timeText = `in ${hours}h ${mins > 0 ? mins + 'm' : ''}`;
      }
      
      const location = event.location ? `\n📍 ${event.location}` : '';
      const description = event.description ? `\n📝 ${event.description}` : '';
      
      return `🔔 **${event.summary}**\n⏰ ${timeText}${location}${description}`;
    });
    
    const fullMessage = messages.join('\n\n');
    
    console.log(JSON.stringify({
      found: true,
      count: upcomingEvents.length,
      message: fullMessage,
      action: 'send-telegram',
      target: '8177470832',
      source: 'gcal'
    }));
    
  } catch (e) {
    console.error('Error checking GCal:', e.message);
    console.log(JSON.stringify({ found: false, error: e.message }));
  }
}

// Run
checkGCalReminders();
