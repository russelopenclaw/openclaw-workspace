# Automated Deployment Pipeline

**Purpose**: CI/CD-style automated deployment testing with pre-deployment validation, post-deployment smoke tests, rollback automation, and comprehensive reporting.

**When to Use**: Before and after every deployment to staging or production environments.

---

## 📋 Overview

This pipeline automates the manual Pre-Deployment Checklist (`PRE-DEPLOYMENT-CHECKLIST.md`) and extends it with:

- **Pre-deployment checks** - Validates system health before deployment
- **Post-deployment smoke tests** - Verifies deployment succeeded
- **Rollback automation** - One-command rollback if deployment fails
- **Deployment reports** - JSON/HTML reports with pass/fail status
- **Integration workflow** - Fits into your deployment process

---

## 🚀 Quick Start

### Basic Usage

```bash
# Run pre-deployment checks (default)
node tools/deployment-pipeline.js

# Run full pipeline (pre + post)
node tools/deployment-pipeline.js --phase full

# Run post-deployment smoke tests
node tools/deployment-pipeline.js --phase post

# Rollback to previous version
node tools/deployment-pipeline.js --phase rollback
```

### Command Options

```bash
node tools/deployment-pipeline.js [options]

Options:
  --phase [pre|post|rollback|full]  Which phase to run (default: pre)
  --environment, -e [dev|staging|prod] Target environment (default: staging)
  --report-format [console|json|html] Output format (default: console)
  --report-path [path]               Custom path for report
  --rollback-version [version]       Git tag/version to rollback to
  --dry-run                          Run without making changes
  --verbose, -v                      Show detailed output
  --help, -h                         Show help
```

---

## 📊 Pipeline Phases

### Phase 1: Pre-Deployment Checks

Runs before deployment to ensure system is ready:

#### API Health
- ✅ Gateway status endpoint (`/status`, `/health`)
- ✅ Response time thresholds (<100ms)
- ✅ Mission Control UI accessibility

#### Database
- ✅ Connection test
- ✅ All required tables exist (`agents`, `tasks`, `subagents`, `cron_jobs`)
- ✅ Data integrity (no orphaned records, valid statuses)
- ✅ No suspicious future timestamps

#### Infrastructure
- ✅ Ollama API reachable
- ✅ Systemd services running (`alfred-hub`, `subagent-health-monitor`)
- ✅ Disk space available (>10% free)
- ✅ Memory usage within limits (<500MB for Node processes)

#### Documentation & Versioning
- ✅ Required docs exist
- ✅ Git working directory clean (with warning if not)
- ✅ Current branch and commit logged

#### Backup
- ✅ Creates database backup automatically
- ✅ Backup stored in `/workspace/backups/`
- ✅ Backup path recorded for rollback

**Exit Codes:**
- `0` - All checks passed (deployment approved)
- `0` - Warnings present (deployment possible with review)
- `1` - Critical failures (deployment NOT recommended)

---

### Phase 2: Post-Deployment Smoke Tests

Runs after deployment to verify success:

#### Gateway Health
- ✅ Multiple endpoints respond (`/status`, `/health`)
- ✅ No errors in responses

#### Database
- ✅ Read/write test (create test record, verify, cleanup)
- ✅ Schema intact after migrations

#### Task Flow
- ✅ Create test task
- ✅ Assign to agent
- ✅ Mark in-progress
- ✅ Mark completed
- ✅ Verify completion timestamp
- ✅ Cleanup test data

#### Subagent Infrastructure
- ✅ Subagent schema complete
- ✅ Database ready for subagent spawns

#### Monitoring
- ✅ Health monitor service running
- ✅ Log files being written

#### Version Check
- ✅ Version reported by gateway
- ✅ Matches expected deployment version

**Exit Codes:**
- `0` - All smoke tests passed (deployment verified)
- `1` - Smoke tests failed (consider rollback)

---

### Phase 3: Rollback Automation

Automated rollback if deployment fails:

#### Rollback Steps
1. **Stop services** - `systemctl --user stop alfred-hub`
2. **Restore database** - Restore from most recent backup
3. **Restore code** - `git checkout <version>` (if version specified)
4. **Restart services** - `systemctl --user start alfred-hub`
5. **Verify rollback** - Run smoke tests to confirm success

#### Usage

```bash
# Rollback to most recent backup
node tools/deployment-pipeline.js --phase rollback

# Rollback to specific version
node tools/deployment-pipeline.js --phase rollback --rollback-version v1.2.3

# Dry run (see what would happen)
node tools/deployment-pipeline.js --phase rollback --dry-run
```

**Safety Features:**
- Backup created BEFORE rollback starts
- Verification step confirms rollback succeeded
- Dry-run mode to test rollback procedure
- Detailed logging of each step

---

## 📁 Report Generation

### Console Report (Default)

```
======================================================================
📊 DEPLOYMENT PIPELINE REPORT
======================================================================

Status: ✅ SUCCESS
Phase: pre
Environment: staging
Duration: 12s
Timestamp: 2026-03-05T19:30:00.000Z
Git: main (a1b2c3d)

----------------------------------------------------------------------
Total: 45 | Passed: 43 | Failed: 0 | Skipped: 2 | Warnings: 3

----------------------------------------------------------------------
🔄 ROLLBACK AVAILABLE
  Backup: /workspace/backups/db-backup-2026-03-05T19-30-00-000Z.sql
  Version: 2026-03-05T19-30-00-000Z
  To rollback: node tools/deployment-pipeline.js --phase rollback

======================================================================

✅ DEPLOYMENT APPROVED - All critical checks passed
```

### JSON Report

```bash
node tools/deployment-pipeline.js --report-format json
```

Saved to: `.learnings/deployment-reports/deployment-report-YYYY-MM-DD.json`

**Structure:**
```json
{
  "summary": {
    "timestamp": "2026-03-05T19:30:00.000Z",
    "phase": "pre",
    "environment": "staging",
    "duration": 12,
    "passed": 43,
    "failed": 0,
    "skipped": 2,
    "success": true
  },
  "metrics": {
    "diskUsage": 45,
    "memoryUsage": 256,
    "gitBranch": "main",
    "gitCommit": "a1b2c3d"
  },
  "results": [...],
  "rollback": {
    "available": true,
    "version": "2026-03-05T19-30-00-000Z",
    "backupPath": "/workspace/backups/db-backup-..."
  }
}
```

### HTML Report

```bash
node tools/deployment-pipeline.js --report-format html
```

Opens in browser with:
- Visual status indicators
- Color-coded results
- Summary statistics
- Detailed test table
- Rollback instructions

---

## 🔄 Deployment Workflow Integration

### Manual Deployment

```bash
# 1. Run pre-deployment checks
node tools/deployment-pipeline.js --phase pre

# [If successful] Deploy manually
git pull
npm install
node tools/migrations/run-all.js
cd mission-control && npm run build
systemctl --user restart alfred-hub

# 2. Run post-deployment smoke tests
node tools/deployment-pipeline.js --phase post

# [If smoke tests pass] Deployment complete ✅
# [If smoke tests fail] Rollback:
node tools/deployment-pipeline.js --phase rollback
```

### CI/CD Integration

Add to your CI/CD pipeline:

```yaml
# Example GitHub Actions
- name: Pre-deployment checks
  run: node tools/deployment-pipeline.js --phase pre --environment staging

- name: Deploy
  run: |
    git pull
    npm install
    node tools/migrations/run-all.js
    systemctl --user restart alfred-hub

- name: Post-deployment smoke tests
  run: node tools/deployment-pipeline.js --phase post --environment staging

- name: Rollback on failure
  if: failure()
  run: node tools/deployment-pipeline.js --phase rollback
```

### Automated Deployment Script

Create `scripts/deploy.sh`:

```bash
#!/bin/bash

set -e

ENV=${1:-staging}
echo "🚀 Deploying to $ENV environment"

# Pre-deployment checks
echo "Running pre-deployment checks..."
node tools/deployment-pipeline.js --phase pre --environment $ENV

if [ $? -ne 0 ]; then
  echo "❌ Pre-deployment checks failed"
  exit 1
fi

# Deploy
echo "📦 Deploying..."
git pull
npm install
node tools/migrations/run-all.js
cd mission-control && npm run build
systemctl --user restart alfred-hub

# Wait for services
sleep 5

# Post-deployment smoke tests
echo "🔍 Running smoke tests..."
node tools/deployment-pipeline.js --phase post --environment $ENV

if [ $? -ne 0 ]; then
  echo "❌ Smoke tests failed - initiating rollback"
  node tools/deployment-pipeline.js --phase rollback --environment $ENV
  exit 1
fi

echo "✅ Deployment successful!"
```

---

## ⚙️ Configuration

### Environment Configuration

Edit `CONFIG.environments` in `deployment-pipeline.js`:

```javascript
environments: {
  dev: {
    host: 'localhost',
    gatewayPort: 18789,
    missionControlPort: 8765,
    ollamaHost: '192.168.1.33',
    ollamaPort: 11434,
    db: {
      host: 'localhost',
      port: 5432,
      database: 'mission_control',
      user: 'alfred',
      password: 'AlfredDB2026Secure'
    }
  },
  // Add more environments...
}
```

### Threshold Configuration

Adjust performance thresholds in `CONFIG.thresholds`:

```javascript
thresholds: {
  gatewayResponseTime: 100,    // ms
  dbQueryTime: 50,            // ms
  dashboardLoadTime: 2000,    // ms
  memoryUsage: 500,           // MB
  diskUsagePercent: 90        // % usage threshold
}
```

### Backup Configuration

```javascript
backupDir: '/home/kevin/.openclaw/workspace/backups',
reportDir: '/home/kevin/.openclaw/workspace/.learnings/deployment-reports'
```

---

## 🛡️ Safety Features

### Automatic Backups
- Database backup created before every pre-deployment check
- Backup stored with timestamp in filename
- Backup path recorded in state for rollback

### Dry-Run Mode
- Test pipeline without making changes
- Useful for testing rollback procedure
- Shows what would happen without side effects

```bash
node tools/deployment-pipeline.js --phase rollback --dry-run
```

### Error Handling
- Comprehensive error catching and reporting
- Critical failures clearly marked
- Graceful degradation (skip non-critical checks)

### Rollback Verification
- After rollback, smoke tests run automatically
- Confirms rollback succeeded
- Logs detailed status

---

## 📊 Exit Codes

| Code | Meaning | Action |
|------|---------|--------|
| 0 | Success | All checks passed, deployment safe |
| 0 | Warnings | Non-critical issues, review before deploying |
| 1 | Critical failure | Fix issues before deploying |
| 1 | Rollback failed | Manual intervention required |

---

## 📈 Metrics Tracked

### System Metrics
- Gateway response time
- Database query time
- Memory usage
- Disk usage percentage
- Service status

### Git Metrics
- Current branch
- Commit hash
- Working directory status (clean/dirty)

### Test Metrics
- Total tests run
- Pass/fail/skip counts
- Warnings count
- Test duration

---

## 🐛 Troubleshooting

### Pre-Deployment Checks Fail

**Gateway not responding:**
```bash
systemctl --user status alfred-hub
journalctl --user -u alfred-hub -n 50
```

**Database connection failed:**
```bash
pg_isready
systemctl status postgresql
```

**Ollama API unreachable:**
```bash
curl http://192.168.1.33:11434/api/tags
```

### Post-Deployment Smoke Tests Fail

**Immediate rollback:**
```bash
node tools/deployment-pipeline.js --phase rollback
```

**Manual investigation:**
```bash
# Check recent logs
journalctl --user -u alfred-hub -f

# Check database migrations
node tools/migrations/check-status.js

# Verify code version
git log -1
```

### Rollback Fails

**Manual rollback steps:**
```bash
# 1. Stop services
systemctl --user stop alfred-hub

# 2. Restore database manually
PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred mission_control < /workspace/backups/db-backup-<timestamp>.sql

# 3. Restore code
git checkout <previous-tag>

# 4. Restart services
systemctl --user start alfred-hub

# 5. Verify
curl http://localhost:18789/status
```

---

## 📚 Related Documentation

- `PRE-DEPLOYMENT-CHECKLIST.md` - Manual checklist (source for pre-deployment checks)
- `OPERATIONAL-RUNBOOK.md` - Day-to-day operations
- `SYSTEM-ARCHITECTURE.md` - System overview
- `.learnings/deployment-reports/` - Generated deployment reports
- `.learnings/ERRORS.md` - Known errors and resolutions

---

## 🔧 Programmatic Usage

Use pipeline functions in other scripts:

```javascript
const pipeline = require('./tools/deployment-pipeline.js');

// Run pre-deployment checks
await pipeline.runPreDeploymentPhase();

// Run post-deployment smoke tests
await pipeline.runPostDeploymentPhase();

// Generate report
pipeline.generateReport('json');

// Execute rollback
await pipeline.executeRollback('v1.2.3');
```

---

## 📝 Examples

### Example 1: Standard Deployment

```bash
# Pre-deployment validation
node tools/deployment-pipeline.js

# Output shows all checks passed ✅
# Deploy manually or via script

# Post-deployment verification
node tools/deployment-pipeline.js --phase post
```

### Example 2: Production Deployment

```bash
# Pre-deployment for production
node tools/deployment-pipeline.js --phase pre --environment prod --report-format json

# Deploy...

# Post-deployment smoke tests for production
node tools/deployment-pipeline.js --phase post --environment prod --report-format html
```

### Example 3: Emergency Rollback

```bash
# Immediate rollback to last known good state
node tools/deployment-pipeline.js --phase rollback --verbose

# Or rollback to specific version
node tools/deployment-pipeline.js --phase rollback --rollback-version v1.5.2
```

### Example 4: Test Rollback Procedure

```bash
# Test rollback without actually rolling back
node tools/deployment-pipeline.js --phase rollback --dry-run --verbose
```

---

## 🎯 Best Practices

1. **Always run pre-deployment checks** - Never skip this step
2. **Keep git clean before deployment** - Commit or stash changes
3. **Review warnings** - Even if checks pass
4. **Save reports** - Use JSON/HTML format for documentation
5. **Test rollback procedure** - Run dry-run periodically
6. **Monitor after deployment** - Watch first 10-15 minutes closely
7. **Document failures** - Add to `.learnings/ERRORS.md`

---

## 🔄 Continuous Improvement

After each deployment:

1. Review pipeline output
2. Add any missed test cases
3. Adjust thresholds if needed
4. Update troubleshooting section
5. Document new failure modes

---

**Last Updated**: 2026-03-05  
**Maintained By**: Alfred (automated)  
**Review Frequency**: Monthly or after major deployments  
**Version**: 1.0
