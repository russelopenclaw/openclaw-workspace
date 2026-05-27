## Semi-Persistent Agents (Created March 12, 2026)

**4 agents with identity + accumulated knowledge** (dormant between activations, but retain memory):

| Agent | Wake Pattern | Accumulates | Files |
|-------|--------------|-------------|-------|
| **DadJ** | Daily 6 AM | Pipeline wisdom (fonts, buffers, validation patterns) | `.agents/dadj/` |
| **QAAgent** | Per-task (VALIDATION) | Failure patterns, validation rules | `.agents/qaagent/` |
| **HealthMon** | Hourly + heartbeat (30 min) | System baselines, "normal" ops knowledge | `.agents/healthmon/` |

Each has:
- `config.json` - Identity, preferences, lifecycle
- `learnings.md` - Accumulated wisdom (grows per run)
- `AGENT.md` - Status, responsibility, mem0 namespace
- `memory.mem0` - Agent-specific mem0 vector space
- `runs/` or `checks/` or `validations/` - Run history

mem0 integration: `agentId` namespace isolates each agent's memory vectors from Alfred's master knowledge.
