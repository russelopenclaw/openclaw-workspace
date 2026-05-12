/**
 * Agent Registry - Alfred's Specialized Worker Hierarchy
 * 
 * Agent hierarchy (Alfred as Planner/Manager):
 * 
 *  Alfred (Planner/Manager - me)
 *   ├─ Coding Agent (software development, APIs, scripts)
 *   ├─ Research Agent (analysis, documentation, web search)
 *   ├─ Writing Agent (content, documentation, copy)
 *   ├─ Image Generation Agent (SD prompts, image creation)
 *   └─ Validation Agent (quality assurance, already exists)
 * 
 * All agents are:
 * - Created by Alfred (I spawn sub-agents)
 * - Managed by Alfred (I assign tasks)
 * - Removed by Alfred (I kill on completion)
 * 
 * Usage:
 *   const registry = require('./tools/agent-registry.js');
 *   const agent = registry.getBestAgentForTask(taskTitle, deliverables);
 *   await spawnAgent(agent, taskId);
 */

/**
 * Agent definitions with specialties
 */
const AGENTS = {
  // Coding Agent
  'coding': {
    name: 'CodingAgent',
    specialty: 'Software development, code generation, API integration, debugging',
    models: {
      small: 'qwen2.5-coder:7b',        // Fast, local, simple tasks
      large: 'qwen3-coder-next:cloud',  // Complex, large refactors
    },
    triggers: ['code', 'coding', 'script', 'api', 'endpoint', 'function', 'class', 'debug', 'refactor', 'fix bug', 'commit', 'git', 'library', 'sdk', 'framework'],
    priority: 'high', // Preferred for dev work
  },
  
  // Research Agent
  'research': {
    name: 'ResearchAgent',
    specialty: 'Information gathering, analysis, documentation review, web search',
    models: {
      small: 'llama3.1:8b',             // Quick research
      large: 'deepseek-v3.1:671b-cloud', // Deep analysis
    },
    triggers: ['research', 'analyze', 'investigate', 'compare', 'review', 'document', 'study', 'explore', 'find', 'search', 'learn', 'audit'],
    priority: 'medium',
  },
  
  // Writing Agent
  'writing': {
    name: 'WritingAgent',
    specialty: 'Content creation, technical writing, documentation, copywriting',
    models: {
      small: 'qwen2.5:7b',              // Quick writing
      large: 'qwen3.5:cloud',           // Complex documentation
    },
    triggers: ['write', 'content', 'document', 'documentation', 'copy', 'description', 'guide', 'tutorial', 'readme', 'blog post', 'summary', 'explain', 'api documentation', 'technical writing'],
    priority: 'medium',
  },
  
  // Image Generation Agent
  'image': {
    name: 'ImageAgent',
    specialty: 'Stable Diffusion prompts, image generation, visual content',
    models: {
      small: 'qwen2.5:7b',              // Prompt generation
      large: 'sd-webui:api',            // SD API call
    },
    triggers: ['image', 'visual', 'background', 'graphic', 'illustration', 'photo', 'picture', 'sd', 'stable diffusion', 'generate image', 'prompt'],
    priority: 'medium',
  },
  
  // Validation Agent (always me - Alfred)
  'validation': {
    name: 'ValidationAgent',
    specialty: 'Quality assurance, deliverable verification, acceptance criteria',
    note: 'Always Alfred (I validate all completions)',
    triggers: ['validate', 'verify', 'check', 'test', 'qa', 'quality'],
  },
  
  // Default/General Agent
  'default': {
    name: 'GeneralAgent',
    specialty: 'Catch-all for tasks without clear specialty',
    models: {
      small: 'qwen2.5:7b',              // Fast, general purpose
      large: 'qwen3.5:cloud',           // Complex general
    },
    triggers: [],
    priority: 'low',
  },
};

/**
 * Get best agent for task based on title + deliverables
 * 
 * @param {string} title - Task title
 * @param {string} deliverables - Expected output
 * @returns {string} Agent key (coding, research, writing, image, default)
 */
function getBestAgentForTask(title, deliverables = '') {
  const combined = `${title} ${deliverables}`.toLowerCase();
  
  // Score each agent
  const scores = {};
  
  for (const [key, agent] of Object.entries(AGENTS)) {
    if (key === 'validation') continue; // Alfred handles validation
    
    let score = 0;
    
    // Check title/deliverables for trigger keywords
    for (const trigger of agent.triggers) {
      if (combined.includes(trigger)) {
        score += agent.priority === 'high' ? 3 : (agent.priority === 'medium' ? 2 : 1);
      }
    }
    
    scores[key] = score;
  }
  
  // Find agent with highest score
  let bestAgent = 'default';
  let bestScore = 0;
  
  for (const [agent, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestAgent = agent;
    }
  }
  
  // Debug: show scoring
  const match = bestScore > 0;
  
  return {
    agent: bestAgent,
    confidence: match ? 'high' : 'low',
    score: bestScore,
    reasoning: match 
      ? `Matched ${bestAgent} triggers`
      : 'No clear match, using default',
  };
}

/**
 * Get model for agent based on task complexity
 * 
 * @param {string} agentKey - Agent type
 * @param {string} priority - Task priority
 * @returns {string} Model name
 */
function getModelForAgent(agentKey, priority = 'medium') {
  const agent = AGENTS[agentKey] || AGENTS['default'];
  
  if (!agent) return AGENTS['default'].models.small;
  
  // High priority or complex tasks → large model
  if (priority === 'high') {
    return agent.models.large || agent.models.small;
  }
  
  // Default → small/efficient model
  return agent.models.small;
}

/**
 * Get agent description for logging
 */
function getAgentDescription(agentKey) {
  const agent = AGENTS[agentKey];
  if (!agent) return 'General purpose agent';
  return agent.specialty;
}

/**
 * List all available agents
 */
function listAgents() {
  return Object.entries(AGENTS)
    .filter(([key]) => key !== 'validation')
    .map(([key, agent]) => ({
      key,
      name: agent.name,
      specialty: agent.specialty,
      models: agent.models,
      triggerCount: agent.triggers.length,
    }));
}

module.exports = {
  AGENTS,
  getBestAgentForTask,
  getModelForAgent,
  getAgentDescription,
  listAgents,
};
