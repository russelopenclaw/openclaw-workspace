# HealthMon Learnings

## System Baselines (Accumulated)

### Current Baselines (March 12, 2026)
- **Ollama:** `msi:11434` - 12 models (5 cloud, 7 local)
- **Gateway:** `localhost:8765` - responding
- **PostgreSQL:** `mission_control` - healthy, 81 tasks DONE
- **Disk:** workspace partition - TBD (first check)
- **Mission Control:** HTTP OK, no error loops
- **Subagent Pool:** 0 backlog, 0 active (normal for Kevin's bursty workload)
- **Errors:** 0 active, patterns TBD

### Failure Patterns (To Grow)
- ✅ Initial deployment March 12, 2026
- 📋 Baselines established
- ⏭️ First hourly check pending

### Known Issues Resolved
- None yet (fresh deployment)

### Alert Triggers (Learned)
- Ollama unreachable → Check msi hostname, network
- Gateway down → Restart, check port 8765
- PostgreSQL down → Can't auto-fix, alert Kevin
- Subagent stuck >30 min → Auto-respawn
- Error count growing → Investigate pattern

---

*This file grows with each hourly check - "normal" becomes defined*
