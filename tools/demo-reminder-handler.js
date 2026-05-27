#!/usr/bin/env node

/**
 * Second Brain - Reminder Handler Demo
 * 
 * Demonstrates the complete workflow:
 * 1. Parse command
 * 2. Create reminder
 * 3. Check reminders (heartbeat)
 * 4. Mark as complete
 */

const { parseCommand } = require('./brain-parser-node');
const { handleReminder, getAllReminders, checkDueReminders, deleteReminder } = require('./reminder-handler-node');
const { checkReminders } = require('./reminder-heartbeat-hook');

async function demo() {
  console.log('🧠 Second Brain - Reminder Handler Demo\n');
  console.log('=' .repeat(70));
  
  // Example 1: Create a reminder from natural language
  console.log('\n📝 Example 1: Creating a reminder from natural language\n');
  const input = "Remind me to call Kevin at 3pm";
  console.log(`User says: "${input}"`);
  
  const parsed = parseCommand(input);
  console.log(`\nParsed:`);
  console.log(`  Type: ${parsed.type}`);
  console.log(`  Task: ${parsed.task}`);
  console.log(`  When: ${parsed.when}`);
  
  const result = await handleReminder(parsed);
  console.log(`\n${result.message}`);
  
  // Example 2: Create multiple reminders
  console.log('\n\n📝 Example 2: Creating multiple reminders\n');
  const examples = [
    "Remind me to check emails tomorrow morning",
    "Remind me to deploy next Monday",
    "Remind me to run in 2 hours"
  ];
  
  for (const ex of examples) {
    const p = parseCommand(ex);
    const r = await handleReminder(p);
    console.log(`"${ex}"`);
    console.log(`  → ${r.message}\n`);
  }
  
  // Example 3: Check all reminders
  console.log('\n📋 Example 3: Viewing all reminders\n');
  const allReminders = getAllReminders();
  console.log(`Total reminders: ${allReminders.length}`);
  allReminders.forEach((r, i) => {
    const due = new Date(r.dueDate).toLocaleString();
    const status = r.notified ? '✅ notified' : '⏳ pending';
    console.log(`  ${i + 1}. [${r.id}] ${r.task}`);
    console.log(`     Due: ${due} | Status: ${status}`);
  });
  
  // Example 4: Heartbeat check
  console.log('\n\n⏰ Example 4: Heartbeat check (simulated)\n');
  const heartbeatResult = await checkReminders();
  console.log(`Status: ${heartbeatResult.status}`);
  console.log(`Notify: ${heartbeatResult.notify ? '✅ Yes' : '❌ No'}`);
  if (heartbeatResult.notify) {
    console.log(`\nNotification:\n${heartbeatResult.message}`);
  } else {
    console.log(`Message: ${heartbeatResult.message}`);
  }
  
  // Example 5: Manual check for due reminders
  console.log('\n\n🔍 Example 5: Manual check for due (not yet notified) reminders\n');
  const due = checkDueReminders();
  if (due.length > 0) {
    console.log(`${due.length} reminder(s) due:\n`);
    due.forEach(r => console.log(`  - ${r.task}`));
  } else {
    console.log('No reminders due at this time.');
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('\n✅ Demo complete!\n');
  console.log('Key Features Demonstrated:');
  console.log('  • Natural language parsing');
  console.log('  • Temporal expression resolution');
  console.log('  • Reminder creation with unique IDs');
  console.log('  • Persistent storage in JSON');
  console.log('  • Heartbeat monitoring');
  console.log('  • Automatic notification tracking\n');
}

demo().catch(console.error);
