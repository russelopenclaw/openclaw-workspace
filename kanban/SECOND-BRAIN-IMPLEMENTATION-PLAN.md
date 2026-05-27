> ⚠️ **DEPRECATED**: This document references old JSON files.
> PostgreSQL is now the source of truth. See AGENTS.md for current practices.

# Second Brain - Implementation Plan

## 📋 Task Breakdown & Timeline

**Total Estimated Time:** ~2.5 hours  
**Start Time:** 7:14 PM CST  
**Expected Completion:** ~9:45 PM CST

---

## Phase 1: Foundation (Now - 7:30 PM) ⏳

### ✅ brain-8a: Create /brain page with saved items list
- **Assignee:** Jeeves
- **Status:** IN PROGRESS (started 7:14 PM)
- **ETA:** 7:29 PM (15 min)
- **Dependencies:** None
- **Deliverables:**
  - `/app/brain/page.tsx` - Main Brain page UI
  - `/components/brain/BrainList.tsx` - Saved items list
  - `/components/brain/BrainItem.tsx` - Individual item card
  - Clean Linear-style list view with clickable items

### ⏳ brain-8b: Create Brain API endpoints (CRUD, search)
- **Assignee:** Jeeves
- **Status:** Pending
- **ETA:** 7:40 PM (10 min)
- **Dependencies:** brain-8a ✅
- **Deliverables:**
  - `/api/brain/items/route.ts` - GET, POST endpoints
  - `/api/brain/items/search/route.ts` - Search endpoint
  - `/workspace/brain/items.json` - Data store

### ⏳ brain-8c: Implement keyword extraction for saved items
- **Assignee:** Jeeves
- **Status:** Pending
- **ETA:** 7:50 PM (10 min)
- **Dependencies:** brain-8b ✅
- **Deliverables:**
  - `/lib/brain/keywords.ts` - Keyword extraction functions
  - Auto-extract 3-5 keywords from URLs/text
  - Domain detection (YouTube, Medium, etc.)

---

## Phase 2: Natural Language Processing (7:30 PM - 8:15 PM)

### 🔄 brain-8d: Implement natural language parser for commands
- **Assignee:** Alfred
- **Status:** IN PROGRESS (started 7:19 PM)
- **ETA:** 7:39 PM (20 min)
- **Dependencies:** None
- **Deliverables:**
  - `/lib/brain/parser.ts` - Main parser
  - Pattern matching for all command types
  - Return structured parse trees

**Command Patterns:**
```typescript
// Remember commands
/^(remember|save|bookmark):\s*(.+)$/i

// Remind me commands
/^remind me (to (.+?))?\s*(.+)/i

// Event commands
/^(i have|create event|meeting|appointment).+(at|on|tomorrow|today)/i

// Recurring commands
/^(every|each|recurring).+/i
```

### ⏳ brain-8e: Add 'Remember:' command handler
- **Assignee:** Alfred
- **Status:** Pending
- **ETA:** 7:55 PM (15 min)
- **Dependencies:** brain-8d ✅
- **Deliverables:**
  - `/handlers/remember.ts` - Handler function
  - Type detection (article/video/link/note)
  - Metadata fetching for URLs
  - Integration with Brain API

### ⏳ brain-8f: Add temporal expression resolver
- **Assignee:** Alfred
- **Status:** Pending
- **ETA:** 8:15 PM (20 min)
- **Dependencies:** brain-8d ✅
- **Deliverables:**
  - `/lib/brain/temporal.ts` - Time resolver
  - Parse: "this afternoon", "tomorrow morning", "in 2 hours"
  - Parse: "Monday", "next week", "May 15th"
  - Return concrete Date objects

---

## Phase 3: Command Handlers (8:00 PM - 8:45 PM)

### ⏳ brain-8g: Add 'Remind me...' command handler
- **Assignee:** Alfred
- **Status:** Pending
- **ETA:** 8:30 PM (15 min)
- **Dependencies:** brain-8f ✅
- **Deliverables:**
  - `/handlers/reminder.ts` - Handler function
  - Time resolution integration
  - Create calendar reminders
  - Default reminder times (e.g., "afternoon" → 3 PM)

### ⏳ brain-8h: Add 'Create event...' command handler
- **Assignee:** Alfred
- **Status:** Pending
- **ETA:** 8:45 PM (15 min)
- **Dependencies:** brain-8f ✅
- **Deliverables:**
  - `/handlers/event.ts` - Handler function
  - Parse event details (title, time, date)
  - Default duration (1 hour)
  - Auto-add 1-hour-before reminder

### ⏳ brain-8i: Implement recurring event/reminder support
- **Assignee:** Alfred
- **Status:** Pending
- **ETA:** 9:05 PM (20 min)
- **Dependencies:** brain-8g ✅, brain-8h ✅
- **Deliverables:**
  - `/handlers/recurring.ts` - Handler function
  - RRULE format support
  - Parse: "every Monday", "monthly", "bi-weekly"
  - Generate next N occurrences

---

## Phase 4: Integration (8:30 PM - 9:15 PM)

### ⏳ brain-8j: Integrate with Calendar for reminders/events
- **Assignee:** Jeeves
- **Status:** Pending
- **ETA:** 8:40 PM (10 min)
- **Dependencies:** brain-8g ✅, brain-8h ✅
- **Deliverables:**
  - Integration with existing `/api/calendar` endpoints
  - Write to `calendar/events.json` and `calendar/reminders.json`
  - Ensure data consistency

### ⏳ brain-8k: Add heartbeat monitoring for due reminders
- **Assignee:** Alfred
- **Status:** Pending
- **ETA:** 9:15 PM (10 min)
- **Dependencies:** brain-8j ✅
- **Deliverables:**
  - Update `HEARTBEAT.md` with reminder checks
  - Check due reminders every heartbeat
  - Send Telegram notifications
  - Check upcoming events (next hour)

---

## Phase 5: Testing & Polish (9:15 PM - 9:30 PM)

### ⏳ brain-8l: Test all commands end-to-end
- **Assignee:** Alfred
- **Status:** Pending
- **ETA:** 9:30 PM (15 min)
- **Dependencies:** brain-8i ✅, brain-8k ✅
- **Deliverables:**
  - Test all command patterns
  - Verify Brain page displays correctly
  - Test reminder notifications
  - Test recurring events

**Test Cases:**
```
1. "Remember: https://youtube.com/watch?v=abc123"
2. "Remind me to call mom this afternoon"
3. "I have a doctor's appointment at 8:30 on May 15th"
4. "Every Monday at 9am I have team standup"
5. "Remind me tomorrow morning to submit the report"
```

---

## 📊 Critical Path

```
brain-8a (Jeeves, 15m)
    ↓
brain-8b (Jeeves, 10m)
    ↓
brain-8c (Jeeves, 10m)

brain-8d (Alfred, 20m)
    ↓
brain-8f (Alfred, 20m)
    ↓              ↘
brain-8g (15m)   brain-8h (15m)
    ↓              ↓
    └──────┬───────┘
           ↓
    brain-8i (20m)
           ↓
    brain-8j (10m)
           ↓
    brain-8k (10m)
           ↓
    brain-8l (15m)
```

**Critical Path Duration:** ~2 hours  
**Parallel Work:** Jeeves (UI/API) + Alfred (NLP/Handlers)

---

## 🎯 Success Criteria

### Must Have (MVP):
- ✅ Brain page displays saved items
- ✅ Can save items with "Remember:" command
- ✅ Can create reminders with "Remind me..."
- ✅ Can create events with natural language
- ✅ Reminders trigger via heartbeat

### Should Have:
- ✅ Keyword extraction works
- ✅ Time expressions parsed correctly ("afternoon", "tomorrow")
- ✅ Search Brain items
- ✅ Clickable links to original sources

### Nice to Have:
- ✅ Recurring events work
- ✅ YouTube metadata extraction
- ✅ Article content analysis
- ✅ Smart defaults (1-hour events, morning=9am)

---

## 📁 File Structure

```
/workspace/
├── app/brain/
│   └── page.tsx                    # Brain page UI
├── components/brain/
│   ├── BrainList.tsx               # List view
│   └── BrainItem.tsx               # Item card
├── api/brain/
│   └── items/
│       ├── route.ts                # CRUD
│       └── search/route.ts         # Search
├── lib/brain/
│   ├── parser.ts                   # NLP parser
│   ├── temporal.ts                 # Time resolver
│   ├── keywords.ts                 # Keyword extraction
│   └── types.ts                    # TypeScript types
├── handlers/
│   ├── remember.ts                 # Remember handler
│   ├── reminder.ts                 # Reminder handler
│   ├── event.ts                    # Event handler
│   └── recurring.ts                # Recurring handler
└── brain/
    └── items.json                  # Brain database
```

---

## 🚀 Execution Strategy

### Parallel Tracks:

**Track A: Jeeves (UI/API)**
- Focus: Brain page, API endpoints, keyword extraction
- Blocks: Nothing (can start immediately)
- Unblocks: Alfred's command handlers (needs API)

**Track B: Alfred (NLP/Logic)**
- Focus: Parser, temporal resolver, command handlers
- Dependencies: None for parser, needs API for handlers
- Unblocks: Recurring support, heartbeat integration

### Handoff Points:
1. **7:30 PM:** Jeeves finishes Brain page → Alfred can test parser
2. **7:40 PM:** Jeeves finishes API → Alfred can implement handlers
3. **8:30 PM:** Both tracks merge → Integration phase

---

## 📝 Notes

- **Task Updates:** Update `kanban/tasks.json` as subtasks complete
- **Subagent Tracking:** Update `kanban/subagents.json` when spawning
- **Agent Status:** Update every 10-15 minutes in `tasks.json`
- **Completion:** Move task #8 to "done" when all subtasks complete

---

**Current Status:** Phase 1 in progress, Alfred implementing parser, Jeeves building UI  
**Next Milestone:** 7:30 PM - Parser complete, UI complete, ready for API integration
