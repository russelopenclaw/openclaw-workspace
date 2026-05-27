#!/bin/bash
# OpenClaw Log Rotation Script
# - Caps current log at 10MB
# - Compresses previous day's logs
# - Keeps 14 days of history

LOG_DIR="/tmp/openclaw"
MAX_SIZE_MB=10
RETENTION_DAYS=14

# Create log dir if missing
mkdir -p "$LOG_DIR"

# Get today's log file
TODAY=$(date +%Y-%m-%d)
TODAY_LOG="$LOG_DIR/openclaw-$TODAY.log"

# Rotate if today's log exceeds max size
if [ -f "$TODAY_LOG" ]; then
    SIZE_MB=$(du -m "$TODAY_LOG" 2>/dev/null | cut -f1)
    if [ "$SIZE_MB" -gt "$MAX_SIZE_MB" ]; then
        TIMESTAMP=$(date +%Y%m%d-%H%M%S)
        mv "$TODAY_LOG" "$LOG_DIR/openclaw-$TODAY-$TIMESTAMP.log"
        gzip "$LOG_DIR/openclaw-$TODAY-$TIMESTAMP.log"
        echo "[$(date)] Rotated $TODAY_LOG (was ${SIZE_MB}MB)"
    fi
fi

# Compress yesterday's log if not already compressed
YESTERDAY=$(date -d "yesterday" +%Y-%m-%d)
YESTERDAY_LOG="$LOG_DIR/openclaw-$YESTERDAY.log"
if [ -f "$YESTERDAY_LOG" ]; then
    gzip "$YESTERDAY_LOG"
    echo "[$(date)] Compressed $YESTERDAY_LOG"
fi

# Clean up old logs (older than retention period)
find "$LOG_DIR" -name "openclaw-*.log*" -type f -mtime +$RETENTION_DAYS -delete
echo "[$(date)] Cleaned logs older than $RETENTION_DAYS days"
