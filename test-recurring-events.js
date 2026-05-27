/**
 * Test script for recurring event functionality
 */

const { parseRecurrence, rruleToHuman, getOrdinalSuffix } = require('./tools/recurrence-parser.js');
const { processCreateEventCommand } = require('./openclaw-commands/event.js');

console.log('🧪 Testing Recurring Event Implementation\n');
console.log('='.repeat(60));

// Test recurrence parser
console.log('\n📋 Test 1: Recurrence Pattern Parsing\n');
console.log('-'.repeat(60));

const testPatterns = [
  'Every Monday at 9am',
  'Every weekday at 8am',
  'Every 1st of month at 6pm',
  'Every 2 weeks on Friday',
  'Every week',
  'Every day',
  'Every 3 months',
  'Every Sunday at 7pm'
];

testPatterns.forEach((pattern, index) => {
  const result = parseRecurrence(pattern);
  console.log(`\nTest ${index + 1}: "${pattern}"`);
  console.log(`  Matched: ${result.matched}`);
  console.log(`  Description: ${result.description}`);
  console.log(`  RRULE: ${result.recurrence}`);
  console.log(`  Time: ${result.time}`);
  console.log(`  Human: ${rruleToHuman(result.recurrence)}`);
});

// Test RRULE to human conversion
console.log('\n\n📋 Test 2: RRULE to Human Conversion\n');
console.log('-'.repeat(60));

const rruleTests = [
  'FREQ=WEEKLY;BYDAY=MO',
  'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  'FREQ=MONTHLY;BYMONTHDAY=1',
  'FREQ=WEEKLY;INTERVAL=2;BYDAY=FR',
  'FREQ=DAILY',
  'FREQ=MONTHLY;INTERVAL=3'
];

rruleTests.forEach((rrule, index) => {
  const human = rruleToHuman(rrule);
  console.log(`${index + 1}. ${rrule} → "${human}"`);
});

// Test ordinal suffix
console.log('\n\n📋 Test 3: Ordinal Suffix\n');
console.log('-'.repeat(60));

const ordinals = [1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31];
ordinals.forEach(num => {
  console.log(`${num}${getOrdinalSuffix(num)}`);
});

// Test full event creation
console.log('\n\n📋 Test 4: Full Event Creation\n');
console.log('-'.repeat(60));

async function testEventCreation() {
  const testInputs = [
    'Create event Weekly standup every Monday at 9am',
    'Create event Daily scrum every weekday at 8am',
    'Create event Monthly review every 1st of month at 6pm',
    'Create event Bi-weekly sync every 2 weeks on Friday',
    'Create event Team lunch every Friday at 12pm'
  ];

  for (const input of testInputs) {
    console.log(`\nInput: "${input}"`);
    console.log('-'.repeat(60));
    
    try {
      const result = await processCreateEventCommand(input);
      console.log(result.message);
      if (result.event) {
        console.log('\nEvent saved:');
        console.log(JSON.stringify(result.event, null, 2));
      }
    } catch (error) {
      console.error('Error:', error.message);
    }
    console.log('\n');
  }
}

testEventCreation().then(() => {
  console.log('\n✅ All tests completed!');
}).catch((error) => {
  console.error('\n❌ Test failed:', error);
});
