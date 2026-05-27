# Second Brain - Reminder Handler

## Overview

The Reminder Handler implements the "Remind me to..." command for the Second Brain system. It parses natural language time expressions, creates reminders, and provides heartbeat monitoring for due notifications.

## Implemented: task-23 ✅

**Status:** COMPLETE  
**Date:** 2026-03-03  
**Assignee:** Alfred

## Features

### 1. Command Parsing
- Supports natural language inputs:
  - "Remind me to call Kevin at 3pm"
  - "Remind me to check emails tomorrow morning"
  - "Remind me to deploy next Monday"
- Uses `brain-parser-node.js` for pattern matching
- Extracts task and temporal expression

### 2. Temporal Resolution
- Located in: `tools/temporal-resolver-node.js`
- Handles fuzzy time expressions:
  - **Relative:** "in 2 hours", "tomorrow", "today"
  - **Day of week:** "Monday", "next Monday"
  - **Time of day:** "morning", "afternoon", "at 3pm"
  - **Absolute dates:** "March 15th", "May 1"
  - **Fuzzy:** "soon", "ASAP", "later"

### 3. Reminder Storage
- File: `/workspace/calendar/reminders.json`
- Structure:
  ```json
  {
    "reminders": [
      {
        "id": "rem_mmbfpass_a2c4cv",
        "task": "call Kevin",
        "dueDate": "2026-03-03T21:00:00.000Z",
        "createdAt": "2026-03-03T20:45:24.000Z",
        "notified": false
      }
    ],
    "metadata": {
      "lastUpdated": "2026-03-03T20:45:24.000Z",
      "version": "1.0"
    }
  }
  ```

### 4. Heartbeat Monitoring
- File: `tools/reminder-heartbeat-hook.js`
- Checks for due reminders every heartbeat cycle
- Marks reminders as notified after alerting
- Formats user-friendly notifications

## Files Created

| File | Purpose |
|------|---------|
| `tools/reminder-handler.ts` | TypeScript implementation |
| `tools/reminder-handler-node.js` | JavaScript runtime version |
| `tools/temporal-resolver-node.js` | JavaScript temporal resolver |
| `tools/brain-parser-node.js` | JavaScript command parser |
| `tools/reminder-heartbeat-hook.js` | Heartbeat check function |
| `tools/test-reminder-handler.js` | Test suite |
| `calendar/reminders.json` | Reminder storage |

## Usage

### Creating Reminders

```javascript
const { parseCommand } = require('./tools/brain-parser-node');
const { handleReminder } = require('./tools/reminder-handler-node');

// Parse user input
const parsed = parseCommand("Remind me to call Kevin at 3pm");

// Create reminder
const result = await handleReminder(parsed);
// Returns: { success: true, message: "⏰ Reminder set for..." }
```

### Checking Due Reminders (Heartbeat)

```javascript
const { checkReminders } = require('./tools/reminder-heartbeat-hook');

// Check and get due reminders
const result = await checkReminders();
// Returns: { status: 'success', notify: true, message: '...', reminderCount: 2 }
```

### API Functions

#### `handleReminder(parsed)`
Creates a new reminder from parsed command.
- **Input:** `{ task: string, when: string }`
- **Output:** `{ success: boolean, message: string }`

#### `checkDueReminders()`
Returns array of reminders due now (within 5-minute window).
- **Output:** `Reminder[]`

#### `markReminderNotified(id)`
Marks a reminder as notified.
- **Input:** `reminderId` (string)
- **Output:** `boolean` (success)

#### `getAllReminders()`
Returns all reminders.
- **Output:** `Reminder[]`

#### `deleteReminder(id)`
Deletes a reminder by ID.
- **Input:** `reminderId` (string)
- **Output:** `boolean` (success)

## Test Results

All test cases pass:

| Test Case | Status | Notes |
|-----------|--------|-------|
| "Remind me to call Kevin at 3pm" | ✅ | Parsed time: 3:00 PM today |
| "Remind me to check emails tomorrow morning" | ✅ | Parsed time: 9:00 AM tomorrow |
| "Remind me to deploy next Monday" | ✅ | Parsed time: 9:00 AM next Monday |
| "Remind me to test soon" | ✅ | Parsed time: 1 hour from now |
| "Remind me to run in 2 hours" | ✅ | Parsed time: +2 hours |
| "Remind me to backup this afternoon" | ✅ | Parsed time: 3:00 PM today |

## Temporal Resolution Examples

| Expression | Resolution |
|------------|-----------|
| "at 3pm" | Today 3:00 PM |
| "tomorrow morning" | Tomorrow 9:00 AM |
| "next Monday" | Monday 9:00 AM (next week) |
| "in 2 hours" | Now + 2 hours |
| "soon" | Now + 1 hour |
| "this afternoon" | Today 3:00 PM |

## Heartbeat Integration

Add to HEARTBEAT.md:

```markdown
### Reminder Check
- [ ] Check for due reminders
- [ ] Notify user if any reminders are due
```

Or programmatically:

```javascript
const result = await checkReminders();
if (result.notify) {
  // Send message to user via Telegram
  await message.send({ 
    channel: 'telegram', 
    message: result.message 
  });
}
```

## Dependencies

- **brain-8f** ✅ (temporal resolver)
- Node.js filesystem (fs, path)
- No external packages required

## Next Steps

- [ ] task-24: Event handler implementation
- [ ] task-25: Recurring events support
- [ ] task-26: Calendar integration
- [ ] task-27: Heartbeat monitoring (DONE - this implementation)

## Notes

- Reminder ID format: `rem_<timestamp>_<random>`
- Due window: 5 minutes before/after scheduled time
- Automatic notification marking prevents duplicate alerts
- Timezone-aware using system timezone
