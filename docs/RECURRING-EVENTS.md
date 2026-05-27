# Recurring Events Implementation

## Overview

The Second Brain calendar system now supports recurring events with natural language pattern recognition. Users can create events that repeat on various schedules.

## Supported Patterns

### Weekly Patterns

- **"Every Monday at 9am"** → `FREQ=WEEKLY;BYDAY=MO`
- **"Every Friday at 5pm"** → `FREQ=WEEKLY;BYDAY=FR`
- **"Every weekday at 8am"** → `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR`
- **"Every week"** → `FREQ=WEEKLY`

### Interval Patterns

- **"Every 2 weeks on Friday"** → `FREQ=WEEKLY;INTERVAL=2;BYDAY=FR`
- **"Every 3 months"** → `FREQ=MONTHLY;INTERVAL=3`
- **"Every 6 months"** → `FREQ=MONTHLY;INTERVAL=6`

### Monthly Patterns

- **"Every 1st of month at 6pm"** → `FREQ=MONTHLY;BYMONTHDAY=1`
- **"Every 15th of month"** → `FREQ=MONTHLY;BYMONTHDAY=15`

### Other Patterns

- **"Every day"** → `FREQ=DAILY`
- **"Every year"** → `FREQ=YEARLY`

## Usage Examples

### Creating Recurring Events

```javascript
// Weekly standup
await handle('Create event Weekly standup every Monday at 9am');
// Output: ✅ Recurring event created: Weekly standup
//         📅 Mon, Mar 2, 2026, 9:00 AM
//         🔁 Weekly on monday

// Daily scrum
await handle('Create event Daily scrum every weekday at 8am');
// Output: ✅ Recurring event created: Daily scrum
//         📅 Mon, Mar 2, 2026, 8:00 AM
//         🔁 Every weekday

// Monthly review
await handle('Create event Monthly review every 1st of month at 6pm');
// Output: ✅ Recurring event created: Monthly review at 6pm
//         📅 Sun, Mar 1, 2026, 6:00 PM
//         🔁 Monthly on the 1st

// Bi-weekly sync
await handle('Create event Bi-weekly sync every 2 weeks on Friday');
// Output: ✅ Recurring event created: Bi-weekly sync
//         📅 Fri, Mar 6, 2026, 2:00 PM
//         🔁 Every 2 weeks on friday
```

## File Structure

```
/workspace/
├── tools/
│   ├── temporal-resolver-node.js    # Time expression resolver
│   ├── recurrence-parser.js         # Recurrence pattern parser (NEW)
│   └── recurring-occurrences.js     # Occurrence generator (NEW)
├── calendar/
│   └── events.json                  # Event storage with recurrence field
└── openclaw-commands/
    └── event.js                     # Event handler (UPDATED)
```

## Event Schema

Recurring events include additional fields:

```json
{
  "id": "evt-1772597202328",
  "title": "Team lunch",
  "start": "2026-03-06T18:00:00.000Z",
  "end": "2026-03-06T19:00:00.000Z",
  "recurrence": "FREQ=WEEKLY;BYDAY=FR",
  "recurrenceDescription": "Every friday",
  "createdAt": "2026-03-04T04:06:42.328Z"
}
```

### Fields

- **`recurrence`**: RRULE-like format string
- **`recurrenceDescription`**: Human-readable description

## RRULE Format

The system uses a simplified RRULE format:

| Component | Description | Example |
|-----------|-------------|---------|
| `FREQ` | Frequency type | `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY` |
| `INTERVAL` | Repeat interval | `2` (every 2 weeks), `3` (every 3 months) |
| `BYDAY` | Day(s) of week | `MO`, `FR`, `MO,TU,WE,TH,FR` |
| `BYMONTHDAY` | Day of month | `1`, `15`, `31` |

## Generating Occurrences

Use the occurrence generator to expand recurring events into specific instances:

```javascript
const { generateOccurrences, getOccurrencesInRange } = require('./tools/recurring-occurrences.js');

// Generate next 5 occurrences
const occurrences = generateOccurrences(event, 5, new Date());

// Get all occurrences within a date range
const range = getOccurrencesInRange(events, startDate, endDate);
```

## Implementation Details

### Files Modified

1. **`tools/recurrence-parser.js`** (NEW)
   - `parseRecurrence()` - Parses natural language to RRULE
   - `rruleToHuman()` - Converts RRULE to readable text
   - `getNextOccurrence()` - Calculates next occurrence date
   - `extractTime()` - Extracts time from patterns

2. **`tools/recurring-occurrences.js`** (NEW)
   - `generateOccurrences()` - Generates N occurrences
   - `getOccurrencesInRange()` - Filters occurrences by date range

3. **`openclaw-commands/event.js`** (UPDATED)
   - Added recurrence detection
   - Modified event creation to handle recurring patterns
   - Updated confirmation messages

## Testing

Run tests with:

```bash
node test-recurring-events.js   # Pattern parsing tests
node test-occurrences.js         # Occurrence generation tests
```

## Future Enhancements

- Support for end dates (`UNTIL`)
- Support for occurrence count (`COUNT`)
- Exclude specific dates (`EXDATE`)
- UI to manage recurring event instances
- Delete/edit single occurrence vs. all occurrences
