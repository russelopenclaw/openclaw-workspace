#!/usr/bin/env node
/**
 * DJ Agent Launcher
 * 
 * Usage: node .agents/dj/launch.js [--direct] [--task "description"]
 * 
 * --direct: Spawn as a direct session (you talk to DJ directly)
 * --task:   Give DJ a specific task to work on
 * 
 * Examples:
 *   node .agents/dj/launch.js --direct
 *   node .agents/dj/launch.js --task "Review the dad joke pipeline vibe"
 *   node .agents/dj/launch.js --direct --task "Brainstorm video ideas"
 */

const { spawn } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const isDirect = args.includes('--direct');
const taskIndex = args.indexOf('--task');
const task = taskIndex !== -1 ? args[taskIndex + 1] : null;

const agentDir = path.dirname(__dirname);
const configPath = path.join(agentDir, 'config.json');

// Read DJ's config
const config = require(configPath);

console.log(`🎧 Spawning DJ...`);
console.log(`   Model: ${config.model.id}`);
console.log(`   Reasoning: ${config.reasoning.default}`);
console.log(`   Mode: ${isDirect ? 'DIRECT (you talk to DJ)' : 'TASK (DJ works then reports back)'}`);
if (task) console.log(`   Task: ${task}`);

// Build the spawn command
const spawnArgs = [
  'sessions_spawn',
  '--runtime', 'acp',
  '--mode', 'session',
  '--agentId', 'dj',
  '--model', config.model.id,
  '--thinking', config.reasoning.default,
  '--cwd', '/home/kevin/.openclaw/workspace',
  '--label', 'DJ'
];

if (task) {
  spawnArgs.push('--task', task);
}

// Spawn through openclaw CLI
const proc = spawn('openclaw', spawnArgs, {
  stdio: 'inherit',
  shell: true
});

proc.on('exit', (code) => {
  process.exit(code);
});
