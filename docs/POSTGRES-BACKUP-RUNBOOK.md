# PostgreSQL Auto-Backup Runbook

## Overview

Nightly automated backup of `mission_control` PostgreSQL database to MinIO storage with 30-day retention.

**Location:** `/home/kevin/.openclaw/workspace/tools/postgres-backup.sh`

**Schedule:** Daily at 2:00 AM via cron

**Storage:** MinIO server `hp1`, bucket `mission-control-backups`

---

## Backup Script Details

### Configuration

```bash
# Database
DB_NAME="mission_control"
DB_USER="alfred"
DB_HOST="localhost"
DB_PORT="5432"
DB_PASSWORD="AlfredDB2026Secure"

# Storage
BACKUP_DIR="/home/kevin/.openclaw/workspace/backups/postgres"
MINIO_ALIAS="hp1"
MINIO_BUCKET="mission-control-backups"
MINIO_PATH="backups/"
RETENTION_DAYS=30
```

### What It Does

1. **Creates SQL dump** using `pg_dump` + gzip compression
2. **Uploads to MinIO** at `hp1/mission-control-backups/backups/`
3. **Applies retention policy** (deletes backups >30 days old)
4. **Verifies integrity** by decompressing and reading header
5. **Cleans up local copy** (keeps only in MinIO)

### Manual Execution

```bash
cd /home/kevin/.openclaw/workspace
./tools/postgres-backup.sh
```

### Cron Schedule

```bash
# Edit crontab
crontab -e

# Add nightly backup at 2 AM
0 2 * * * /home/kevin/.openclaw/workspace/tools/postgres-backup.sh >> /home/kevin/.openclaw/workspace/.learnings/backup.log 2>&1
```

---

## Restoration Procedure

### Step 1: List Available Backups

```bash
mc ls hp1/mission-control-backups/backups/
```

Example output:
```
[2026-03-11 14:51:46 CDT]  12KiB STANDARD mission_control_20260311_145145.sql.gz
[2026-03-10 02:00:03 CDT]  12KiB STANDARD mission_control_20260310_020003.sql.gz
```

### Step 2: Download Backup

```bash
mc cp hp1/mission-control-backups/backups/mission_control_20260311_145145.sql.gz /tmp/
```

### Step 3: Restore Database

```bash
# Stop any active connections (optional)
# pkill -f "psql.*mission_control"

# Drop and recreate database (DANGER: destructive!)
PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d postgres -c "DROP DATABASE IF EXISTS mission_control;"
PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d postgres -c "CREATE DATABASE mission_control;"

# Restore from backup
gunzip -c /tmp/mission_control_20260311_145145.sql.gz | PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d mission_control
```

### Step 4: Verify Restoration

```bash
# Check task count
PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d mission_control -c "SELECT COUNT(*) FROM tasks;"

# Check agent status
PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d mission_control -c "SELECT * FROM agents;"
```

---

## Testing & Validation

### Test Backup Creation

```bash
./tools/postgres-backup.sh
# Expected: [INFO] Backup complete: hp1/mission-control-backups/backups/mission_control_YYYYMMDD_HHMMSS.sql.gz
```

### Test MinIO Upload

```bash
mc ls hp1/mission-control-backups/backups/
# Expected: List of .sql.gz files
```

### Test Retention Cleanup

```bash
# Manually test retention (no output expected for new backups)
mc find "hp1/mission-control-backups/backups" --older-than "30d" --name "*.sql.gz"
```

### Test Restoration (Dry Run)

```bash
# Download latest backup
LATEST=$(mc ls hp1/mission-control-backups/backups/ | tail -1 | awk '{print $NF}')
mc cp "hp1/mission-control-backups/backups/$LATEST" /tmp/test-restore.sql.gz

# Verify it's a valid SQL dump
gunzip -c /tmp/test-restore.sql.gz | head -20
# Expected: PostgreSQL database dump header
```

---

## Monitoring & Alerts

### Check Last Backup

```bash
mc ls --latest hp1/mission-control-backups/backups/
```

### Check Backup Size (should be ~10-20KB for current data)

```bash
mc du hp1/mission-control-backups/backups/
```

### Check Backup Logs

```bash
tail -20 /home/kevin/.openclaw/workspace/.learnings/backup.log
```

### Add Health Check (Optional)

Create `/home/kevin/.openclaw/workspace/tools/backup-health-check.js`:

```javascript
const { execSync } = require('child_process');

try {
  // Check latest backup is <24h old
  const latest = execSync('mc ls --json hp1/mission-control-backups/backups/ | jq -r ".[].time" | tail -1').toString().trim();
  const backupTime = new Date(latest);
  const now = new Date();
  const hoursOld = (now - backupTime) / (1000 * 60 * 60);
  
  if (hoursOld > 26) {
    console.error(`ERROR: Last backup is ${hoursOld.toFixed(1)} hours old (should be <24h)`);
    process.exit(1);
  }
  
  console.log('✅ Backup health check passed');
} catch (err) {
  console.error('Backup health check failed:', err.message);
  process.exit(1);
}
```

---

## Troubleshooting

### Backup Script Fails

1. **Check MinIO connection:**
   ```bash
   mc alias list
   mc ls hp1/
   ```

2. **Check PostgreSQL connectivity:**
   ```bash
   PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d mission_control -c "SELECT 1;"
   ```

3. **Check disk space:**
   ```bash
   df -h /home/kevin/.openclaw/workspace
   ```

### MinIO Bucket Missing

```bash
mc mb hp1/mission-control-backups
```

### Cron Job Not Running

```bash
# Verify cron is running
systemctl --user status cron

# Check cron logs
grep CRON /var/log/syslog | tail -10

# Test cron execution manually
bash -x /home/kevin/.openclaw/workspace/tools/postgres-backup.sh
```

### Restoration Fails

1. **Verify backup integrity:**
   ```bash
   gunzip -t backup.sql.gz && echo "Gzip OK"
   ```

2. **Check database user permissions:**
   ```bash
   PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d postgres -c "\du"
   ```

3. **Check disk space on restore:**
   ```bash
   df -h /var/lib/postgresql
   ```

---

## Security Notes

- **Password in script:** Consider moving `DB_PASSWORD` to environment variable or secret manager
- **MinIO credentials:** Stored in `~/.mc/certs/` by `mc alias` command
- **Backup encryption:** Currently uncompressed SQL (consider GPG encryption for sensitive data)
- **Access control:** MinIO bucket should be private (not publicly readable)

---

## Metrics

| Metric | Value |
|--------|-------|
| Backup frequency | Daily (2:00 AM) |
| Retention period | 30 days |
| Typical backup size | ~12-16 KB (compressed) |
| Storage location | MinIO `hp1/mission-control-backups` |
| Restoration time | ~30 seconds |

---

**Created:** 2026-03-11  
**Author:** Alfred  
**Task:** task-72 (PostgreSQL Auto-Backup)
