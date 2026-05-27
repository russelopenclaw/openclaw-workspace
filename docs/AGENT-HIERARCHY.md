# Agent Hierarchy - Alfred as Planner/Manager

**Date:** March 12, 2026  
**Status:** ✅ Production Active  
**Registry:** `tools/agent-registry.js`  

---

## Organizational Chart

```
┌────────────────────────────────────────┐
│         Alfred (Planner/Manager)       │
│         └─ Alpha Agent / Boss          │
├────────────────────────────────────────┤
│                                        │
│  Alfred assigns tasks to specialized   │
│  workers based on task requirements    │
│                                        │
└────────────────────────────────────────┘
         │
         ├──────────────┬──────────────┬──────────────┐
         ▼              ▼              ▼              ▼
   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │  Coding  │   │ Research │   │  Writing │   │  Image   │
   │  Agent   │   │  Agent   │   │  Agent   │   │  Agent   │
   └──────────┘   └──────────┘   └──────────┘   └──────────┘
         │              │              │              │
         └──────────────┴──────────────┴──────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │ Validation Agent│
                     │ (Always Alfred) │
                     └─────────────────┘
                              │
                              ▼
                          DONE
```

---

## Alfred's Role (Alpha Agent)

**As Planner/Manager:**
- ✅ **Assigns** tasks to best-fitting worker agent
- ✅ **Schedules** work based on priority
- ✅ **Monitors** worker completion
- ✅ **Validates** all deliverables (never delegates validation)
- ✅ **Evaluates** performance (future feature)

**I never spawn a sub-agent for validation.** That's my job as the boss.

---

## Worker Agent Roster

### 1. Coding Agent

**Specialty:** Software development, code generation, APIs, debugging

**Models:**
- Small: `qwen2.5-coder:7b` (fast, local, simple tasks)
- Large: `qwen3-coder-next:cloud` (complex refactors, large codebases)

**Triggers:** `code`, `coding`, `script`, `api`, `endpoint`, `function`, `class`, `debug`, `refactor`, `fix bug`, `commit`, `git`, `library`, `sdk`, `framework`

**Use when:** Task involves programming, debugging, or technical implementation.

---

### 2. Research Agent

**Specialty:** Information gathering, analysis, documentation review, web search

**Models:**
- Small: `llama3.1:8b` (quick research)
- Large: `deepseek-v3.1:671b-cloud` (deep analysis, complex topics)

**Triggers:** `research`, `analyze`, `investigate`, `compare`, `review`, `document`, `study`, `explore`, `find`, `search`, `learn`, `audit`

**Use when:** Task requires information gathering, competitive analysis, or investigation.

---

### 3. Writing Agent

**Specialty:** Content creation, technical writing, documentation, copywriting

**Models:**
- Small: `qwen2.5:7b` (quick writing)
- Large: `qwen3.5:cloud` (complex documentation, technical guides)

**Triggers:** `write`, `content`, `document`, `documentation`, `copy`, `description`, `guide`, `tutorial`, `readme`, `blog post`, `summary`, `explain`, `api documentation`

**Use when:** Task involves creating written content, documentation, or technical guides.

---

### 4. Image Agent

**Specialty:** Stable Diffusion prompts, image generation, visual content

**Models:**
- Small: `qwen2.5:7b` (prompt generation, text-to-image planning)
- Large: `sd-webui:api` (direct SD API calls for image generation)

**Triggers:** `image`, `visual`, `background`, `graphic`, `illustration`, `photo`, `picture`, `sd`, `stable diffusion`, `generate image`, `prompt`

**Use when:** Task requires image creation, visual content, or SD prompt engineering.

---

### 5. General Agent (Default)

**Specialty:** Catch-all for tasks without clear specialty

**Models:**
- Small: `qwen2.5:7b` (fast, general purpose)
- Large: `qwen3.5:cloud` (complex general tasks)

**Triggers:** None (used when no clear match)

**Use when:** Task doesn't fit other categories or is general-purpose work.

---

### 6. Validation Agent (Alfred ONLY)

**Specialty:** Quality assurance, deliverable verification, acceptance criteria

**Models:** `qwen3.5:cloud` (Alfred uses reasoning model)

**Triggers:** `validate`, `verify`, `check`, `test`, `qa`, `quality`

**Note:** This is ALWAYS Alfred. I never delegate validation - it's my responsibility as the planner/manager to ensure quality.

---

## Assignment Algorithm

**Location:** `tools/agent-registry.js`

**Function:** `getBestAgentForTask(title, deliverables)`

**Process:**
1. Scan title + deliverables for trigger keywords
2. Score each agent based on match count
3. High-priority triggers weighted more (coding=3, research=2, writing=2, image=2)
4. Select agent with highest score
5. Return: `{agent, confidence, score, reasoning}`

**Example:**
```javascript
const result = getBestAgentForTask('Fix login API bug', 'Debug authentication');
// result: {
//   agent: 'coding',
//   confidence: 'high',
//   score: 6,
//   reasoning: 'Matched coding triggers'
// }
```

---

## Model Selection

**Function:** `getModelForAgent(agentKey, priority)`

**Logic:**
- High priority → Large model (more capable, slower, costs tokens)
- Medium/Low priority → Small model (fast, efficient, local)

**Example:**
```javascript
const model = getModelForAgent('coding', 'high');
// 'qwen3-coder-next:cloud'

const model = getModelForAgent('coding', 'medium');
// 'qwen2.5-coder:7b'
```

---

## Task Assignment Flow

```
Task in READY
      │
      ▼
Pool Manager runs (heartbeat)
      │
      ▼
getBestAgentForTask(title, deliverables)
      │
      ├─ Coding triggers?  → Coding Agent
      ├─ Research triggers?→ Research Agent
      ├─ Writing triggers? → Writing Agent
      ├─ Image triggers?   → Image Agent
      └─ No clear match?   → General Agent
      │
      ▼
Assign model based on priority
      │
      ▼
Spawn sub-agent with task
      │
      ▼
Task column: READY → IN_PROGRESS
      │
      ▼
Agent completes work
      │
      ▼
workflow-hook.js: IN_PROGRESS → VALIDATION
      │
      ▼
Alfred (me) validates
      │
      ├─ Pass → DONE
      └─ Fail → READY (with feedback)
```

---

## Integration Points

### Pool Manager (`tools/subagent-pool-manager.js`)

**Updated:**
```javascript
// Import registry
const agentRegistry = require('./agent-registry.js');

// Intelligent assignment
function detectTaskType(title, deliverables = '') {
    const result = agentRegistry.getBestAgentForTask(title, deliverables);
    return result.agent;
}

// On spawn:
const agentResult = agentRegistry.getBestAgentForTask(task.title, task.description);
const agentType = agentResult.agent;
const agentInfo = agentRegistry.AGENTS[agentType];
const model = task.priority === 'high' ? agentInfo.models.large : agentInfo.models.small;

await openclawTools.sessions_spawn({
    runtime: 'subagent',
    model: model,
    task: `Complete task ${task.id}: ${task.title}`,
    label: `${agentInfo.name}-${task.id}`,
});
```

### Heartbeat Runner (`tools/heartbeat-runner.js`)

Every 30 min:
1. Pool manager runs (assigns READY tasks)
2. Kanban review (detects stuck tasks)
3. Validation checks (VALIDATION column tasks)

---

## Test Results

**Task Types Tested:**

| Task | Assigned Agent | Confidence | Reasoning |
|------|---------------|------------|-----------|
| "Fix login API bug" | Coding | High | Matched coding triggers |
| "Research Supabase alternatives" | Research | High | Matched research triggers |
| "Write API documentation" | Writing | High | Matched writing triggers |
| "Generate SD image prompts" | Image | High | Matched image triggers |
| "Quick status check" | General | Low | No clear match |

**Result:** Agent selection working correctly ✅

---

## File Locations

| Component | Path |
|-----------|------|
| Agent Registry | `/workspace/tools/agent-registry.js` |
| Pool Manager | `/workspace/tools/subagent-pool-manager.js` |
| Workflow Hook | `/workspace/tools/agent-workflow-hook.js` |
| Validation Agent | `/workspace/tools/validation-agent.js` |
| Documentation | `/workspace/docs/AGENT-HIERARCHY.md` |
| Event Log | `/workspace/.learnings/SUBAGENT-POOL.log` |

---

## Usage Examples

### Manual Task Assignment
```bash
# In Alfred session
const registry = require('./tools/agent-registry.js');

const task = { title: 'Create unit tests', deliverables: 'Test files' };
const agent = registry.getBestAgentForTask(task.title, task.deliverables);
console.log(`Best agent: ${agent.agent} (${agent.confidence} confidence)`);

const model = registry.AGENTS[agent.agent].models.small;
console.log(`Model: ${model}`);
```

### Pool Manager Auto-Assignment
```javascript
// Runs automatically every heartbeat
// Assigns READY tasks to optimal agents
// Moves tasks: READY → IN_PROGRESS
// On completion: IN_PROGRESS → VALIDATION
// Alfred validates → DONE or READY (with feedback)
```

---

## Agent Performance Tracking (Future)

**TODO:** Track metrics per agent:
- Completion rate
- Time to completion
- Validation pass rate
- Rejection reasons
- Efficiency (model choice vs task complexity)

**Purpose:** Optimize future assignments based on agent strengths.

---

## Alfred's Commitment

**I will:**
- ✅ Assign tasks to the best-fit specialized agent
- ✅ Never spawn a sub-agent for validation (I do it)
- ✅ Ensure all completions go through VALIDATION gate
- ✅ Use trigger-based matching for agent selection
- ✅ Select models based on task priority

**No exceptions.** This is how I operate as the alpha/planner.

---

**Document Version:** 1.0 (2026-03-12)  
**Maintainer:** Alfred (Planner/Manager)  
**Registry Active:** ✅ `tools/agent-registry.js` loaded  
**First Assignment:** Pending (board clear - 81 DONE tasks)
