/**
 * Test script for recurring event parser
 */

const { parseRecurrence, rruleToHuman } = require('./recurrence-parser.js');
const { processCreateEventCommand } = require('../openclaw-commands/event.js');
const fs = require('fs');
const path = require('path');

const EVENTS_FILE = path.join(__dirname, '..', 'calendar', 'events.json');

console.log('='.repeat(60));
console.log('SECOND BRAIN - RECURRING EVENTS TEST');
console.log('='.repeat(60));
console.log();

// Test 1: Parse recurrence patterns
console.log('TEST 1: Recurrence Parser');
console.log('-'.repeat(60));

const testPatterns = [
  'Every Monday at 9am',
  'Every day at 8am',
  'Every weekday at 9am',
  'Every 2 weeks on Friday',
  'Every 1st of month at 6pm'
];

testPatterns.forEach(pattern => {
  const result = parseRecurrence(pattern);
  console.log(`\nInput: "${pattern}"`);
  console.log(`  Matched: ${result.matched}`);
  console.log(`  RRULE: ${result.recurrence}`);
  console.log(`  Description: ${result.description}`);
  console.log(`  Time: ${result.time}`);
  console.log(`  Human: ${rruleToHuman(result.recurrence)}`);
});

// Test 2: Create recurring events via event handler
console.log('\n\n');
console.log('TEST 2: Event Handler - Create Recurring Events');
console.log('-'.repeat(60));

const testCommands = [
  'Weekly standup every Monday at 9am',
  'Daily standup every day at 8am'
];

async function runTests() {
  // Load current events count
  const beforeData = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
  const beforeCount = beforeData.events.length;
  
  for (const command of testCommands) {
    console.log(`\nCommand: "Create event ${command}"`);
    console.log('-'.repeat(60));
    
    const result = await processCreateEventCommand(command);
    console.log(result.message);
    
    if (result.event) {
      console.log('\nEvent saved with:');
      console.log(`  ID: ${result.event.id}`);
      console.log(`  Title: ${result.event.title}`);
      console.log(`  Recurrence: ${result.event.recurrence || 'NONE'}`);
      console.log(`  Recurrence Description: ${result.event.recurrenceDescription || 'NONE'}`);
      console.log(`  Start: ${result.event.start}`);
    }
    console.log();
  }
  
  // Verify events were saved
  const afterData = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
  const afterCount = afterData.events.length;
  
  console.log('='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Events before: ${beforeCount}`);
  console.log(`Events after: ${afterCount}`);
  console.log(`New events created: ${afterCount - beforeCount}`);
  
  // Find the newly created recurring events
  const newRecurringEvents = afterData.events.slice(beforeCount).filter(e => e.recurrence);
  console.log(`Recurring events created: ${newRecurringEvents.length}`);
  
  if (newRecurringEvents.length > 0) {
    console.log('\nNew Recurring Events:');
    newRecurringEvents.forEach(event => {
      console.log(`  - ${event.title}: ${event.recurrence}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
}

runTests().catch(console.error);
