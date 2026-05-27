> ⚠️ **DEPRECATED**: This document references old JSON files.
> PostgreSQL is now the source of truth. See AGENTS.md for current practices.
> **Note:** This migration plan was completed on 2026-03-05.

# PostgreSQL Migration Plan

**Analysis Date:** March 5, 2026  
**Analyst:** Alfred  
**Status:** Planning Phase

---

## Executive Summary

After system analysis, **PostgreSQL is recommended** for Mission Control data due to:
- Multiple concurrent agent writes (Alfred, Jeeves, subagents)
- Real-time dashboard reads (Kanban, Calendar, Agent Status)
- Data integrity requirements (ACID compliance)
- Elimination of JSON file corruption issues

---

## Systems Analysis

### Current JSON-Based Data Stores

| System | File(s) | Size | Update Frequency | Concurrent Access | Migration Priority |
|--------|---------|------|------------------|-------------------|-------------------|
| **Kanban/Tasks** | `kanban/tasks.json` | 28KB | High (every msg) | High (multi-agent) | 🔴 **CRITICAL** |
| **Agent Status** | `kanban/subagents.json`, `alfred-hub/agent-status.json` | 6KB | High | High | 🔴 **CRITICAL** |
| **Calendar** | `calendar/events.json`, `calendar/reminders.json` | 8KB | Medium | Medium | 🟡 HIGH |
| **Brain** | API + JSON (items) | ~500KB est | Medium | Low | 🟡 HIGH |
| **Memory** | mem0 (JSON + embeddings) | ~500KB | Low | Low | 🟢 MEDIUM |

### Mission Control API Endpoints Using JSON

```
/api/tasks          → kanban/tasks.json
/api/status         → alfred-hub/agent-status.json
/api/subagents      → kanban/subagents.json
/api/calendar/*     → calendar/events.json, reminders.json
/api/brain/*        → Brain APIs (already structured)
/api/memory/*       → Mem0 API (already has DB-like structure)
```

---

## Recommended PostgreSQL Schema

### Core Tables (Phase 1 - Critical)

```sql
-- Agents table
CREATE TABLE agents (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('working', 'idle', 'offline')),
    current_task TEXT,
    last_activity TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks table with full history support
CREATE TABLE tasks (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    column VARCHAR(50) NOT NULL,
    assignee VARCHAR(50),
    priority VARCHAR(20) DEFAULT 'medium',
    description TEXT,
    parent_task_id VARCHAR(50) REFERENCES tasks(id),
    linked_subagent VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task history (for audit trail)
CREATE TABLE task_history (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(50) REFERENCES tasks(id),
    status VARCHAR(50),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    note TEXT
);

-- Subagents table
CREATE TABLE subagents (
    run_id VARCHAR(100) PRIMARY KEY,
    label VARCHAR(200),
    task VARCHAR(500),
    status VARCHAR(20),
    runtime VARCHAR(20),
    total_tokens BIGINT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    note TEXT
);
```

### Calendar Tables (Phase 2 - High Priority)

```sql
-- Events table
CREATE TABLE calendar_events (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    event_type VARCHAR(50) DEFAULT 'personal',
    recurrence TEXT,
    recurrence_description VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reminders table
CREATE TABLE calendar_reminders (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    reminder_date DATE NOT NULL,
    reminder_time TIME,
    recurring BOOLEAN DEFAULT FALSE,
    recurrence TEXT,
    recurrence_description VARCHAR(200),
    completed BOOLEAN DEFAULT FALSE,
    notified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Brain/Memory Tables (Phase 3 - Can Wait)

```sql
-- Brain items (knowledge base)
CREATE TABLE brain_items (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500),
    content TEXT,
    url TEXT,
    item_type VARCHAR(50),
    keywords TEXT[],
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for full-text search
CREATE INDEX brain_items_search_idx ON brain_items USING GIN (to_tsvector('english', content));
```

---

## Migration Strategy

### Phase 1: Foundation (Critical)
**Estimated Time:** 2-3 hours  
**Assigned To:** Jeeves (with Alfred orchestration)

1. **PostgreSQL Setup**
   - Install PostgreSQL 16 (native or Docker)
   - Create database: `mission_control`
   - Create user: `alfred` with restricted permissions
   - Run schema creation scripts

2. **Data Migration**
   - Migrate `kanban/tasks.json` → `tasks` + `task_history` tables
   - Migrate `kanban/subagents.json` → `subagents` table
   - Migrate `alfred-hub/agent-status.json` → `agents` table
   - Verify data integrity (row counts, spot checks)

3. **API Layer Update**
   - Install `pg` npm package in mission-control
   - Create database connection pool
   - Update `/api/tasks/route.ts` to use SQL
   - Update `/api/status/route.ts` to use SQL
   - Update `/api/subagents/route.ts` to use SQL
   - Add proper error handling

4. **Agent Hook Updates**
   - Update `tools/agent-status-hook.js` to write to PostgreSQL
   - Update `tools/openclaw-hooks.js` to use SQL
   - Test concurrent writes (spawn multiple subagents)

5. **Cleanup**
   - Backup old JSON files
   - Remove old JSON files from active use
   - Update documentation

### Phase 2: Calendar (High Priority)
**Estimated Time:** 1-2 hours

1. Migrate `calendar/events.json` → `calendar_events`
2. Migrate `calendar/reminders.json` → `calendar_reminders`
3. Update `/api/calendar/*` endpoints
4. Update heartbeat reminder checks

### Phase 3: Brain/Memory (Optional)
**Estimated Time:** 2-4 hours (lower priority)

1. Migrate Brain items to PostgreSQL
2. Keep mem0 for semantic search (it's already optimized)
3. Add full-text search as alternative to embeddings

---

## Technical Requirements

### Database Connection String
```
postgresql://alfred:password@localhost:5432/mission_control
```

### Connection Pool Configuration (Node.js)
```javascript
const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'mission_control',
  user: 'alfred',
  password: 'generate_secure_password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Migration Scripts Location
```
/workspace/tools/migrations/
├── 001-create-schema.sql
├── 002-migrate-tasks.js
├── 003-migrate-subagents.js
├── 004-migrate-calendar.js
└── rollback/
```

### Backup Strategy
```bash
# Daily automated backup (cron)
pg_dump -U alfred mission_control > /backups/mission_control_$(date +%Y%m%d).sql

# Restore if needed
psql -U alfred mission_control < /backups/mission_control_YYYYMMDD.sql
```

---

## Risk Assessment

### High Risk
- **Concurrent writes during migration** → Solve: Read-only mode during cutover
- **Data loss** → Solve: Backup JSON files before migration, verify row counts
- **Downtime** → Solve: Migration can be done live, cutover is <1 min

### Medium Risk
- **Query performance** → Solve: Add indexes, use EXPLAIN ANALYZE
- **Connection leaks** → Solve: Proper pool management, timeout handling

### Low Risk
- Breaking existing APIs → Solve: Maintain same API contracts, only change backend

---

## Success Criteria

1. ✅ All 31+ tasks migrated with full history
2. ✅ Agent status updates working in real-time
3. ✅ Dashboard shows correct data (no stale JSON)
4. ✅ No file corruption after 1 week of operation
5. ✅ Subagent completion properly updates DB
6. ✅ Backup/restore procedures tested

---

## Next Steps

### Tasks to Create (Alfred will orchestrate):

**Phase 1 Tasks:**
- [ ] **Task-32**: PostgreSQL installation and schema creation
- [ ] **Task-33**: Migrate Kanban data (tasks, agents, subagents)
- [ ] **Task-34**: Update API endpoints to use PostgreSQL
- [ ] **Task-35**: Update agent hooks to write to PostgreSQL
- [ ] **Task-36**: Test concurrent operations
- [ ] **Task-37**: Remove old JSON files, finalize migration

**Phase 2 Tasks:**
- [ ] **Task-38**: Migrate Calendar data
- [ ] **Task-39**: Update Calendar API endpoints

**Phase 3 Tasks:**
- [ ] **Task-40**: Evaluate Brain/Memory migration (optional)

---

## Recommendation

**Proceed with Phase 1 immediately** after Dad Joke #21 completes. This will:
- Eliminate JSON corruption issues permanently
- Enable true concurrent multi-agent operations
- Provide audit trail via task_history table
- Foundation for future features (analytics, reporting)

**Total Estimated Effort:** 4-6 hours for Phases 1-2  
**ROI:** High - will prevent future data loss and enable scaling

---

*Generated by Alfred, March 5, 2026*
