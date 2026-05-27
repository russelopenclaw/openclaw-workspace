#!/bin/bash
# Restart gnome-system-monitor if it exceeds 2GB RAM

PROC_NAME="gnome-system-monitor"
MAX_MEM_KB=2097152  # 2GB in KB

# Get PID and memory usage
PID=$(pgrep -x "$PROC_NAME")
if [ -z "$PID" ]; then
    # Not running, start it
    gnome-system-monitor &
    exit 0
fi

# Get memory usage in KB
MEM_KB=$(ps -o rss= -p "$PID" 2>/dev/null)

if [ -z "$MEM_KB" ]; then
    exit 0
fi

# Check if over threshold
if [ "$MEM_KB" -gt "$MAX_MEM_KB" ]; then
    MEM_MB=$((MEM_KB / 1024))
    echo "$(date): $PROC_NAME using ${MEM_MB}MB (threshold: 2048MB) - restarting"
    
    # Kill and restart
    kill "$PID"
    sleep 1
    gnome-system-monitor &
fi
