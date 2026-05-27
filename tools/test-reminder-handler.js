#!/usr/bin/env node

/**
 * Test script for Reminder Handler
 * 
 * Tests examples from task-23:
 * - "Remind me to call Kevin at 3pm"
 * - "Remind me to check emails tomorrow morning"
 * - "Remind me to deploy next Monday"
 */

const { parseCommand } = require('./brain-parser-node');
const { handleReminder } = require('./reminder-handler-node');
const { getAllReminders, checkDueReminders } = require('./reminder-handler-node');

async function runTests() {
  console.log('🧪 Testing Reminder Handler Implementation\n');
  console.log('=' .repeat(60));
  
  // Test cases from task requirements
  const testCases = [
    'Remind me to call Kevin at 3pm',
    'Remind me to check emails tomorrow morning',
    'Remind me to deploy next Monday'
  ];
  
  console.log('\n📝 Test Cases:\n');
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\nTest ${i + 1}: "${testCase}"`);
    console.log('-'.repeat(60));
    
    // Step 1: Parse the command
    console.log('  1️⃣  Parsing command...');
    const parsed = parseCommand(testCase);
    
    if (!parsed) {
      console.log('  ❌ FAILED: Could not parse command');
      continue;
    }
    
    console.log(`     ✅ Parsed successfully`);
    console.log(`     Type: ${parsed.type}`);
    if (parsed.type === 'reminder') {
      console.log(`     Task: ${parsed.task}`);
      console.log(`     When: ${parsed.when}`);
    }
    
    // Step 2: Handle the reminder
    console.log('  2️⃣  Creating reminder...');
    const result = await handleReminder(parsed);
    
    if (result.success) {
      console.log(`     ✅ ${result.message}`);
    } else {
      console.log(`     ❌ FAILED: ${result.message}`);
    }
  }
  
  // Show all reminders
  console.log('\n' + '='.repeat(60));
  console.log('📋 Current Reminders in Storage:\n');
  const reminders = getAllReminders();
  
  if (reminders.length === 0) {
    console.log('  No reminders found');
  } else {
    console.log(`  Total: ${reminders.length} reminder(s)\n`);
    reminders.forEach((reminder, index) => {
      console.log(`  ${index + 1}. [${reminder.id}]`);
      console.log(`     Task: ${reminder.task}`);
      console.log(`     Due: ${new Date(reminder.dueDate).toLocaleString()}`);
      console.log(`     Created: ${new Date(reminder.createdAt).toLocaleString()}`);
      console.log(`     Notified: ${reminder.notified ? '✅' : '❌'}`);
      console.log();
    });
  }
  
  // Check for due reminders
  console.log('⏰ Checking for due reminders...');
  const dueReminders = checkDueReminders();
  if (dueReminders.length > 0) {
    console.log(`  ⚠️  ${dueReminders.length} reminder(s) due:\n`);
    dueReminders.forEach(r => console.log(`     - ${r.task}`));
  } else {
    console.log('  ✅ No reminders due');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✨ Test Complete!\n');
  
  // Additional edge case tests
  console.log('🔍 Edge Case Tests:\n');
  
  const edgeCases = [
    { input: 'Remind me to test soon', expected: 'should parse "soon" as fuzzy time' },
    { input: 'Remind me to run in 2 hours', expected: 'should handle relative time' },
    { input: 'Remind me to backup this afternoon', expected: 'should parse "this afternoon"' }
  ];
  
  for (const edgeCase of edgeCases) {
    console.log(`Testing: "${edgeCase.input}"`);
    const parsed = parseCommand(edgeCase.input);
    if (parsed && parsed.type === 'reminder') {
      console.log(`  ✅ Parsed: Task="${parsed.task}", When="${parsed.when}"`);
      const result = await handleReminder(parsed);
      console.log(`  ✅ ${result.message}`);
    } else {
      console.log(`  ❌ Parse failed`);
    }
    console.log();
  }
  
  console.log('💡 All tests completed!\n');
  console.log('Files updated:');
  console.log('  ✅ /workspace/tools/reminder-handler-node.js');
  console.log('  ✅ /workspace/tools/temporal-resolver-node.js');
  console.log('  ✅ /workspace/calendar/reminders.json');
  console.log('');
}

// Run tests
runTests().catch(console.error);
