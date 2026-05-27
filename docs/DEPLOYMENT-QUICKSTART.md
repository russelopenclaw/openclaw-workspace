# Deployment Pipeline Quick Start

## 🚀 60-Second Guide

### Standard Deployment (Recommended)

```bash
# One command does it all
node tools/deployment-pipeline.js --phase full

# Or use the wrapper script
./scripts/deploy.sh
```

This runs:
1. ✅ Pre-deployment checks
2. 📦 Deploys your code
3. 🔍 Post-deployment smoke tests
4. 📊 Generates report

### Quick Reference

| Task | Command |
|------|---------|
| **Check before deploy** | `node tools/deployment-pipeline.js` |
| **Full deployment** | `node tools/deployment-pipeline.js --phase full` |
| **Deploy to prod** | `./scripts/deploy.sh prod` |
| **Post-deploy verify** | `node tools/deployment-pipeline.js --phase post` |
| **Emergency rollback** | `node tools/deployment-pipeline.js --phase rollback` |
| **Generate JSON report** | `node tools/deployment-pipeline.js --report-format json` |

---

## 📋 Common Scenarios

### Scenario 1: Regular Deployment

```bash
# 1. Run pre-deployment checks (optional, auto-run in full)
node tools/deployment-pipeline.js

# 2. Deploy manually
git pull && npm install && node tools/migrations/run-all.js
cd mission-control && npm run build
systemctl --user restart alfred-hub

# 3. Run smoke tests
node tools/deployment-pipeline.js --phase post
```

### Scenario 2: One-Command Deployment

```bash
# Does everything automatically
./scripts/deploy.sh staging
```

### Scenario 3: Production Deployment

```bash
# With JSON report for documentation
./scripts/deploy.sh --phase full -e prod --report-format json --verbose
```

### Scenario 4: Emergency Rollback

```bash
# Immediate rollback to last known good state
node tools/deployment-pipeline.js --phase rollback

# Rollback to specific version
node tools/deployment-pipeline.js --phase rollback --rollback-version v1.2.3
```

### Scenario 5: Test Without Changes

```bash
# Dry run - see what would happen
node tools/deployment-pipeline.js --dry-run

# Or with deploy script
./scripts/deploy.sh -n --verbose
```

---

## 🎯 Exit Codes

```bash
node tools/deployment-pipeline.js
echo $?  # Check exit code

# 0 = Success ✅
# 1 = Failed ❌
# 2 = Pre-deployment failed
# 3 = Post-deployment failed
```

Use in scripts:
```bash
if node tools/deployment-pipeline.js --phase pre; then
  echo "Ready to deploy!"
else
  echo "Fix issues first!"
  exit 1
fi
```

---

## 📊 Output Examples

### Console Output (Default)

```
======================================================================
🚀 AUTOMATED DEPLOYMENT PIPELINE
======================================================================
Phase: pre
Environment: staging
Started: 2026-03-05T19:30:00.000Z
======================================================================

🚀 PRE-DEPLOYMENT CHECKS
==================================================
✅ Gateway: GET /status (45ms)
✅ Database: Connection test (23ms)
✅ Database: Table agents exists
✅ Database: Table tasks exists
✅ Database: Table subagents exists
✅ Database: No orphaned tasks
✅ Ollama: API reachable (12ms)
✅ Mission Control UI: Accessible (89ms)
✅ Systemd: alfred-hub.service active
✅ Systemd: subagent-health-monitor.service active
✅ Disk space: 55% free
✅ Memory usage: 256MB (threshold: 500MB)
✅ Documentation: docs/PRE-DEPLOYMENT-CHECKLIST.md
✅ Documentation: docs/SYSTEM-ARCHITECTURE.md
✅ Git: Working directory clean
✅ Git: On branch main (a1b2c3d)
✅ Backup: Database backup created

======================================================================
📊 DEPLOYMENT PIPELINE REPORT
======================================================================

Status: ✅ SUCCESS
Phase: pre
Environment: staging
Duration: 3s
Timestamp: 2026-03-05T19:30:03.000Z
Git: main (a1b2c3d)

----------------------------------------------------------------------
Total: 18 | Passed: 18 | Failed: 0 | Skipped: 0 | Warnings: 0

----------------------------------------------------------------------
🔄 ROLLBACK AVAILABLE
  Backup: /workspace/backups/db-backup-2026-03-05T19-30-00-000Z.sql
  Version: 2026-03-05T19-30-00-000Z
  To rollback: node tools/deployment-pipeline.js --phase rollback

======================================================================

✅ DEPLOYMENT APPROVED - All critical checks passed
```

### HTML Report

Open in browser with visual indicators, color coding, and summary stats.

### JSON Report

Machine-readable for CI/CD integration and analysis.

---

## 📁 File Locations

| File | Purpose |
|------|---------|
| `tools/deployment-pipeline.js` | Main pipeline script |
| `scripts/deploy.sh` | Wrapper script |
| `docs/DEPLOYMENT-PIPELINE.md` | Full documentation |
| `backups/` | Database backups |
| `.learnings/deployment-reports/` | Generated reports |
| `.github/workflows/deployment-pipeline.yml` | CI/CD workflow |

---

## 🔧 Environment Configuration

Edit `CONFIG.environments` in `tools/deployment-pipeline.js`:

```javascript
environments: {
  dev: { /* ... */ },
  staging: { /* ... */ },
  prod: { /* ... */ }
}
```

---

## 📝 Integration Examples

### GitHub Actions

```yaml
- name: Deploy
  run: node tools/deployment-pipeline.js --phase full
```

### Jenkins

```groovy
stage('Deploy') {
  steps {
    sh 'node tools/deployment-pipeline.js --phase full'
  }
}
```

### Makefile

```makefile
deploy:
	node tools/deployment-pipeline.js --phase full

rollback:
	node tools/deployment-pipeline.js --phase rollback
```

---

## 🐛 Troubleshooting

### Checks Failing

```bash
# Run with verbose output
node tools/deployment-pipeline.js --verbose

# Check specific services
systemctl --user status alfred-hub
pg_isready
curl http://localhost:18789/status
```

### Rollback Needed

```bash
# Quick rollback
./scripts/deploy.sh --phase rollback

# Or manual
node tools/deployment-pipeline.js --phase rollback
```

### Reports

```bash
# List all reports
ls -la .learnings/deployment-reports/

# View latest JSON report
cat .learnings/deployment-reports/deployment-report-*.json | tail -1

# Open latest HTML report
xdg-open .learnings/deployment-reports/deployment-report-*.html
```

---

## 🎯 Best Practices

1. ✅ **Always run pre-deployment checks** - Never skip
2. 📊 **Save reports for documentation** - Use `--report-format json`
3. 🔄 **Test rollback procedure** - Run dry-run periodically
4. 🔍 **Monitor after deployment** - Watch first 10-15 minutes
5. 📝 **Document failures** - Add to `.learnings/ERRORS.md`

---

## 📚 More Info

- **Full Documentation**: [DEPLOYMENT-PIPELINE.md](DEPLOYMENT-PIPELINE.md)
- **Manual Checklist**: [PRE-DEPLOYMENT-CHECKLIST.md](PRE-DEPLOYMENT-CHECKLIST.md)
- **Operational Guide**: [OPERATIONAL-RUNBOOK.md](OPERATIONAL-RUNBOOK.md)

---

**Quick help**: `node tools/deployment-pipeline.js --help`

**Version**: 1.0 | **Last Updated**: 2026-03-05
