# Pre-Deployment Testing Checklist

**Purpose**: Catch deployment bugs before they reach production. Test API endpoints, component imports, and response structures.

**When to Use**: Before every deployment to production or staging environments.

---

## 📋 Checklist Categories

- [ ] **API Health** - Backend endpoints responding correctly
- [ ] **Database** - Migrations, connections, data integrity
- [ ] **Frontend** - Component imports, build success, UI rendering
- [ ] **Integration** - End-to-end flows work
- [ ] **Security** - Auth, permissions, secrets
- [ ] **Performance** - Response times, resource usage
- [ ] **Monitoring** - Logs, alerts, health checks

---

## ✅ API Health Tests

### Gateway API
- [ ] `GET /status` returns 200 with valid JSON
- [ ] `GET /health` returns 200
- [ ] `POST /sessions` creates session successfully
- [ ] `GET /sessions` lists sessions
- [ ] Authenticated endpoints require valid token
- [ ] Rate limiting works (test with rapid requests)

### Mission Control (PostgreSQL)
- [ ] Database connection succeeds
- [ ] Query `SELECT 1` works
- [ ] All tables exist: `agents`, `tasks`, `subagents`, `cron_jobs`
- [ ] Foreign key constraints intact
- [ ] Indexes present on frequently-queried columns

### Ollama Integration
- [ ] `GET /api/tags` returns available models
- [ ] Model inference works (test with simple prompt)
- [ ] Embedding model responds (`nomic-embed-text:latest`)

### External Services
- [ ] Telegram bot responds (send test message)
- [ ] Here.now upload works (test image upload)
- [ ] Weather API responds (wttr.in or Open-Meteo)

---

## ✅ Database Tests

### Schema Validation
```sql
-- Run these queries and verify results
SELECT COUNT(*) FROM agents; -- Should return >= 1
SELECT COUNT(*) FROM tasks; -- Should return > 0
SELECT COUNT(*) FROM subagents; -- Should return >= 0
SELECT id, name, status FROM agents WHERE name = 'alfred'; -- Should return alfred
```

### Migration Status
- [ ] All migrations in `/workspace/tools/migrations/` have been applied
- [ ] `schema_migrations` table shows latest version
- [ ] No pending migrations

### Data Integrity
- [ ] No orphaned records (tasks without agents, subagents without tasks)
- [ ] Timestamps are valid (no future dates except scheduled tasks)
- [ ] Enum values are valid (`column_name` in allowed set)

---

## ✅ Frontend Tests

### Build Process
- [ ] `npm run build` completes without errors
- [ ] No TypeScript/ESLint errors
- [ ] Bundle size within limits (<10MB for main bundle)

### Component Imports
```javascript
// Test critical imports in browser console
import('@mission-control/components/AgentsList.js');
import('@mission-control/components/TaskBoard.js');
import('@mission-control/components/CronManager.js');
```

### UI Rendering
- [ ] Dashboard loads (http://192.168.1.56:8765/)
- [ ] Agent status shows correct data
- [ ] Task board displays all columns
- [ ] Cron jobs list renders
- [ ] No console errors in browser dev tools

### Responsive Design
- [ ] Desktop layout works (1920x1080)
- [ ] Tablet layout works (768x1024)
- [ ] Mobile layout works (375x667)

---

## ✅ Integration Tests

### End-to-End Flows

#### Flow 1: Task Creation → Assignment → Completion
1. Create task via API or UI
2. Assign to agent
3. Agent picks up task (autonomous pull or manual)
4. Task moves to "in-progress"
5. Agent completes task
6. Task moves to "done" automatically
7. Alfred status set to "idle"

#### Flow 2: Subagent Spawn → Execution → Completion
1. Spawn subagent with task ID
2. Subagent reports progress
3. Subagent completes
4. `onSubagentComplete` hook fires
5. Database updated atomically
6. No manual intervention required

#### Flow 3: Heartbeat → Briefing → Delivery
1. Heartbeat triggers
2. Briefing generated (weather, calendar, tasks, suggestions)
3. Message delivered via Telegram
4. No duplicate messages

#### Flow 4: Calendar Reminder
1. Reminder created with future date
2. Heartbeat checks reminder due
3. Alert sent at correct time
4. Reminder marked completed or updated

---

## ✅ Security Tests

### Authentication
- [ ] Gateway token required for authenticated endpoints
- [ ] Invalid tokens rejected with 401
- [ ] Token rotation works
- [ ] Password auth works (if enabled)

### Authorization
- [ ] Agents can only access assigned tasks
- [ ] Subagents can't escalate privileges
- [ ] Device pairing requires approval
- [ ] Exec approvals work (allowlist/deny)

### Secrets Management
- [ ] `.env` files not committed to git
- [ ] API keys stored in secure location
- [ ] Secrets not logged or printed
- [ ] `trash` > `rm` for sensitive file deletion

### Input Validation
- [ ] SQL injection prevented (parameterized queries)
- [ ] XSS prevented (sanitize user input)
- [ ] Path traversal prevented (validate file paths)
- [ ] Command injection prevented (shell escaping)

---

## ✅ Performance Tests

### Response Times (p95 targets)
- [ ] Gateway API: <100ms
- [ ] Database queries: <50ms
- [ ] Ollama inference: <5s (depends on model)
- [ ] Dashboard load: <2s
- [ ] Subagent spawn: <1s

### Resource Usage
- [ ] Gateway memory <500MB
- [ ] Ollama memory <8GB (or model-dependent)
- [ ] Database connections <10 (pool size)
- [ ] Disk I/O within normal range
- [ ] CPU usage <80% under load

### Load Testing
- [ ] 10 concurrent sessions work
- [ ] 100 messages/minute handled
- [ ] No memory leaks after 100 subagent spawns
- [ ] Rate limiting kicks in at threshold

---

## ✅ Monitoring & Observability

### Logs
- [ ] Gateway logs writing to journal
- [ ] Application logs capture errors
- [ ] Log rotation configured
- [ ] Log levels appropriate (INFO, WARN, ERROR)

### Health Checks
- [ ] `openclaw status` returns healthy
- [ ] `system-health-check.js` passes all checks
- [ ] Systemd services show "active (running)"
- [ ] Heartbeat monitoring active

### Alerts
- [ ] Error rate alerts configured
- [ ] Gateway down alerts work
- [ ] Disk space alerts configured (>90% triggers)
- [ ] Repeated failure alerts for cron jobs

### Metrics
- [ ] Session count tracked
- [ ] Token usage recorded
- [ ] Task completion rate measurable
- [ ] Subagent success rate tracked

---

## 🚀 Deployment Steps

### Pre-Deployment
1. [ ] Run full checklist above
2. [ ] Document any known issues or workarounds
3. [ ] Create backup of database: `pg_dump mission_control > backup.sql`
4. [ ] Tag git commit: `git tag v1.x.x && git push --tags`
5. [ ] Notify stakeholders if major changes

### Deployment
1. [ ] Stop services: `systemctl --user stop alfred-hub`
2. [ ] Pull latest code: `git pull`
3. [ ] Install dependencies: `npm install`
4. [ ] Run migrations: `node tools/migrations/run-all.js`
5. [ ] Rebuild frontend: `cd mission-control && npm run build`
6. [ ] Restart services: `systemctl --user start alfred-hub`

### Post-Deployment Verification
1. [ ] Dashboard loads successfully
2. [ ] All services running: `systemctl --user status alfred-hub`
3. [ ] Gateway responds: `curl http://localhost:18789/status`
4. [ ] Database accessible: `pg_isready`
5. [ ] Smoke test critical flows (task creation, subagent spawn)
6. [ ] Monitor logs for first 10 minutes: `journalctl --user -f`

### Rollback Plan
If deployment fails:
1. [ ] Stop services: `systemctl --user stop alfred-hub`
2. [ ] Restore previous code: `git checkout <previous-tag>`
3. [ ] Restore database: `psql mission_control < backup.sql`
4. [ ] Restart services: `systemctl --user start alfred-hub`
5. [ ] Verify rollback successful
6. [ ] Document failure in ERRORS.md

---

## 📊 Test Results Template

Use this template when documenting test results:

```markdown
## Pre-Deployment Test Results - YYYY-MM-DD

**Tester**: [Name]  
**Environment**: [Production/Staging/Dev]  
**Version**: [Git commit or tag]  
**Result**: ✅ PASS / ❌ FAIL / ⚠️ PASS WITH ISSUES

### Summary
- Total checks: XX
- Passed: XX
- Failed: XX
- Skipped: XX

### Failed Tests
| Test | Expected | Actual | Priority |
|------|----------|--------|----------|
| API: GET /status | 200 OK | 500 Error | High |

### Known Issues
- Issue 1: Description, workaround
- Issue 2: Description, workaround

### Sign-Off
- [ ] Developer sign-off: __________
- [ ] QA sign-off: __________
- [ ] Ops sign-off: __________
```

---

## 🔄 Continuous Improvement

After each deployment:
1. [ ] Add any missed test cases to this checklist
2. [ ] Document new failure modes in ERRORS.md
3. [ ] Update performance baselines if thresholds change
4. [ ] Review and remove obsolete tests

---

## 📚 Related Documentation

- `/workspace/docs/OPERATIONAL-RUNBOOK.md` - Day-to-day operations
- `/workspace/docs/SYSTEM-ARCHITECTURE.md` - System overview
- `/workspace/.learnings/ERRORS.md` - Known errors and resolutions
- `/workspace/.learnings/LEARNINGS.md` - Process improvements
- `https://docs.openclaw.ai` - OpenClaw documentation

---

**Last Updated**: 2026-03-05  
**Maintained By**: Alfred (automated)  
**Review Frequency**: Monthly or after major deployments
