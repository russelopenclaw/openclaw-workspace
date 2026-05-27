/**
 * Test recurring occurrence generator
 */

const { generateOccurrences, getOccurrencesInRange, formatRecurringEvent } = require('./tools/recurring-occurrences.js');

console.log('🧪 Testing Recurring Event Occurrence Generator\n');
console.log('='.repeat(60));

// Test event with weekly recurrence
const weeklyEvent = {
  id: 'evt-weekly-1',
  title: 'Weekly Standup',
  description: 'Team sync meeting',
  start: '2026-03-02T15:00:00.000Z', // Monday at 9am CST
  end: '2026-03-02T16:00:00.000Z',
  recurrence: 'FREQ=WEEKLY;BYDAY=MO',
  recurrenceDescription: 'Every Monday'
};

// Test event with monthly recurrence
const monthlyEvent = {
  id: 'evt-monthly-1',
  title: 'Monthly Review',
  description: 'End of month review',
  start: '2026-03-01T00:00:00.000Z', // 1st of month at 6pm CST
  end: '2026-03-01T01:00:00.000Z',
  recurrence: 'FREQ=MONTHLY;BYMONTHDAY=1',
  recurrenceDescription: 'Every 1st of month'
};

// Test event with bi-weekly recurrence
const biweeklyEvent = {
  id: 'evt-biweekly-1',
  title: 'Bi-weekly Sync',
  description: 'Sprint sync',
  start: '2026-03-06T20:00:00.000Z', // Friday at 2pm CST
  end: '2026-03-06T21:00:00.000Z',
  recurrence: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=FR',
  recurrenceDescription: 'Every 2 weeks on Friday'
};

// Test event with weekday recurrence
const weekdayEvent = {
  id: 'evt-weekday-1',
  title: 'Daily Scrum',
  description: 'Daily standup',
  start: '2026-03-02T14:00:00.000Z', // 8am CST
  end: '2026-03-02T15:00:00.000Z',
  recurrence: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  recurrenceDescription: 'Every weekday'
};

console.log('\n📋 Test 1: Generate Weekly Occurrences\n');
console.log('-'.repeat(60));
const weeklyOccurrences = generateOccurrences(weeklyEvent, 5, new Date('2026-03-03'));
weeklyOccurrences.forEach((occ, i) => {
  const date = new Date(occ.start);
  console.log(`${i + 1}. ${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`);
});

console.log('\n\n📋 Test 2: Generate Monthly Occurrences\n');
console.log('-'.repeat(60));
const monthlyOccurrences = generateOccurrences(monthlyEvent, 6, new Date('2026-03-03'));
monthlyOccurrences.forEach((occ, i) => {
  const date = new Date(occ.start);
  console.log(`${i + 1}. ${date.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}`);
});

console.log('\n\n📋 Test 3: Generate Bi-weekly Occurrences\n');
console.log('-'.repeat(60));
const biweeklyOccurrences = generateOccurrences(biweeklyEvent, 5, new Date('2026-03-03'));
biweeklyOccurrences.forEach((occ, i) => {
  const date = new Date(occ.start);
  console.log(`${i + 1}. ${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`);
});

console.log('\n\n📋 Test 4: Generate Weekday Occurrences\n');
console.log('-'.repeat(60));
const weekdayOccurrences = generateOccurrences(weekdayEvent, 10, new Date('2026-03-03'));
weekdayOccurrences.forEach((occ, i) => {
  const date = new Date(occ.start);
  console.log(`${i + 1}. ${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`);
});

console.log('\n\n📋 Test 5: Get Occurrences in Date Range\n');
console.log('-'.repeat(60));
const fromDate = new Date('2026-03-01');
const toDate = new Date('2026-03-31');
const allEvents = [weeklyEvent, monthlyEvent, biweeklyEvent, weekdayEvent];
const rangeOccurrences = getOccurrencesInRange(allEvents, fromDate, toDate);
console.log(`Events from ${fromDate.toLocaleDateString()} to ${toDate.toLocaleDateString()}:\n`);
rangeOccurrences.forEach((occ, i) => {
  const date = new Date(occ.start);
  const recurring = occ.isRecurring ? '🔁' : '📅';
  console.log(`${i + 1}. ${recurring} ${occ.title} - ${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`);
});

console.log('\n\n📋 Test 6: Format Recurring Events\n');
console.log('-'.repeat(60));
console.log(weeklyEvent.title, '→', formatRecurringEvent(weeklyEvent));
console.log(monthlyEvent.title, '→', formatRecurringEvent(monthlyEvent));
console.log(biweeklyEvent.title, '→', formatRecurringEvent(biweeklyEvent));
console.log(weekdayEvent.title, '→', formatRecurringEvent(weekdayEvent));

console.log('\n✅ All occurrence generator tests completed!\n');
