# OOM Kill Prevention Plan

## Incident Summary
**Date**: 2026-03-07  
**Duration**: ~10 hours (12:15 PM - 10:24 PM CDT)  
**Root Cause**: Linux OOM (Out of Memory) killer terminated `openclaw-gateway.service`  
**Evidence**: `journalctl` shows `Failed with result 'oom-kill'`

## Contributing Factors
1. **No memory limits** on systemd service - process could consume unlimited memory
2. **Memory leaks** in native modules (node_sqlite3.node binding errors in logs)
3. **No memory monitoring** - no alerts before OOM condition
4. **mem0 SQLite issues** - repeated "Could not locate the bindings file" errors suggest native module instability

---

## Prevention Measures (Priority Order)

### 🔴 Critical (Implement Immediately)

#### 1. Add Memory Limits to systemd Service
```ini
[Service]
MemoryLimit=1G
MemoryHigh=800M
OOMScoreAdjust=100
```

**Why**: Prevents runaway memory consumption from affecting system stability.

**Implementation**:
```bash
systemctl --user edit openclaw-gateway.service
```

Add:
```ini
[Service]
MemoryLimit=1G
MemoryHigh=800M
OOMScoreAdjust=100
```

Then:
```bash
systemctl --user daemon-reload
systemctl --user restart openclaw-gateway.service
```

#### 2. Add Memory Monitoring Script
Create `tools/memory-monitor.js`:
- Polls gateway process RSS memory every 30 seconds
- Logs to `.learnings/MEMORY-MONITOR.log`
- Sends Telegram alert if >700MB sustained for 5 minutes
- Auto-restart if >900MB

#### 3. Fix mem0 SQLite Binding Issues
The repeated errors:
```
openclaw-mem0: recall failed: Error: Could not locate the bindings file.
→ node_sqlite3.node
```

**Actions**:
- Rebuild sqlite3 native bindings: `npm rebuild sqlite3`
- Add binding health check at startup
- Fallback to pure-JS SQLite if bindings fail

---

### 🟡 High Priority (This Week)

#### 4. Add Systemd Watchdog
```ini
[Service]
WatchdogSec=30s
Restart=always
RestartSec=5s
```

**Why**: systemd will detect hung processes and restart them automatically.

#### 5. Create Health Dashboard Widget
Add to Mission Control:
- Memory usage graph (last 24h)
- OOM kill history
- Process uptime
- SQLite binding status

#### 6. Add Pre-emptive Restart
If memory usage >800MB for 10 minutes:
- Log warning
- Graceful restart before OOM killer acts

---

### 🟢 Medium Priority (Next Week)

#### 7. Investigate Memory Leaks
- Profile gateway with `clinic.js` or `0x`
- Check for:
  - Event listener leaks
  - Unbounded caches
  - SQLite connection leaks
  - mem0 embedding cache growth

#### 8. Add Swap Monitoring
- Alert if swap usage >50%
- Swap is often precursor to OOM

#### 9. Implement Circuit Breaker for mem0
- If 10+ consecutive mem0 failures in 5 minutes:
  - Disable mem0 temporarily
  - Log error
  - Continue operation without memory features

---

## Monitoring Implementation

### Systemd Service Updates
File: `~/.config/systemd/user/openclaw-gateway.service.d/memory-limits.conf`

```ini
[Service]
# Memory limits to prevent OOM
MemoryLimit=1G
MemoryHigh=800M

# OOM priority - lower priority than critical system services
OOMScoreAdjust=100

# Watchdog - restart if unresponsive
WatchdogSec=30s
TimeoutStartSec=60s

# Restart policy
Restart=always
RestartSec=5s
RestartSteps=10
RestartMaxDelaySec=300

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=openclaw-gateway
```

### Memory Monitor Script
File: `tools/memory-monitor.js`

```javascript
// Monitors gateway memory, alerts on thresholds
const { execSync } = require('child_process');
const path = require('path');

const THRESHOLDS = {
  WARNING_MB: 700,
  CRITICAL_MB: 900,
  SUSTAINED_MINUTES: 5
};

function getGatewayMemory() {
  const pid = execSync('systemctl --user show openclaw-gateway.service --value MainPID')
    .toString().trim();
  if (!pid) return null;
  
  const status = execSync(`ps -o rss= -p ${pid}`)
    .toString().trim();
  return Math.floor(parseInt(status) / 1024); // Convert to MB
}

// Run every 30 seconds
setInterval(() => {
  const memMB = getGatewayMemory();
  const timestamp = new Date().toISOString();
  
  if (memMB > THRESHOLDS.CRITICAL_MB) {
    // Log and alert
    console.error(`[${timestamp}] CRITICAL: Gateway using ${memMB}MB`);
    // Send Telegram alert, trigger restart
  } else if (memMB > THRESHOLDS.WARNING_MB) {
    console.warn(`[${timestamp}] WARNING: Gateway using ${memMB}MB`);
  }
}, 30000);
```

### Health Check Integration
Add to `tools/system-health-check.js`:

```javascript
async function checkMemory() {
  const memUsage = process.memoryUsage();
  const rssMB = Math.round(memUsage.rss / 1024 / 1024);
  
  return {
    status: rssMB > 800 ? 'warn' : 'ok',
    rssMB,
    heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
    threshold: 800
  };
}
```

---

## Recovery Procedures

### If OOM Kill Occurs

1. **Immediate** (automated):
   - systemd restarts service (already configured)
   - Alert sent via Telegram
   - Memory snapshot logged

2. **Post-Incident** (manual):
   ```bash
   # Check what was killed
   journalctl --user -u openclaw-gateway.service --since "1 hour ago" | grep -i oom
   
   # Check memory at time of kill
   cat /var/log/kern.log | grep -i "killed process"
   
   # Get memory profile
   node tools/memory-monitor.js --report
   ```

3. **Root Cause Analysis**:
   - Review memory monitor logs
   - Check for patterns (time of day, specific operations)
   - Profile if recurring

---

## Validation

After implementation, verify:

```bash
# 1. Memory limits applied
systemctl --user show openclaw-gateway.service | grep -i memory

# 2. Monitor running
ps aux | grep memory-monitor

# 3. Health check includes memory
node tools/system-health-check.js

# 4. Simulate high memory (test only!)
# Verify alerts fire correctly
```

---

## Task Checklist

- [ ] Create systemd memory limit overrides
- [ ] Create memory-monitor.js script
- [ ] Add memory check to system-health-check.js
- [ ] Rebuild sqlite3 native bindings
- [ ] Add watchdog to systemd service
- [ ] Create memory dashboard widget
- [ ] Document in OPERATIONAL-RUNBOOK.md
- [ ] Test OOM alerting (staged)
- [ ] Schedule weekly memory report

---

## References

- systemd memory controls: `man systemd.resource-control`
- OOM killer tuning: `/proc/[pid]/oom_score_adj`
- Node.js memory profiling: `clinic.js`, `0x`, `heapdump`

---

_Created: 2026-03-08 after OOM incident_  
_Owner: Alfred_  
_Status: Plan ready for implementation_
