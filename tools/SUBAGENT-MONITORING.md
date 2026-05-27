# Subagent Health Monitoring

Automated monitoring system for detecting and responding to subagent failures.

## Features

- **Polling**: Checks active subagents every 5 minutes
- **Registry**: Tracks expected vs actual subagents in `.learnings/SUBAGENT-REGISTRY.json`
- **Stale Detection**: Alerts when subagents haven't updated in 15+ minutes
- **Auto-Respawn**: Attempts to respawn subagents that crash mid-task
- **Audit Trail**: All activity logged to `.learnings/SUBAGENT-HEALTH.log`

## Quick Start

### Start the Monitor

```bash
node tools/start-health-monitor.js
```

This runs the monitor as a detached background process.

### Check Status

```bash
# View logs
tail -f .learnings/SUBAGENT-HEALTH.log

# View registry
cat .learnings/SUBAGENT-REGISTRY.json

# Check if running
cat .learnings/health-monitor.pid
```

### Stop the Monitor

```bash
node tools/stop-health-monitor.js
```

## How It Works

### Monitoring Cycle (Every 5 Minutes)

1. **Fetch Active Subagents**: Queries `openclaw sessions --active 120 --json`
2. **Compare to Registry**: Checks expected vs actual subagents
3. **Update Last Seen**: Records when each subagent was last active
4. **Detect Stale**: Alerts if subagent hasn't updated in 15+ minutes
5. **Detect Disappeared**: Triggers respawn if subagent vanishes mid-task
6. **Auto-Respawn**: Attempts to respawn crashed subagents

### Subagent Lifecycle

```
Spawned → Registered in SUBAGENT-REGISTRY.json
    ↓
Active → Last updated timestamp refreshed every check
    ↓
Completed OR Crashed
    ├─→ Completed gracefully → Removed from registry
    └─→ Crashed mid-task → Auto-respawn triggered
```

### Alert Levels

| Level | Condition | Action |
|-------|-----------|--------|
| INFO | Normal operation | Log only |
| WARN | Stale subagent (>15 min no update) | Alert logged |
| ERROR | Subagent disappeared mid-task | Alert + auto-respawn attempt |

## Auto-Respawn Behavior

When a subagent crashes mid-task (disappears before completing):

1. **Immediate Attempt**: Tries `openclaw subagents spawn` command
2. **Fallback Queue**: If command fails, writes to `.learnings/SUBAGENT-RESPAWN-QUEUE.json`
3. **Main Agent Processing**: Main agent should check this queue on startup/heartbeats

### Processing the Respawn Queue

Add this to your main agent startup or heartbeat handler:

```javascript
// Check respawn queue
const queueFile = path.join(__dirname, '.learnings/SUBAGENT-RESPAWN-QUEUE.json');
if (fs.existsSync(queueFile)) {
  const queue = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
  for (const item of queue) {
    // Spawn the subagent
    await subagents({ action: 'spawn', ... });
  }
  // Clear queue after processing
  fs.unlinkSync(queueFile);
}
```

## Test Mode

Test the monitoring system with a fake subagent:

```bash
# Normal test (runs 5 minutes)
node tools/test-subagent.js --duration=300

# Crash test (crashes after 30 seconds)
node tools/test-subagent.js --crash
```

## Configuration

Edit `tools/subagent-health-monitor.js`:

```javascript
const MONITOR_INTERVAL_MS = 5 * 60 * 1000;  // How often to poll
const STALE_THRESHOLD_MIN = 15;             // Alert if no update in N minutes
```

## Files Created

| File | Purpose |
|------|---------|
| `.learnings/SUBAGENT-HEALTH.log` | Audit trail of all monitoring activity |
| `.learnings/SUBAGENT-REGISTRY.json` | Map of expected subagents |
| `.learnings/SUBAGENT-RESPAWN-QUEUE.json` | Pending respawn requests |
| `.learnings/health-monitor.pid` | PID of running monitor process |
| `.learnings/health-monitor-daemon.log` | Daemon startup logs |

## Integration with Main Agent

The main agent should:

1. **On Startup**: Check respawn queue and process pending requests
2. **During Heartbeats**: Optionally check subagent health status
3. **When Spawning Subagents**: Optionally register them in the monitoring system

Example registration:

```javascript
const monitor = require('./tools/subagent-health-monitor.js');

// After spawning a subagent
const spawnResult = await subagents({ action: 'spawn', task: '...' });
monitor.registerSubagent(spawnResult.childSessionKey, task, label);
```

## Troubleshooting

### Monitor won't start

```bash
# Check for stale PID file
rm .learnings/health-monitor.pid

# Try starting manually to see errors
node tools/subagent-health-monitor.js
```

### False alerts

- Subagents that complete quickly (<2 min) may not be tracked long enough
- Adjust `STALE_THRESHOLD_MIN` if your subagents legitimately take longer

### Respawn not working

- Verify `openclaw subagents spawn` works from command line
- Check permissions on the main agent session
- Review respawn queue: `cat .learnings/SUBAGENT-RESPAWN-QUEUE.json`

## Cron Integration (Optional)

Instead of running as a daemon, you can run via cron:

```cron
# Run health check every 5 minutes
*/5 * * * * node /home/kevin/.openclaw/workspace/tools/subagent-health-monitor.js
```

Note: This mode doesn't track subagents across runs (no persistent timer), but the registry file persists.
