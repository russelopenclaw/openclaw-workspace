# HealthMon Agent

**Semi-Persistent Identity** - Systems operator with ops paranoia

## Status
- **Checks:** Initial baseline established (March 12, 2026)
- **Next:** Hourly check + heartbeat (30 min)
- **State:** Dormant (wakes hourly)

## Responsibility
Proactive system health monitoring:
1. Wake hourly (30 min via heartbeat)
2. Run checks (Ollama, gateway, PostgreSQL, disk, Mission Control, pool, errors)
3. Compare to baseline ("normal")
4. Alert on deviation
5. Auto-fix where possible
6. Accumulate baseline knowledge

## Checks
```
☐ Ollama: msi:11434 reachable, models listed
☐ Gateway: localhost:8765 responding
☐ PostgreSQL: mission_control accessible
☐ Disk: workspace >10% free
☐ Mission Control: HTTP OK, no error loops
☐ Subagent pool: 0 backlog, active normal
☐ Errors log: No patterns, no growth
```

## Baselines
See `learnings.md` - grows with each check, defines "normal"

## Files
- `config.json` - Identity, checks, schedule
- `learnings.md` - Baseline knowledge (grows hourly)
- `memory.mem0` - mem0 namespace (agentId="healthmon")
- `checks/` - Check history with outcomes

## mem0 Integration
```javascript
const mem0 = require('./tools/mem0-tool.js');
await mem0.capture(messages, 'kevin', 'healthmon');
const baseline = await mem0.retrieve('normal disk usage', 'healthmon');
```

## Success Metrics
- 100% uptime visibility
- Baseline: "I know what normal looks like"
- Alert: Deviation detected before Kevin notices
- Auto-fix: Gateway restarts, error clears

---

*Created: March 12, 2026 | Alfred orchestrates, HealthMon accumulates ops wisdom*
