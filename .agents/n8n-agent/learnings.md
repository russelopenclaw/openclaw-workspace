# Nexus (n8n-agent) — Accumulated Learnings

## Session 1: Agent Bootstrap (2026-03-13)

**Purpose:** Establish n8n specialist agent with persistent memory

**Key Decisions:**
- Semi-persistent architecture ( follows DadJ/QAAgent/HealthMon pattern)
- Mem0 namespace: `n8n-agent` (isolated from Alfred's master knowledge)
- Wake pattern: on-demand (not scheduled)
- Primary tools: web_search, web_fetch for n8n docs, memory_store for learnings

**Initial Knowledge to Seed:**
1. n8n workflow structure (nodes, connections, credentials)
2. Error handling patterns (try-catch, error triggers)
3. Sub-workflow calling (Execute Workflow node)
4. Expression syntax ({{ $json.field }})
5. Credential management (OAuth2, API keys)

**Files Created:**
- `AGENT.md` — Identity & responsibility
- `config.json` — Preferences & lifecycle
- `runs/` — Run history directory
- `docs/` — Workflow JSON exports, cached docs

**Next Activation:** Wait for Kevin's first n8n design request

---

## Workflow Patterns (to be populated)

### Master Flow + Sub-Flow Architecture
- Master: Orchestrates trigger, error handling, logging
- Sub-flows: Isolated business logic (dad joke generation, calendar checks, etc.)
- Benefit: Debug individual flows without breaking entire pipeline

### Error Handling
- Error Trigger node → Log failure → Notify Alfred → Retry orescalate
- Fail branches documented per node type

### Credential Patterns
- OAuth2 refresh handling
- API key rotation
- Scoped permissions per workflow

---

*This file grows with each activation. Promote broadly-applicable patterns to Alfred's MEMORY.md or docs.*
