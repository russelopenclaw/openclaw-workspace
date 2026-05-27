# Reminder Handler - Quick Reference

## For Users

### Create Reminders
Say any of these:
- "Remind me to call Kevin at 3pm"
- "Remind me to check emails tomorrow morning"
- "Remind me to deploy next Monday"
- "Remind me to run in 2 hours"
- "Remind me to test soon"

### Examples
| You Say | When |
|---------|------|
| "at 3pm" | Today at 3:00 PM |
| "tomorrow morning" | Tomorrow at 9:00 AM |
| "next Monday" | Monday at 9:00 AM |
| "in 2 hours" | 2 hours from now |
| "this afternoon" | Today at 3:00 PM |
| "soon" | 1 hour from now |

---

## For Developers

### Quick Start
```javascript
const { handle } = require('./tools/reminder-integration-hook');

// Handle user command
const result = await handle("Remind me to task at 3pm");
console.log(result.message);
```

### API Reference

#### Create Reminder
```javascript
const { handle } = require('./tools/reminder-integration-hook');
const result = await handle("Remind me to [task] [when]");
// → { success: true, message: "⏰ Reminder set for...", reminderCount: 5 }
```

#### Check Due
```javascript
const { check } = require('./tools/reminder-integration-hook');
const status = await check();
// → { hasDue: true, message: "⏰ **Reminders Due:**...", count: 2 }
```

#### Get Status
```javascript
const { getStatus } = require('./tools/reminder-integration-hook');
const stats = getStatus();
// → { total: 10, pending: 7, notified: 3 }
```

### Files
| File | Purpose |
|------|---------|
| `reminder-integration-hook.js` | Main API |
| `reminder-handler-node.js` | Core handler |
| `temporal-resolver-node.js` | Time parsing |
| `brain-parser-node.js` | Command parser |
| `reminder-heartbeat-hook.js` | Heartbeat check |
| `calendar/reminders.json` | Storage |

---

## For Testing

### Run Tests
```bash
cd /workspace
node tools/test-reminder-handler.js
```

### Run Demo
```bash
node tools/demo-reminder-handler.js
```

### Manual Test
```bash
node -e "
const { handle } = require('./tools/reminder-integration-hook');
handle('Remind me to test at 3pm').then(console.log);
"
```

---

## Heartbeat Integration

Add to `HEARTBEAT.md`:

```markdown
### Reminder Check
- Check for due reminders
- Notify user if any are due
```

Or in code:

```javascript
const { checkReminders } = require('./tools/reminder-heartbeat-hook');
const result = await checkReminders();
if (result.notify) {
  await message.send({ channel: 'telegram', message: result.message });
}
```

---

## Storage Format

Location: `/workspace/calendar/reminders.json`

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

---

## Time Resolution

The temporal resolver handles:

### Relative
- "in X hours/minutes/days"
- "tomorrow"
- "today"

### Day of Week
- "Monday", "Tuesday", etc.
- "next Monday"
- "this Friday"

### Time of Day
- "morning" (9:00 AM)
- "afternoon" (3:00 PM)
- "evening" (6:00 PM)
- "tonight" (8:00 PM)
- "at X:XX" or "at Xam/pm"

### Absolute
- "March 15th"
- "May 1"
- "12/25"

### Fuzzy
- "soon" (+1 hour)
- "ASAP" (+1 hour)
- "later" (+3 hours)

---

## Task Status

**task-23: ✅ COMPLETE**  
Next: task-24 (Event handler)

---

*Quick reference v1.0 - 2026-03-03*
