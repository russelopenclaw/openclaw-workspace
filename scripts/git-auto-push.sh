#!/bin/bash
# Auto-commit and push all workspace repos with uncommitted changes
# Run via cron daily at midnight

set -euo pipefail

WORKSPACE="/home/kevin/.openclaw/workspace"
LOG="/tmp/git-auto-push.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$TIMESTAMP] Starting git auto-push..." >> "$LOG"

pushed=0
failed=0
skipped=0

find "$WORKSPACE" -maxdepth 2 -name ".git" -type d 2>/dev/null | while read -r gitdir; do
  repo=$(dirname "$gitdir")
  reponame=$(basename "$repo")
  
  cd "$repo"
  
  # Check if there's a remote
  if ! git remote get-url origin &>/dev/null; then
    echo "[$TIMESTAMP] SKIP $reponame (no remote)" >> "$LOG"
    continue
  fi
  
  # Check for uncommitted changes
  changes=$(git status --short 2>/dev/null | wc -l)
  if [ "$changes" -eq 0 ]; then
    echo "[$TIMESTAMP] SKIP $reponame (clean)" >> "$LOG"
    continue
  fi
  
  echo "[$TIMESTAMP] PUSH $reponame ($changes changes)" >> "$LOG"
  
  # Stage all changes
  if git add -A 2>>"$LOG"; then
    # Commit with timestamp
    if git commit -m "auto: daily backup $TIMESTAMP" --allow-empty-message 2>>"$LOG"; then
      # Push
      if git push origin HEAD 2>>"$LOG"; then
        echo "[$TIMESTAMP] OK $reponame pushed" >> "$LOG"
      else
        echo "[$TIMESTAMP] FAIL $reponame push failed" >> "$LOG"
      fi
    else
      echo "[$TIMESTAMP] FAIL $reponame commit failed" >> "$LOG"
    fi
  else
    echo "[$TIMESTAMP] FAIL $reponame add failed" >> "$LOG"
  fi
done

echo "[$TIMESTAMP] Done." >> "$LOG"
