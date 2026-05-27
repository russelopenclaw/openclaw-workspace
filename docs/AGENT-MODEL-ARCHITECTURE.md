# Agent Model Architecture

## Overview
Multi-tier agent system using Ollama with cloud-hosted models (localhost:11434).

## Available Models (localhost:11434)

| Model | Size | Context | Best For | Vision |
|-------|------|---------|----------|--------|
| `qwen3.5:cloud` | 397B MoE | 256K | Strategy, complex reasoning, orchestration, **image analysis** | ✅ Yes |
| `qwen3-coder-next:cloud` | 80B | 128K | Code generation, refactoring, architecture |
| `kimi-k2.5:cloud` | ~32B | 256K | Research, massive documents, analysis |
| `minimax-m2.7:cloud` | 2.7B | 128K | Fast tasks, quick answers, low latency |
| `minimax-m2.5:cloud` | 2.5B | 128K | Lightweight tasks, high throughput |
| `glm-5:cloud` | ~32B | 128K | General reasoning, balanced performance |
| `nemotron-3-super:cloud` | ~40B | 128K | Coding, instruction following |

**Note:** All models run via Ollama on localhost:11434. The `:cloud` suffix indicates remote weights, not a cloud service.

## Tier Structure

### Tier 1: Alfred (Master Orchestrator)
- **Model:** `qwen3.5:cloud` (397B MoE)
- **Context:** 256K tokens
- **Reasoning:** ON
- **Vision:** ✅ **YES** — Use for ALL image analysis (DO NOT use OpenAI/Claude/other)
- **Role:** Strategy, planning, decision-making, coordination, image analysis
- **Spawned by:** Human direct requests
- **Spawns:** Jeeves (for deep analysis), Sub-agents (for execution)

**⚠️ CRITICAL:** For image analysis, ALWAYS use `qwen3.5:cloud` via Ollama. Never use OpenAI, Claude, or other providers.

### Tier 2: Cloud Models (Deep Analysis)
- **Models:**
  - `kimi-k2.5:cloud` — Massive documents (>100K tokens)
  - `glm-5:cloud` — General complex analysis
  - `qwen3-coder-next:cloud` — Deep code reasoning
- **Context:** 128K-256K
- **Reasoning:** ON
- **Role:** Complex analysis, research, deep-dive tasks
- **Spawned by:** Alfred when task requires deep reasoning
- **Spawns:** None (terminal specialist)

### Tier 3: Sub-Agents (Task Executors)

| Name | Model | Reasoning | Best For |
|------|-------|-----------|----------|
| code-agent | `qwen3-coder-next:cloud` | OFF | Code writing, refactoring, debugging |
| tool-agent | `minimax-m2.7:cloud` | OFF | API calls, DB queries, tool execution |
| research-agent | `kimi-k2.5:cloud` | OFF | Web searches, data collection, analysis |
| quick-agent | `minimax-m2.5:cloud` | OFF | Simple transformations, summaries |

## Model Selection Decision Tree

```
Alfred receives a task:

1. Is this a simple lookup/quick task?
   └─ YES → Spawn quick-agent (minimax-m2.5:cloud, reasoning=OFF)
   
2. Does this require code?
   ├─ Simple feature/refactor → Spawn code-agent (qwen3-coder-next:cloud)
   └─ Complex architecture → Spawn Jeeves (qwen3-coder-next:cloud, reasoning=ON)
   
3. Does this require deep analysis/research?
   ├─ Massive documents (>100K tokens) → Cloud model (kimi-k2.5:cloud)
   └─ Standard complexity → Cloud model (glm-5:cloud)
   
4. Does this require API/tool execution?
   └─ YES → Spawn tool-agent (minimax-m2.7:cloud)
   
5. Do I need to coordinate multiple sub-tasks?
   └─ YES → Alfred orchestrates, spawns multiple Tier 3 agents
```

## Configuration

```javascript
// Alfred (main session)
{
  model: 'qwen3.5:cloud',
  thinking: 'on',
  mode: 'session'
}

// Cloud model (deep analysis)
{
  model: 'kimi-k2.5:cloud',  // or glm-5:cloud
  thinking: 'on',
  mode: 'run'
}

// Sub-agents (execution)
{
  model: 'qwen3-coder-next:cloud',  // or appropriate model
  thinking: 'off',
  mode: 'run'
}
```

## Performance Hierarchy

**Fastest/Cheapest (use first):**
1. `minimax-m2.5:cloud` — 2.5B, quickest response
2. `minimax-m2.7:cloud` — 2.7B, good balance

**Balanced:**
3. `glm-5:cloud` — 32B, solid reasoning
4. `nemotron-3-super:cloud` — 40B, coding tasks

**Most Capable (use when needed):**
5. `kimi-k2.5:cloud` — 256K context, massive documents
6. `qwen3-coder-next:cloud` — 80B, code expertise
7. `qwen3.5:cloud` — 397B, Alfred tier only

## Guiding Principles

- **Prefer smaller models** for simple tasks (minimax)
- **Reserve large models** for tasks requiring their strengths
- **Never use Tier 1/2 models** for basic execution
- **Match model to task complexity**, not just availability

## Monitoring

Track these metrics:
- Task completion time by model
- Success rate by model/type
- Token usage by model
- Inference latency

Adjust model assignments based on performance data.

---

*Last updated: 2026-03-27*
*Status: Active — using localhost:11434 cloud models*
*Ollama endpoint: localhost:11434*
