# Monitor Agent Skill

## Purpose
Watch Image/Video agents, poll status every 2 minutes, alert Alfred immediately on completion or stall.

## When to Spawn
Spawn Monitor Agent EVERY TIME you spawn an Image or Video agent.

## What It Does

### 1. Track Expected Completion
- Image Agent: 15 minutes expected
- Video Agent: 20 minutes expected

### 2. Poll Every 2 Minutes
```bash
subagents action=list recentMinutes=5
```

### 3. Detect and Alert On:
- **Agent Complete** → Alert: "[AGENT] COMPLETE - [ACTION REQUIRED]"
- **Agent Timeout** → Alert: "[AGENT] TIMED OUT - CHECK STATUS"
- **Stall Detection** (>5 min past expected) → Alert: "[AGENT] STALLED - [X] min overdue"

### 4. Alert Format
Send session message to Alfred:
```
⚠️ MONITOR ALERT: [Image/Video] Agent [complete/timed out/stalled]
TIME: [timestamp]
EXPECTED: [X] minutes
ACTUAL: [Y] minutes
ACTION: [verify quality / check status / rebuild]
```

## Implementation

```python
import time
import json

MONITOR_STATE = {
    "agent_type": None,  # "image" or "video"
    "spawn_time": None,
    "expected_duration": None,  # minutes
    "alerts_sent": [],
    "last_check": None
}

def monitor_loop():
    elapsed = time.time() - MONITOR_STATE["spawn_time"]
    elapsed_min = elapsed / 60
    
    # Check status
    status = check_subagents()
    
    # Detect completion
    if status == "complete" and "complete" not in MONITOR_STATE["alerts_sent"]:
        send_alert("COMPLETE", elapsed_min)
        MONITOR_STATE["alerts_sent"].append("complete")
    
    # Detect stall
    expected = MONITOR_STATE["expected_duration"]
    if elapsed_min > expected + 5 and "stalled" not in MONITOR_STATE["alerts_sent"]:
        send_alert("STALLED", elapsed_min)
        MONITOR_STATE["alerts_sent"].append("stalled")
    
    # Detect timeout
    if status == "timeout" and "timeout" not in MONITOR_STATE["alerts_sent"]:
        send_alert("TIMED OUT", elapsed_min)
        MONITOR_STATE["alerts_sent"].append("timeout")

def send_alert(type, elapsed_min):
    action_map = {
        "image": {"complete": "VERIFY QUALITY → UPSCALE → SPAWN VIDEO", 
                  "stalled": "CHECK IMAGE AGENT STATUS",
                  "timeout": "REGENERATE IMAGES"},
        "video": {"complete": "RUN FINAL VERIFICATION CHECKLIST",
                  "stalled": "CHECK VIDEO BUILD PROGRESS",
                  "timeout": "MANUALLY COMPLETE STEPS 7-8"}
    }
    
    agent = MONITOR_STATE["agent_type"].upper()
    action = action_map[MONITOR_STATE["agent_type"]][type.lower()]
    
    alert = f"""⚠️ MONITOR ALERT: {agent} Agent {type}
TIME: {time.strftime('%H:%M')}
EXPECTED: {MONITOR_STATE['expected_duration']} minutes
ACTUAL: {elapsed_min:.1f} minutes
ACTION: {action}"""
    
    # Send to Alfred via sessions_send or message tool
    send_to_alfred(alert)
```

## Usage

### When Spawning Image Agent:
```bash
# Spawn image agent
sessions_spawn --task "Generate 10 images..." --label image-agent-xyz

# IMMEDIATELY spawn monitor
sessions_spawn --task "Monitor image-agent-xyz, poll every 2 min, expected 15 min" --label monitor-image-xyz
```

### When Spawning Video Agent:
```bash
# Spawn video agent  
sessions_spawn --task "Build 60min video..." --label video-agent-xyz

# IMMEDIATELY spawn monitor
sessions_spawn --task "Monitor video-agent-xyz, poll every 2 min, expected 20 min" --label monitor-video-xyz
```

## State File
Log to: `/home/kevin/.openclaw/workspace/monitor-state.json`

```json
{
  "active_monitor": {
    "agent_label": "image-agent-cabin-mountains-2",
    "spawn_time": "2026-02-28T17:26:00",
    "expected_minutes": 15,
    "status": "complete",
    "complete_time": "2026-02-28T17:36:00",
    "alert_sent": true,
    "alfred_responded": false
  }
}
```

## Success Metrics
- Monitor catches completion within 2 minutes: ✓
- Alfred acts within 60 seconds of alert: ✓
- Zero "And?" pings from Kevin: ✓
