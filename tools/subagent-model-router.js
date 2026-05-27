/**
 * Subagent Model Router - picks the right model based on task type
 * 
 * Usage:
 *   const router = require('./subagent-model-router.js');
 *   const model = router.selectModel('build auth API');
 */

const MODEL_RULES = {
  // Code tasks → coder model
  code: {
    keywords: ['code', 'function', 'api', 'endpoint', 'component', 'screen', 'flutter', 'react', 'build', 'implement', 'refactor', 'fix', 'bug', 'debug'],
    model: 'ollama/qwen3-coder-next:cloud',
    reasoning: 'off'
  },
  
  // Quick/simple tasks → fast cloud model
  quick: {
    keywords: ['summarize', 'list', 'check', 'status', 'simple', 'quick', 'format', 'convert'],
    model: 'ollama/minimax-m2.5:cloud',
    reasoning: 'off'
  },
  
  // Research/analysis → bigger general model
  research: {
    keywords: ['research', 'analyze', 'compare', 'review', 'study', 'investigate', 'docs', 'documentation'],
    model: 'ollama/kimi-k2.5:cloud',
    reasoning: 'off'
  },
  
  // Default → general purpose cloud model
  default: {
    model: 'ollama/nemotron-3-super:cloud',
    reasoning: 'off'
  }
};

function selectModel(task, context = {}) {
  const taskLower = task.toLowerCase();
  
  // Check research FIRST (before code, since "review docs" is research not code)
  if (MODEL_RULES.research.keywords.some(k => taskLower.includes(k))) {
    return MODEL_RULES.research.model;
  }
  
  // Check for code-related keywords
  if (MODEL_RULES.code.keywords.some(k => taskLower.includes(k))) {
    return MODEL_RULES.code.model;
  }
  
  // Check for quick task keywords
  if (MODEL_RULES.quick.keywords.some(k => taskLower.includes(k))) {
    return MODEL_RULES.quick.model;
  }
  
  return MODEL_RULES.default.model;
}

module.exports = { selectModel, MODEL_RULES };

// Example usage in a spawn call:
//
// const router = require('./subagent-model-router.js');
// const model = router.selectModel(task);
//
// await sessions_spawn({
//   task,
//   runtime: 'subagent',
//   model,
//   thinking: 'off'  // always off for subagents
// });
