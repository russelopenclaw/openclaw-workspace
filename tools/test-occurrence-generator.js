const { generateOccurrences } = require('./recurrence-parser.js');
const fs = require('fs');
const path = require('path');

const EVENTS_FILE = path.join(__dirname, '..', 'calendar', 'events.json');

const data = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));

// Find the newly created recurring events
const weeklyStandup = data.events.find(e => e.title === 'Weekly standup' && e.recurrence);
const dailyStandup = data.events.find(e => e.title === 'Daily standup' && e.recurrence);

console.log('TEST 3: Occurrence Generator');
console.log('='.repeat(60));

if (weeklyStandup) {
  console.log('\nWeekly Standup Occurrences (next 5):');
  const occurrences = require('./recurring-occurrences.js').generateOccurrences(weeklyStandup, 5);
  occurrences.forEach((occ, i) => {
    const date = new Date(occ.start);
    console.log(`  ${i+1}. ${date.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`);
  });
} else {
  console.log('Weekly standup event not found!');
}

if (dailyStandup) {
  console.log('\nDaily Standup Occurrences (next 5):');
  const occurrences = require('./recurring-occurrences.js').generateOccurrences(dailyStandup, 5);
  occurrences.forEach((occ, i) => {
    const date = new Date(occ.start);
    console.log(`  ${i+1}. ${date.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`);
  });
} else {
  console.log('Daily standup event not found!');
}

console.log('\n' + '='.repeat(60));
