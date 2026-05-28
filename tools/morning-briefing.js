#!/usr/bin/env node
/**
 * Morning Briefing Generator
 * Sends a Telegram message with: weather, calendar, reminders
 * 
 * Usage: node morning-briefing.js
 * Cron: 7 AM daily (America/Chicago)
 */

const { execSync } = require('child_process');

const PG_CONN = 'postgresql://alfred:AlfredDB2026Secure@localhost:5432/mission_control';
const WEATHER_LOCATION = 'Kansas+City';

async function getWeather() {
  try {
    const result = execSync(
      `curl -s "https://wttr.in/${WEATHER_LOCATION}?format=j1" --max-time 10`,
      { encoding: 'utf8', timeout: 15000 }
    );
    const data = JSON.parse(result);
    const today = data.weather[0];
    const maxTemp = today.maxtempF;
    const minTemp = today.mintempF;
    
    // Find precipitation chance
    const hours = today.hourly;
    const maxRainChance = Math.max(...hours.map(h => parseInt(h.chanceofrain || '0')));
    const maxSnowChance = Math.max(...hours.map(h => parseInt(h.chanceofsnow || '0')));
    const precipChance = Math.max(maxRainChance, maxSnowChance);
    
    // Find when precipitation is most likely
    let precipTime = '';
    if (precipChance > 0) {
      const precipHours = hours.filter(h => parseInt(h.chanceofrain || '0') > 30 || parseInt(h.chanceofsnow || '0') > 30);
      if (precipHours.length > 0) {
        const times = precipHours.map(h => `${parseInt(h.time) / 100}:00`).join(', ');
        precipTime = ` — most likely ${times}`;
      }
    }
    
    // Current conditions
    const current = data.current_condition[0];
    const condition = current.weatherDesc[0].value;
    const feelsLike = current.FeelsLikeF;
    const humidity = current.humidity;
    const wind = current.windspeedMiles;
    
    let weatherText = `☀️ **Weather:** ${condition}, ${current.temp_F}°F (feels ${feelsLike}°F)\n`;
    weatherText += `🌡️ High: **${maxTemp}°F** / Low: ${minTemp}°F | Humidity: ${humidity}% | Wind: ${wind} mph`;
    
    if (precipChance > 0) {
      const type = maxSnowChance > maxRainChance ? '🌨️' : '🌧️';
      weatherText += `\n${type} Precip chance: ${precipChance}%${precipTime}`;
    } else {
      weatherText += `\n🌂 No precipitation expected`;
    }
    
    return weatherText;
  } catch (e) {
    return '☀️ Weather unavailable';
  }
}

async function getCalendar() {
  try {
    const now = new Date().toISOString();
    const tomorrow = new Date(Date.now() + 24*60*60*1000).toISOString();
    const result = execSync(
      `GOG_KEYRING_BACKEND=file GOG_KEYRING_PASSWORD=gogkeyring-8488Carter! /home/linuxbrew/.linuxbrew/bin/gog calendar events primary --from "${now}" --to "${tomorrow}" --json --no-input 2>/dev/null`,
      { encoding: 'utf8', timeout: 15000 }
    );
    const data = JSON.parse(result);
    const events = data.events || [];
    
    if (events.length === 0) return null;
    
    return events.map(e => {
      const startObj = e.start || {};
      const endObj = e.end || {};
      const startTime = startObj.dateTime || startObj.date || '';
      const endTime = endObj.dateTime || endObj.date || '';
      const isAllDay = !!startObj.date;
      
      let timeStr = '';
      if (!isAllDay && startTime) {
        try {
          const startFmt = new Date(startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          const endFmt = endTime ? '-' + new Date(endTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
          timeStr = startFmt + endFmt + ' ';
        } catch {}
      }
      
      return `• ${timeStr}${e.summary || 'Untitled'}${e.location ? ` (${e.location})` : ''}`;
    }).join('\n');
  } catch (e) {
    return null;
  }
}

async function getLocalCalendar() {
  try {
    const result = execSync(
      `psql "${PG_CONN}" -t -A -c "SELECT title, start_time, end_time, location FROM calendar_events WHERE date = CURRENT_DATE ORDER BY start_time;" 2>/dev/null`,
      { encoding: 'utf8', timeout: 5000 }
    );
    const lines = result.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) return null;
    
    return lines.map(l => {
      const [title, start, end, location] = l.split('|');
      const startStr = start ? new Date(`2000-01-01T${start}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
      const endStr = end ? `-${new Date(`2000-01-01T${end}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : '';
      return `• ${startStr}${endStr} ${title}${location && location !== 'NULL' ? ` (${location})` : ''}`;
    }).join('\n');
  } catch (e) {
    return null;
  }
}

async function getReminders() {
  try {
    const result = execSync(
      `psql "${PG_CONN}" -t -A -c "SELECT title, due_time, description FROM reminders WHERE due_date = CURRENT_DATE AND completed = false ORDER BY due_time;" 2>/dev/null`,
      { encoding: 'utf8', timeout: 5000 }
    );
    const lines = result.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) return null;
    
    return lines.map(l => {
      const [title, time, desc] = l.split('|');
      const timeStr = time ? new Date(`2000-01-01T${time}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
      return `• ${timeStr} ${title}${desc && desc !== 'NULL' ? ` — ${desc}` : ''}`;
    }).join('\n');
  } catch (e) {
    return null;
  }
}

async function getTodos() {
  try {
    const result = execSync(
      `psql "${PG_CONN}" -t -A -c "SELECT text, priority FROM todos WHERE done = false ORDER BY created_at DESC;" 2>/dev/null`,
      { encoding: 'utf8', timeout: 5000 }
    );
    const lines = result.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) return null;
    return lines.map(l => {
      const [text, priority] = l.split('|');
      const icon = priority === 'high' ? '🔴' : priority === 'low' ? '⚪' : '•';
      return `${icon} ${text}`;
    }).join('\n');
  } catch (e) {
    return null;
  }
}



async function main() {
  const now = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  
  let message = `☀️ **Morning Briefing — ${now}**\n\n`;
  
  // Weather
  const weather = await getWeather();
  message += weather + '\n\n';
  
  // Calendar
  const gcalEvents = await getCalendar();
  const localEvents = await getLocalCalendar();
  const hasEvents = gcalEvents || localEvents;
  if (hasEvents) {
    message += '📅 **Today\'s Schedule:**\n';
    // Combine and deduplicate events
    const allEventLines = [];
    if (localEvents) allEventLines.push(...localEvents.split('\n'));
    if (gcalEvents) allEventLines.push(...gcalEvents.split('\n'));
    // Simple dedup by title (after the time prefix)
    const seen = new Set();
    const deduped = allEventLines.filter(line => {
      const title = line.replace(/^•\s*\d[\d:]*\s*(AM|PM)?\s*[-–]?\s*/, '').trim().toLowerCase();
      if (seen.has(title)) return false;
      seen.add(title);
      return true;
    });
    message += deduped.join('\n') + '\n\n';
  } else {
    message += '📅 No events today\n\n';
  }
  
  // Reminders
  const reminders = await getReminders();
  if (reminders) {
    message += '🔔 **Reminders:**\n' + reminders + '\n\n';
  }
  
  // To Do
  const todos = await getTodos();
  if (todos) {
    message += '✅ **To Do:**\n' + todos + '\n\n';
  }


  
  console.log(message);
}

main().catch(console.error);