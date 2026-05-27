# Scheduled Jobs Section - Calendar Page

## What Was Added

Added a new "🤖 Scheduled Jobs" section to the Calendar page (`/calendar`) that displays all cron jobs/scheduled tasks.

## Features

- **Shows all 3 scheduled cron jobs:**
  1. Morning Briefing (8:00 AM daily)
  2. Evening Summary (8:00 PM daily)
  3. Heartbeat Check (every 30 minutes)

- **Displays for each job:**
  - Job description/name
  - Cron schedule (e.g., `0 8 * * *`)
  - Next run time (calculated dynamically)

- **Auto-refreshes:** Next run times update every 30 seconds

## Implementation

**File:** `/workspace/mission-control/src/app/calendar/page.tsx`

**Changes:**
1. Added `CronJob` interface
2. Added `cronJobs` state array
3. Added `calculateNextRun()` function to compute next execution time
4. Added new Section 3 with job cards

**Location in UI:**
- Section 1: Next 5 Days (existing)
- Section 2: Monthly Calendar (existing)
- **Section 3: Scheduled Jobs (NEW)** ← Added here

## Visual Design

Matches the existing "Next 5 Days" style:
- Same card layout with icons
- Same color scheme (dark background, light text)
- Cron schedule shown in monospace font with background highlight
- Next run time formatted as "Wed, Mar 4, 8:00 AM"

## Cron Jobs Displayed

| Job | Schedule | Next Run |
|-----|----------|----------|
| Morning Briefing | `0 8 * * *` | Tomorrow at 8:00 AM |
| Evening Summary | `0 20 * * *` | Today at 8:00 PM |
| Heartbeat Check | `*/30 * * * *` | Next half-hour mark |

## Future Enhancements

Could be extended to show:
- Job execution history
- Last run status (success/failure)
- Manual trigger buttons
- Edit schedule functionality
- Add/remove jobs via UI
