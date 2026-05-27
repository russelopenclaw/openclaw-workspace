# Second Brain System Architecture

## Overview

A personal assistant-style knowledge management system that understands natural language commands for:
- **Remember:** Save articles, videos, links, notes
- **Remind me:** Create smart reminders with natural language timing
- **Create event:** Add calendar events with intelligent parsing
- **Recurring:** Set up repeating meetings and reminders

---

## System Components

### 1. Natural Language Parser (`/lib/brain/parser.ts`)

**Purpose:** Parse user commands into structured actions

**Command Patterns:**

#### A. Remember Command
```
"Remember: [URL/content]"
"Save this: [URL]"
"Bookmark this article: [URL]"
```

**Parsed Output:**
```typescript
{
  type: "remember",
  itemType: "article|video|link|note",
  content: string | URL,
  title?: string,
  metadata?: object
}
```

#### B. Remind Me Command
```
"Remind me to call mom this afternoon"
"Remind me tomorrow morning to submit the report"
"Remind me in 2 hours to check the oven"
"Remind me next Monday to pay bills"
```

**Parsed Output:**
```typescript
{
  type: "reminder",
  task: "call mom",
  when: {
    type: "relative", // or "absolute"
    value: "this afternoon",
    resolvedTime: "2026-03-03T15:00:00-06:00"
  },
  isRecurring?: false
}
```

#### C. Create Event Command
```
"I have a doctor's appointment at 8:30 on May 15th"
"Meeting with John tomorrow at 2pm"
"Dinner reservation Friday night at 7"
```

**Parsed Output:**
```typescript
{
  type: "event",
  title: "Doctor's appointment",
  start: "2026-05-15T08:30:00-06:00",
  end?: "2026-05-15T09:30:00-06:00",
  allDay?: false,
  description?: string,
  isRecurring?: false
}
```

#### D. Recurring Command
```
"Every Monday at 9am I have team standup"
"Remind me every Friday to submit timesheet"
"Monthly team lunch on the first Tuesday"
"Bi-weekly therapy appointment"
```

**Parsed Output:**
```typescript
{
  type: "recurring",
  itemType: "event|reminder",
  frequency: "daily|weekly|monthly|yearly",
  interval?: 1, // every N weeks
  dayOfWeek?: "monday",
  dayOfMonth?: 1, // first day of month
  time?: "09:00",
  task?: "submit timesheet",
  title?: "Team standup"
}
```

---

### 2. Temporal Expression Resolver (`/lib/brain/temporal.ts`)

**Purpose:** Convert fuzzy time expressions to concrete dates

**Supported Expressions:**

#### Relative Times:
- "this afternoon" → Today 3:00 PM - 5:00 PM
- "this evening" → Today 6:00 PM - 9:00 PM
- "tonight" → Today 8:00 PM
- "tomorrow morning" → Tomorrow 9:00 AM
- "tomorrow afternoon" → Tomorrow 2:00 PM
- "next week" → Next Monday
- "next month" → 1st of next month
- "in 2 hours" → Now + 2 hours
- "in 30 minutes" → Now + 30 min

#### Day Resolution:
- "Monday", "Tuesday", etc. → Next occurrence
- "this Monday" → Monday of current week
- "next Monday" → Monday of next week
- "last Monday" → Monday of previous week

#### Time Resolution:
- "morning" → 9:00 AM
- "afternoon" → 2:00 PM
- "evening" → 6:00 PM
- "night" → 8:00 PM
- "noon" → 12:00 PM
- "midnight" → 12:00 AM

**Implementation:**
```typescript
function resolveTime(expression: string, baseDate = new Date()): Date {
  // Parse expression
  // Apply rules
  // Return concrete date
}
```

---

### 3. Keyword Extractor (`/lib/brain/keywords.ts`)

**Purpose:** Auto-extract 3-5 keywords/topics from saved content

**Methods:**

#### A. URL Content Analysis
```typescript
async function extractKeywordsFromURL(url: string): Promise<string[]> {
  // Fetch page metadata (title, description)
  // Extract domain type (youtube, medium, etc.)
  // Parse OpenGraph tags
  // Return keywords
}
```

#### B. Text Analysis
```typescript
function extractKeywordsFromText(text: string): string[] {
  // Tokenize
  // Remove stopwords
  // Calculate word frequency
  // Use TF-IDF for importance
  // Return top 5 keywords
}
```

#### C. YouTube-Specific
```typescript
async function extractYouTubeKeywords(url: string): Promise<string[]> {
  // Fetch video title, description, tags
  // Extract channel name
  // Return keywords
}
```

---

### 4. Command Handlers

#### A. Remember Handler (`/handlers/remember.ts`)
```typescript
async function handleRemember(parsed: ParsedRemember): Promise<SavedItem> {
  // 1. Detect type (article, video, link, note)
  // 2. Fetch metadata if URL
  // 3. Extract keywords
  // 4. Save to brain/items.json
  // 5. Return confirmation
}
```

#### B. Reminder Handler (`/handlers/reminder.ts`)
```typescript
async function handleReminder(parsed: ParsedReminder): Promise<Reminder> {
  // 1. Resolve time expression
  // 2. Create calendar reminder
  // 3. Add to calendar/reminders.json
  // 4. Set up heartbeat monitoring
  // 5. Return confirmation with reminder time
}
```

#### C. Event Handler (`/handlers/event.ts`)
```typescript
async function handleEvent(parsed: ParsedEvent): Promise<CalendarEvent> {
  // 1. Parse/resolve date/time
  // 2. Create calendar event
  // 3. Add to calendar/events.json
  // 4. Set default reminders (1 hour before)
  // 5. Return confirmation
}
```

#### D. Recurring Handler (`/handlers/recurring.ts`)
```typescript
async function handleRecurring(parsed: ParsedRecurring): Promise<RecurringRule> {
  // 1. Create recurrence rule (RRULE format)
  // 2. Generate next N occurrences
  // 3. Add to calendar/events.json with rrule
  // 4. Set up heartbeat to create future occurrences
  // 5. Return confirmation
}
```

---

## Data Structures

### Brain Items (`/workspace/brain/items.json`)
```json
{
  "items": [
    {
      "id": "uuid",
      "type": "article|video|link|note",
      "title": "User-provided or extracted title",
      "url": "https://original.com",
      "content": "Full text or summary",
      "keywords": ["keyword1", "keyword2"],
      "metadata": {
        "domain": "youtube.com",
        "author": "Author name",
        "publishedDate": "2026-03-01"
      },
      "createdAt": "2026-03-03T19:14:00-06:00"
    }
  ]
}
```

### Calendar Events (`/workspace/calendar/events.json`)
```json
{
  "events": [
    {
      "id": "uuid",
      "title": "Event title",
      "start": "2026-05-15T08:30:00-06:00",
      "end": "2026-05-15T09:30:00-06:00",
      "allDay": false,
      "description": "Optional description",
      "reminders": [
        {
          "type": "notification",
          "minutesBefore": 60
        }
      ],
      "recurrence": {
        "frequency": "weekly",
        "interval": 1,
        "byDay": "MO",
        "count": null // null = infinite
      }
    }
  ]
}
```

### Reminders (`/workspace/calendar/reminders.json`)
```json
{
  "reminders": [
    {
      "id": "uuid",
      "task": "Call mom",
      "due": "2026-03-03T15:00:00-06:00",
      "completed": false,
      "recurrence": null
    }
  ]
}
```

---

## Integration Points

### 1. Message Handler Hook
```typescript
// Called on every user message
async function onMessageReceived(message: string) {
  // Check for Second Brain commands
  if (message.match(/^(remember|save|bookmark):/i)) {
    const parsed = parseRemember(message);
    await handleRemember(parsed);
  } else if (message.match(/^remind me/i)) {
    const parsed = parseReminder(message);
    await handleReminder(parsed);
  } else if (message.match(/^(create event|i have|meeting)/i)) {
    const parsed = parseEvent(message);
    await handleEvent(parsed);
  }
}
```

### 2. Heartbeat Integration
```typescript
// Every heartbeat (~30 min)
async function onHeartbeat() {
  const now = new Date();
  
  // Check due reminders
  const dueReminders = await getRemindersDue(now);
  for (const reminder of dueReminders) {
    await sendNotification(reminder);
  }
  
  // Check upcoming events (next hour)
  const upcomingEvents = await getEventsStartingSoon(now);
  for (const event of upcomingEvents) {
    await sendEventReminder(event);
  }
  
  // Generate recurring event occurrences
  await generateRecurringOccurrences();
}
```

### 3. Brain Page Integration
- `/brain` page displays saved items
- Search queries brain/items.json
- Clickable links to original sources
- Keyword chips for filtering

---

## User Experience Examples

### Example 1: Save Article
**User:** "Remember: https://example.com/article"

**Alfred:** "✅ Saved article: 'Example Article Title'
- Type: Article
- Keywords: technology, AI, machine learning
- Added to Brain"

### Example 2: Quick Reminder
**User:** "Remind me to call mom this afternoon"

**Alfred:** "⏰ Reminder set for today at 3:00 PM: Call mom"

### Example 3: Calendar Event
**User:** "I have a doctor's appointment at 8:30 on May 15th"

**Alfred:** "📅 Event created: Doctor's appointment
- Date: Friday, May 15, 2026
- Time: 8:30 AM - 9:30 AM (default 1 hour)
- Reminder: 1 hour before (7:30 AM)"

### Example 4: Recurring Meeting
**User:** "Every Monday at 9am I have team standup"

**Alfred:** "🔄 Recurring event created: Team standup
- Frequency: Weekly (every Monday)
- Time: 9:00 AM
- Next occurrence: Monday, March 9 at 9:00 AM"

### Example 5: Natural Language
**User:** "Remind me tomorrow morning to submit the report"

**Alfred:** "⏰ Reminder set for tomorrow (Wednesday) at 9:00 AM: Submit the report"

---

## Implementation Phases

### Phase 1: Foundation (Today)
- [x] Brain page UI (Jeeves)
- [ ] Natural language parser (Alfred)
- [ ] Temporal expression resolver (Alfred)
- [ ] Keyword extraction (Jeeves)

### Phase 2: Command Handlers (Tomorrow)
- [ ] Remember handler
- [ ] Reminder handler  
- [ ] Event handler
- [ ] Test with sample commands

### Phase 3: Advanced Features
- [ ] Recurring event support
- [ ] YouTube video metadata
- [ ] Article content fetching
- [ ] Search integration

### Phase 4: Polish
- [ ] Smart defaults
- [ ] Better error messages
- [ ] Confirmation UI
- [ ] Undo/delete support

---

## Files to Create

```
/lib/brain/
├── parser.ts           # Natural language parser
├── temporal.ts         # Time expression resolver
├── keywords.ts         # Keyword extraction
├── types.ts            # TypeScript types
└── utils.ts            # Helper functions

/handlers/
├── remember.ts         # Remember command handler
├── reminder.ts         # Reminder command handler
├── event.ts            # Event command handler
└── recurring.ts        # Recurring event handler

/workspace/brain/
└── items.json          # Brain items database
```

---

## Priority Order

1. **Must Have (MVP):**
   - Brain page ✅ (building now)
   - Remember command
   - Reminder with relative time
   - Event creation

2. **Should Have:**
   - Keyword extraction
   - Search functionality
   - Natural language time parsing
   - Heartbeat notifications

3. **Nice to Have:**
   - Recurring events
   - YouTube metadata
   - Article content analysis
   - Advanced search filters

---

**Status:** Architecture defined, UI in progress, ready to implement parsers and handlers.
