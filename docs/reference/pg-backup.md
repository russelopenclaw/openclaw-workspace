## PostgreSQL Auto-Backup (Production ✅ 2026-03-13)

**Status:** Complete - nightly cron running at 2 AM
**Script:** `tools/postgres-backup.sh`
**Schedule:** `0 2 * * *` (2 AM daily)
**Retention:** 30 days

**Fix applied:** Added explicit PATH export for Linuxbrew's `mc` command (cron doesn't source .bashrc):
```bash
export PATH="/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:$PATH"
```

**Location:** `hp1/mission-control-backups/backups/`
**Verification:** Backup integrity checked after upload (gunzip test)

**Recent Verifications:**
- 2026-04-05: ✅ 28K backup uploaded
- 2026-04-06: ✅ 28K backup uploaded
- 2026-04-07: ✅ 28K backup uploaded
- **Note:** Last verified Apr 7 (3 days unverified due to exec block)

---
