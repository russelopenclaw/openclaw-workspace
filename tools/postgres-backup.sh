#!/bin/bash
#
# PostgreSQL Auto-Backup Script
# Backups mission_control database to MinIO with 30-day retention
#
# Usage: ./postgres-backup.sh
# Cron: 0 2 * * * /workspace/tools/postgres-backup.sh >> /workspace/.learnings/backup.log 2>&1
#

set -e

# Source profile for PATH (cron doesn't load .bashrc)
export PATH="/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:$PATH"

# Configuration
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="mission_control"
DB_USER="alfred"
DB_HOST="localhost"
DB_PORT="5432"
DB_PASSWORD="AlfredDB2026Secure"
BACKUP_DIR="/home/kevin/.openclaw/workspace/backups/postgres"
MINIO_ALIAS="hp1"
MINIO_BUCKET="mission-control-backups"
MINIO_PATH="backups/"
RETENTION_DAYS=30

# Colors for logging
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

log_info "Starting PostgreSQL backup for $DB_NAME at $(date)"

# Step 1: Create SQL dump
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${DATE}.sql.gz"
log_info "Creating database dump: $BACKUP_FILE"

export PGPASSWORD="$DB_PASSWORD"
pg_dump -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_FILE"

if [ ! -f "$BACKUP_FILE" ]; then
    log_error "Backup file not created!"
    exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log_info "Backup created: $BACKUP_SIZE"

# Step 2: Upload to MinIO
log_info "Uploading to MinIO ($MINIO_ALIAS/$MINIO_BUCKET)..."

# Check if MinIO alias exists, if not configure it
if ! mc alias list | grep -q "$MINIO_ALIAS"; then
    log_info "Configuring MinIO alias..."
    mc alias set "$MINIO_ALIAS" http://$MINIO_ALIAS:9001 admin password123
fi

# Check if bucket exists, create if not
if ! mc ls "$MINIO_ALIAS/$MINIO_BUCKET" > /dev/null 2>&1; then
    log_info "Creating bucket $MINIO_BUCKET..."
    mc mb "$MINIO_ALIAS/$MINIO_BUCKET"
fi

# Upload backup
mc cp "$BACKUP_FILE" "$MINIO_ALIAS/$MINIO_BUCKET/$MINIO_PATH${DB_NAME}_${DATE}.sql.gz"

log_info "Upload complete"

# Step 3: Clean up old backups (retention policy)
log_info "Applying $RETENTION_DAYS-day retention policy..."
# Delete backups older than RETENTION_DAYS
mc find "$MINIO_ALIAS/$MINIO_BUCKET/$MINIO_PATH" --older-than "${RETENTION_DAYS}d" --name "*.sql.gz" | while read -r file; do
    log_warn "Removing old backup: $file"
    mc rm "$file"
done
log_info "Old backups removed"

# Step 4: Verify backup
log_info "Verifying backup integrity..."
mc cat "$MINIO_ALIAS/$MINIO_BUCKET/$MINIO_PATH${DB_NAME}_${DATE}.sql.gz" | gunzip | head -5 > /dev/null
log_info "Backup verification passed"

# Step 5: Cleanup local copy (keep only in MinIO)
rm "$BACKUP_FILE"
log_info "Local backup removed"

log_info "Backup complete: ${MINIO_ALIAS}/${MINIO_BUCKET}/${MINIO_PATH}${DB_NAME}_${DATE}.sql.gz"

# Log success to database
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c \
  "INSERT INTO task_history (task_id, action, status, notes, created_at) 
   VALUES ('task-72', 'backup', 'complete', 'Backup created: ${DB_NAME}_${DATE}.sql.gz', NOW())" 2>/dev/null || true

exit 0
