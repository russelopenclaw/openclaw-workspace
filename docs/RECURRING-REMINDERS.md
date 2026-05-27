# Recurring Reminders - System Documentation

**Created:** 2026-03-17  
**Feature:** Monthly recurring reminders with auto-generation

---

## Overview

The Mission Control reminders system now supports recurring reminders that automatically generate the next occurrence when completed.

---

## How It Works

### 1. Recurring Rule Format

Reminders use RRULE-like format in the `recurring_rule` field:

| Pattern | Example | Meaning |
|---------|---------|---------|
| Weekly | `FREQ=WEEKLY;BYDAY=TU` | Every Tuesday |
| Bi-weekly | `FREQ=WEEKLY;INTERVAL=2;BYDAY=FR` | Every 2 weeks on Friday |
| Weekdays | `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR` | Every weekday |
| Monthly (date) | `FREQ=MONTHLY;BYMONTHDAY=15` | 15th of every month |
| **Monthly (ordinal)** | `FREQ=MONTHLY;BYDAY=3TU` | **3rd Tuesday of every month** |
| Yearly | `FREQ=YEARLY` | Same date every year |

### 2. Auto-Generation Flow

1. **Reminder becomes due** → Heartbeat sends Telegram alert
2. **User marks completed** → `completed = true` in database
3. **Next heartbeat detects** → Finds completed recurring reminder
4. **Auto-generates next** → Creates new reminder with next occurrence date
5. **Sends notification** → Telegram message with next occurrence info

### 3. Database Schema

```sql
CREATE TABLE reminders (
  id              VARCHAR(50) PRIMARY KEY,
  title           VARCHAR(500) NOT NULL,
  due_date        DATE NOT NULL,
  due_time        TIME,
  recurring_rule  VARCHAR(500),      -- RRULE format
  recurring_until DATE,              -- Stop generating after this date
  completed       BOOLEAN DEFAULT false,
  notified_at     TIMESTAMP,         -- When alert was sent
  description     TEXT,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
```

---

## Example: Deacons Meeting

**Original reminder:**
```
ID: rem-1772639702287
Title: Deacons Meeting
Due: 2026-03-17 at 18:00 (6:00 PM)
Recurring: FREQ=MONTHLY;BYDAY=3TU
Until: 2027-12-31
```

**When completed today (March 17, 2026):**
- System auto-generates: `rem-1772639702287-occ-1`
- Next date: **April 21, 2026 at 6:00 PM** (3rd Tuesday of April)
- Telegram alert: "🔄 Recurring reminder created: Deacons Meeting (occ 1) | Next: 2026-04-21 at 18:00 | Pattern: Monthly on the 3rd tuesday"

**Upcoming occurrences:**
1. April 21, 2026 - Tuesday, Apr 21
2. May 19, 2026 - Tuesday, May 19
3. June 16, 2026 - Tuesday, Jun 16
4. July 21, 2026 - Tuesday, Jul 21
5. August 18, 2026 - Tuesday, Aug 18

---

## Files

| File | Purpose |
|------|---------|
| `tools/recurrence-parser.js` | Parse RRULE format, calculate next occurrence |
| `tools/recurring-reminder-manager.js` | Auto-generate next occurrences |
| `tools/heartbeat-runner.js` | Integrated into heartbeat checks |
| `docs/RECURRING-REMINDERS.md` | This documentation |

---

## Usage

### Create a Recurring Reminder

```sql
INSERT INTO reminders (id, title, due_date, due_time, recurring_rule, recurring_until, description)
VALUES (
  'monthly-team-meeting',
  'Team Meeting',
  '2026-03-17',
  '14:00:00',
  'FREQ=MONTHLY;BYDAY=2TU',  -- 2nd Tuesday
  '2027-12-31',
  'Monthly team sync'
);
```

### Mark as Completed (Triggers Auto-Generation)

```sql
UPDATE reminders SET completed = true WHERE id = 'monthly-team-meeting';
```

Next heartbeat will auto-generate the next occurrence.

### View Upcoming Occurrences

```bash
node tools/recurring-reminder-manager.js
```

Or query directly:
```sql
SELECT id, title, due_date, due_time, recurring_rule
FROM reminders
WHERE completed = false
ORDER BY due_date, due_time;
```

---

## Supported Patterns

### Weekly
- `FREQ=WEEKLY;BYDAY=MO` - Every Monday
- `FREQ=WEEKLY;BYDAY=MO,WE,FR` - Mon, Wed, Fri
- `FREQ=WEEKLY;INTERVAL=2;BYDAY=FR` - Every 2 weeks on Friday

### Monthly
- `FREQ=MONTHLY;BYMONTHDAY=1` - 1st of every month
- `FREQ=MONTHLY;BYDAY=1TU` - 1st Tuesday
- `FREQ=MONTHLY;BYDAY=3TU` - 3rd Tuesday ✅
- `FREQ=MONTHLY;BYDAY=-1FR` - Last Friday (TODO: implement negative ordinal)

### Yearly
- `FREQ=YEARLY` - Same date every year
- `FREQ=YEARLY;INTERVAL=2` - Every 2 years

---

## Heartbeat Integration

The heartbeat runner checks for completed recurring reminders every cycle:

1. Queries for `completed = true AND recurring_rule IS NOT NULL AND notified_at IS NULL`
2. Calls `recurringManager.handleRecurringReminder(id)`
3. Generates next occurrence with `getNextOccurrence()`
4. Inserts new reminder with `-occ-N` suffix
5. Marks original as `notified_at = NOW()`
6. Sends Telegram notification

**Cache-friendly:** Only processes each completed reminder once.

---

## Future Enhancements

- [ ] Support negative ordinals (last Friday: `-1FR`)
- [ ] Support `BYSETPOS` for complex patterns
- [ ] Web UI for managing recurring reminders
- [ ] Skip specific occurrences (holiday exceptions)
- [ ] Email notifications in addition to Telegram

---

## Troubleshooting

### Next occurrence not generating?
1. Check `recurring_rule` is set: `SELECT id, recurring_rule FROM reminders WHERE id = '...'`
2. Check `recurring_until` hasn't passed
3. Check heartbeat logs for errors
4. Manually test: `node tools/recurring-reminder-manager.js`

### Wrong date calculated?
1. Verify RRULE format (use `3TU` not `3TUE`)
2. Test parser: `node -e "const {getNextOccurrence} = require('./tools/recurrence-parser.js'); console.log(getNextOccurrence('FREQ=MONTHLY;BYDAY=3TU', new Date()))"`
3. Check timezone (all dates are UTC in database)

---

**Status:** ✅ Production Ready (tested 2026-03-17)
