#!/usr/bin/env node
/**
 * Stable Diffusion Model & Sampler Decision Engine
 * 
 * Implements the decision spec from docs/StableDiffusionModel.md
 * 
 * Usage:
 *   const decider = require('./tools/sd-model-decider.js');
 *   const result = decider.selectModelAndSampler(prompt, steps, width, height);
 */

// Model definitions
const MODELS = {
  JuggernautXL: {
    type: 'stylized',
    characteristics: ['strong lighting contrast', 'cinematic composition', 'stylized environments', 'emotional/atmospheric']
  },
  RealVisXL: {
    type: 'photorealistic',
    characteristics: ['natural lighting', 'realistic textures', 'photography-like']
  }
};

// Prompt classification keywords
const STYLIZED_KEYWORDS = [
  'cinematic', 'dreamy', 'mystical', 'glowing', 'lantern', 'temple', 'zen',
  'meditation', 'cherry blossom', 'fantasy', 'ethereal', 'fireflies',
  'atmospheric', 'fog', 'magical', 'surreal', 'abstract', 'colorful',
  'vibrant', 'neon', 'aurora', 'northern lights', 'bamboo', 'garden',
  'japanese', 'sunset', 'golden hour', 'twilight', 'dusk', 'dawn'
];

const REALISTIC_KEYWORDS = [
  'beach', 'ocean', 'mountain', 'lake', 'forest', 'river', 'rain', 'snow',
  'city', 'cafe', 'street', 'landscape', 'photorealistic', 'nature',
  'realistic', 'natural', 'documentary', 'photo', 'real world'
];

// Conflict resolution keywords (force stylized)
const CONFLICT_STYLIZED = ['cinematic', 'glowing', 'lantern', 'mystical', 'fantasy'];

// Sampler characteristics
const SAMPLERS = {
  'DPM++ 2M': { quality: 'moderate', speed: 'fast', stability: 'high' },
  'DPM++ 2M Karras': { quality: 'high', speed: 'moderate', stability: 'high' },
  'DPM++ SDE Karras': { quality: 'highest', speed: 'slow', stability: 'moderate', realism: true },
  'Euler a': { quality: 'artistic', speed: 'fast', stability: 'low', artistic: true }
};

/**
 * Classify prompt as stylized or realistic
 */
function classifyPrompt(prompt) {
  const lower = prompt.toLowerCase();
  
  const hasStylized = STYLIZED_KEYWORDS.some(k => lower.includes(k));
  const hasRealistic = REALISTIC_KEYWORDS.some(k => lower.includes(k));
  
  if (hasStylized && hasRealistic) {
    // Conflict resolution
    const hasConflictStylized = CONFLICT_STYLIZED.some(k => lower.includes(k));
    return hasConflictStylized ? 'stylized' : 'realistic';
  }
  
  return hasStylized ? 'stylized' : 'realistic';
}

/**
 * Select model based on prompt classification
 */
function selectModel(prompt) {
  const classification = classifyPrompt(prompt);
  return classification === 'stylized' ? 'JuggernautXL' : 'RealVisXL';
}

/**
 * Select sampler based on model and prompt
 */
function selectSampler(prompt, model, steps = 20) {
  const lower = prompt.toLowerCase();
  
  // Rule 7: If steps < 20, use DPM++ 2M Karras
  if (steps < 20) {
    return 'DPM++ 2M Karras';
  }
  
  // Rule 8: If steps >= 25 AND RealVisXL, use SDE Karras
  if (steps >= 25 && model === 'RealVisXL') {
    return 'DPM++ SDE Karras';
  }
  
  // Rule 4: Stylized model with dreamy/fantasy keywords
  if (model === 'JuggernautXL') {
    const hasArtisticKeywords = ['dreamy', 'fantasy', 'mystical', 'ethereal'].some(k => lower.includes(k));
    if (hasArtisticKeywords) {
      return 'Euler a';
    }
    return 'DPM++ 2M Karras';
  }
  
  // Rule 5: Realistic model with photorealistic keywords
  if (model === 'RealVisXL') {
    const hasRealisticKeywords = ['photorealistic', 'ultra realistic', 'highly detailed'].some(k => lower.includes(k));
    if (hasRealisticKeywords) {
      return 'DPM++ SDE Karras';
    }
    return 'DPM++ 2M Karras';
  }
  
  // Rule 3: Default
  return 'DPM++ 2M Karras';
}

/**
 * Main decision function
 */
function selectModelAndSampler(prompt, steps, width, height) {
  // Default steps
  const finalSteps = steps || 20;
  
  // Select model
  const model = selectModel(prompt);
  
  // Select sampler
  const sampler = selectSampler(prompt, model, finalSteps);
  
  return {
    model,
    sampler,
    steps: finalSteps,
    width: width || 1920,
    height: height || 1080
  };
}

/**
 * Analyze prompt and return detailed reasoning
 */
function analyzePrompt(prompt) {
  const lower = prompt.toLowerCase();
  const classification = classifyPrompt(prompt);
  const model = selectModel(prompt);
  const sampler = selectSampler(prompt, model);
  
  const foundStylized = STYLIZED_KEYWORDS.filter(k => lower.includes(k));
  const foundRealistic = REALISTIC_KEYWORDS.filter(k => lower.includes(k));
  
  return {
    classification,
    model,
    sampler,
    keywords: {
      stylized: foundStylized,
      realistic: foundRealistic
    },
    reasoning: {
      model: classification === 'stylized' 
        ? 'Prompt contains stylized keywords → JuggernautXL' 
        : 'Prompt contains realistic keywords → RealVisXL',
      sampler: sampler === 'Euler a' 
        ? 'Artistic keywords detected → Euler a for variation'
        : sampler === 'DPM++ SDE Karras'
        ? 'High realism requested → SDE Karras for smooth gradients'
        : 'Default high-quality sampler → DPM++ 2M Karras'
    }
  };
}

// CLI mode
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log('SD Model & Sampler Decision Engine');
    console.log('');
    console.log('Usage:');
    console.log('  node tools/sd-model-decider.js "prompt text"');
    console.log('  node tools/sd-model-decider.js --analyze "prompt text"');
    console.log('');
    console.log('Examples:');
    console.log('  node tools/sd-model-decider.js "cherry blossom garden with glowing lanterns"');
    console.log('  node tools/sd-model-decider.js --analyze "calm mountain lake at sunrise"');
    process.exit(0);
  }
  
  const analyze = args.includes('--analyze');
  const prompt = args.find(a => !a.startsWith('-'));
  
  if (!prompt) {
    console.error('❌ Prompt required');
    process.exit(1);
  }
  
  const result = analyze ? analyzePrompt(prompt) : selectModelAndSampler(prompt);
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { selectModelAndSampler, analyzePrompt, classifyPrompt };
