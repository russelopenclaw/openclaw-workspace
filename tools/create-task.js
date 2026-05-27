#!/usr/bin/env node

/**
 * Alfred's Task Factory
 * 
 * Creates tasks with REQUIRED structure:
 * - Task ID (auto-generated)
 * - Title (concise summary)
 * - Description (context & scope)
 * - Deliverables (tangible output)
 * - Validation Criteria (acceptance criteria)
 * - Assigned Agent (owner)
 * - Status (BACKLOG by default)
 * 
 * Usage:
 *   node tools/create-task.js <title> <deliverables> <criteria...> --agent <name> --desc <description>
 * 
 * Example:
 *   node tools/create-task.js "Generate SD image prompts" "JSON array of 40 prompts" "40 prompts" "formatted JSON" "consistent theme" --agent ImagePromptGenerator --desc "Create 40 prompts for a 60 second video"
 */

const { Pool } = require('pg');
const path = require('path');

const WORKSPACE = process.env.WORKSPACE || '/home/kevin/.openclaw/workspace';
const POOL_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'mission_control',
  user: process.env.DB_USER || 'alfred',
  password: process.env.DB_PASSWORD || 'AlfredDB2026Secure',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const result = {
    title: null,
    deliverables: null,
    criteria: [],
    agent: 'alfred',
    description: '',
    priority: 'medium',
    parent: null,
  };
  
  let mode = 'positionals';
  
  for (const arg of args) {
    if (arg === '--agent') {
      mode = 'agent';
      continue;
    }
    if (arg === '--desc' || arg === '--description') {
      mode = 'description';
      continue;
    }
    if (arg === '--priority') {
      mode = 'priority';
      continue;
    }
    if (arg === '--parent') {
      mode = 'parent';
      continue;
    }
    
    switch (mode) {
      case 'positionals':
        if (!result.title) {
          result.title = arg;
        } else if (!result.deliverables) {
          result.deliverables = arg;
        } else {
          result.criteria.push(arg);
        }
        break;
      case 'agent':
        result.agent = arg;
        mode = 'positionals';
        break;
      case 'description':
        result.description = arg;
        mode = 'positionals';
        break;
      case 'priority':
        result.priority = arg;
        mode = 'positionals';
        break;
      case 'parent':
        result.parent = arg;
        mode = 'positionals';
        break;
    }
  }
  
  return result;
}

/**
 * Generate next task ID
 */
async function getNextTaskId(pool) {
  const result = await pool.query(`
    SELECT MAX(id) as max_id FROM tasks WHERE id ~ '^T-[0-9]+$'
  `);
  
  if (result.rows[0].max_id) {
    const lastNum = parseInt(result.rows[0].max_id.split('-')[1]);
    return `T-${lastNum + 1}`;
  }
  
  return 'T-101'; // Start from 101
}

/**
 * Create task with mandated structure
 */
async function createTask(options) {
  const pool = new Pool(POOL_CONFIG);
  
  try {
    // Validate required fields
    if (!options.title) {
      throw new Error('Title is required');
    }
    if (!options.deliverables) {
      throw new Error('Deliverables are required - define the tangible output');
    }
    if (options.criteria.length === 0) {
      options.criteria.push('Work completed as described');
    }
    
    // Generate task ID
    const taskId = await getNextTaskId(pool);
    
    // Format: "T-104\n\nTitle: ..."
    const formattedDescription = [
      `Task ID: ${taskId}`,
      '',
      `Title: ${options.title}`,
      '',
      `Description: ${options.description || 'No additional context provided.'}`,
      '',
      `Deliverables: ${options.deliverables}`,
      '',
      `Assigned Agent: ${options.agent}`,
      '',
      `Status: READY`,
      '',
      'Validation Criteria:',
      ...options.criteria.map(c => `- ${c}`),
    ].join('\n');
    
    // Insert into database
    const result = await pool.query(`
      INSERT INTO tasks (
        id, title, description, column_name, assignee, priority,
        deliverables, validation_criteria, parent_task_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `, [
      taskId,
      options.title,
      formattedDescription,
      'READY', // Tasks start in READY, not IN_PROGRESS
      options.agent,
      options.priority,
      options.deliverables,
      options.criteria,
      options.parent,
    ]);
    
    console.log('');
    console.log(`✅ Task created: ${taskId}`);
    console.log('');
    console.log('--- Task Details ---');
    console.log(formattedDescription);
    console.log('');
    console.log('--- Database Record ---');
    console.log(`Column: READY`);
    console.log(`Priority: ${options.priority}`);
    console.log(`Created: ${result.rows[0].created_at}`);
    console.log('');
    
    return result.rows[0];
    
  } catch (error) {
    console.error('❌ Failed to create task:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('');
    console.error('Usage: node tools/create-task.js <title> <deliverables> [criteria...] --agent <name>');
    console.error('');
    console.error('Required:');
    console.error('  <title>         - Concise task title');
    console.error('  <deliverables>  - Tangible output (file, API, commit, etc.)');
    console.error('');
    console.error('Optional:');
    console.error('  [criteria...]   - Validation criteria (repeat for multiple)');
    console.error('  --agent <name>  - Assigned agent (default: alfred)');
    console.error('  --desc <text>   - Additional context');
    console.error('  --priority <p>  - low|medium|high (default: medium)');
    console.error('  --parent <id>   - Parent task ID');
    console.error('');
    console.error('Examples:');
    console.error('  node tools/create-task.js "Fix login bug" "Unit tests passing" "Bug fixed" "Tests pass" --agent BackendDev');
    console.error('  node tools/create-task.js "Create API endpoint" "/users GET endpoint" "200 OK" "JSON response" "Rate limiting" --agent APIdev --desc "Users list endpoint"');
    console.error('');
    console.error('RULES:');
    console.error('- Deliverables MUST be specified (tangible output)');
    console.error('- Validation criteria MUST be testable/verifiable');
    console.error('- Tasks start in READY column (not IN_PROGRESS)');
    console.error('- No excusions - this structure is MANDATORY');
    console.error('');
    process.exit(1);
  }
  
  const options = parseArgs(args);
  
  createTask(options)
    .then(task => {
      console.log(`✅ Task ${task.id} ready for assignment`);
      process.exit(0);
    })
    .catch(err => {
      console.error('Task creation failed:', err.message);
      process.exit(1);
    });
}

module.exports = { createTask, parseArgs };
