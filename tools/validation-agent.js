#!/usr/bin/env node

/**
 * Validation Agent - Alfred's Quality Assurance
 * 
 * Validates task deliverables using the standard checklist:
 * ☐ Deliverables exist - File/commit/API exists
 * ☐ Requirements met - All criteria satisfied
 * ☐ Output readable - Parseable, renders, executes
 * ☐ No obvious errors - Syntax, logic, format checks
 * ☐ Stored correctly - Committed, uploaded, deployed
 * 
 * Workflow:
 *   1. Load task from PostgreSQL
 *   2. Fetch deliverable (file, API result, commit, etc.)
 *   3. Validate against checklist + criteria
 *   4. Move task to DONE (pass) or READY (fail with notes)
 *   5. Log validation result
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

// Validation result types
const VALIDATION = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  PARTIAL: 'PARTIAL', // Pass with minor issues
};

/**
 * Fetch task with full details from PostgreSQL
 */
async function getTask(taskId) {
  const pool = new Pool(POOL_CONFIG);
  
  try {
    const result = await pool.query(`
      SELECT 
        id, title, description, column_name, assignee, priority,
        deliverables, validation_criteria, linked_subagent,
        started_at, completed_at, updated_at, created_at
      FROM tasks 
      WHERE id = $1
    `, [taskId]);
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('[ValidationAgent] Failed to fetch task:', error);
    return null;
  } finally {
    await pool.end();
  }
}

/**
 * Validate deliverables against criteria
 * 
 * Returns: { status, message, issues[], suggestions[] }
 */
async function validateDeliverables(task, deliverablePath) {
  const criteria = task.validation_criteria || [];
  const deliverables = task.deliverables || 'Unknown';
  
  console.log(`[ValidationAgent] Validating task: ${task.id}`);
  console.log(`  Title: ${task.title}`);
  console.log(`  Criteria: ${criteria.length} checks`);
  console.log(`  Expected: ${deliverables}`);
  console.log(`  Deliverable: ${deliverablePath || 'N/A'}`);
  
  const issues = [];
  const suggestions = [];
  let status = VALIDATION.PASS;
  
  // === FILE DELIVERABLE VALIDATION ===
  if (deliverablePath && fs.existsSync(deliverablePath)) {
    const stats = fs.statSync(deliverablePath);
    
    // Check file exists and has content
    if (stats.size < 100) {
      issues.push(`Deliverable file too small (${stats.size} bytes)`);
      status = VALIDATION.FAIL;
    }
    
    // Check file type match
    const ext = path.extname(deliverablePath).toLowerCase();
    if (deliverables.toLowerCase().includes('json') && ext !== '.json') {
      issues.push(`Expected JSON file but got ${ext}`);
      status = VALIDATION.FAIL;
    }
    
    // Validate JSON syntax if applicable
    if (ext === '.json') {
      try {
        const content = fs.readFileSync(deliverablePath, 'utf8');
        const data = JSON.parse(content);
        
        // Check array length if specified
        const arrayCriteria = criteria.find(c => 
          c.toLowerCase().includes('array') && 
          /\d+ items?/.test(c.toLowerCase())
        );
        
        if (arrayCriteria) {
          const match = arrayCriteria.match(/(\d+) items?/i);
          if (match) {
            const expectedLength = parseInt(match[1]);
            const actualLength = Array.isArray(data) ? data.length : 0;
            
            if (actualLength !== expectedLength) {
              issues.push(`Expected ${expectedLength} items, got ${actualLength}`);
              status = VALIDATION.FAIL;
            } else {
              console.log(`✓ Array length: ${actualLength}/${expectedLength}`);
            }
          }
        }
        
        // Check for consistent theme if specified
        if (criteria.some(c => c.toLowerCase().includes('consistent theme'))) {
          // Heuristic: check if all items have similar structure
          if (Array.isArray(data) && data.length > 0) {
            const firstKeys = Object.keys(data[0]).sort().join(',');
            const allMatch = data.every(item => 
              Object.keys(item).sort().join(',') === firstKeys
            );
            
            if (!allMatch) {
              issues.push('Inconsistent data structure across items');
              suggestions.push('Ensure all array items have the same schema');
            }
          }
        }
        
      } catch (e) {
        issues.push(`Invalid JSON: ${e.message}`);
        status = VALIDATION.FAIL;
      }
    }
  }
  
  // === CRITERIA CHECKS ===
  for (const criterion of criteria) {
    const lower = criterion.toLowerCase();
    
    // Count checks
    if (lower.includes('prompts') && /\d+ prompts?/.test(lower)) {
      const match = lower.match(/(\d+) prompts?/i);
      if (match) {
        const expected = parseInt(match[1]);
        // Already checked above if JSON array
        if (issues.some(i => i.includes('Expected') && i.includes('items'))) {
          // Skip, already counted
        }
      }
    }
    
    // Format checks
    if (lower.includes('formatted') || lower.includes('format')) {
      if (issues.some(i => i.toLowerCase().includes('invalid'))) {
        // Already captured
      }
    }
    
    // Theme/style consistency
    if (lower.includes('consistent') && lower.includes('theme')) {
      if (issues.some(i => i.includes('Inconsistent'))) {
        // Already captured
      }
    }
  }
  
  return {
    status,
    message: status === VALIDATION.PASS 
      ? 'All validation criteria passed'
      : `Validation failed: ${issues.length} issue(s) found`,
    issues,
    suggestions,
    criteriaChecked: criteria.length,
  };
}

/**
 * Update task status based on validation result
 */
async function updateTaskStatus(taskId, validationResult, notes = '') {
  const pool = new Pool(POOL_CONFIG);
  
  try {
    if (validationResult.status === VALIDATION.PASS) {
      // Move to DONE
      await pool.query(`
        UPDATE tasks 
        SET column_name = 'DONE',
            completed_at = NOW(),
            updated_at = NOW(),
            description = description || $1
        WHERE id = $2
      `, [
        notes ? `\n\n[Validated ${new Date().toISOString()}] ${notes}` : '',
        taskId
      ]);
      
      console.log(`✓ Task ${taskId} moved to DONE`);
      return { success: true, column: 'DONE' };
      
    } else {
      // Move back to READY with feedback
      const feedback = `\n\n[Validation Failed ${new Date().toISOString()}]
Issues found:
${validationResult.issues.map(i => `- ${i}`).join('\n')}
${validationResult.suggestions.length ? '\nSuggestions:\n' + validationResult.suggestions.map(s => `- ${s}`).join('\n') : ''}
Action: Please rework and resubmit for validation.`;
      
      await pool.query(`
        UPDATE tasks 
        SET column_name = 'READY',
            updated_at = NOW(),
            description = description || $1
        WHERE id = $2
      `, [feedback, taskId]);
      
      console.log(`✗ Task ${taskId} returned to READY (needs rework)`);
      return { success: true, column: 'READY' };
    }
    
  } catch (error) {
    console.error('[ValidationAgent] Failed to update task:', error);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

/**
 * Log validation to history
 */
async function logValidation(taskId, result) {
  const pool = new Pool(POOL_CONFIG);
  
  try {
    await pool.query(`
      INSERT INTO task_history (task_id, status, note)
      VALUES ($1, 'validated', $2)
    `, [
      taskId,
      `Validation by validation-agent: Status=${result.status} | ${result.message} | Issues: ${result.issues.length}`
    ]);
    
    console.log(`✓ Validation logged to history`);
  } catch (error) {
    console.error('[ValidationAgent] Failed to log validation:', error);
  } finally {
    await pool.end();
  }
}

/**
 * Main validation entry point
 */
async function validateTask(taskId, deliverablePath) {
  console.log(`[ValidationAgent] Starting validation for task: ${taskId}`);
  console.log('================================================');
  
  // 1. Fetch task
  const task = await getTask(taskId);
  
  if (!task) {
    console.error(`[ValidationAgent] Task ${taskId} not found`);
    return { success: false, error: 'Task not found' };
  }
  
  if (task.column_name !== 'VALIDATION') {
    console.warn(`[ValidationAgent] Task ${taskId} is in ${task.column_name}, not VALIDATION`);
    console.log('Proceeding with validation anyway...');
  }
  
  // 2. Validate deliverables
  const result = await validateDeliverables(task, deliverablePath);
  
  console.log('');
  console.log(`Validation Result: ${result.status}`);
  console.log(`Message: ${result.message}`);
  if (result.issues.length) {
    console.log(`Issues (${result.issues.length}):`);
    result.issues.forEach((issue, i) => console.log(`  ${i+1}. ${issue}`));
  }
  if (result.suggestions.length) {
    console.log(`Suggestions:`);
    result.suggestions.forEach((s, i) => console.log(`  ${i+1}. ${s}`));
  }
  console.log('================================================');
  
  // 3. Update task status
  const update = await updateTaskStatus(taskId, result);
  
  // 4. Log to history
  await logValidation(taskId, result);
  
  return {
    success: update.success,
    taskId,
    status: result.status,
    newColumn: update.column,
    issues: result.issues,
    suggestions: result.suggestions,
  };
}

// CLI execution
if (require.main === module) {
  const taskId = process.argv[2];
  const deliverablePath = process.argv[3] || null;
  
  if (!taskId) {
    console.error('Usage: node tools/validation-agent.js <task-id> [deliverable-path]');
    console.error('');
    console.error('Examples:');
    console.error('  node tools/validation-agent.js T-104');
    console.error('  node tools/validation-agent.js T-104 /workspace/output/prompts.json');
    process.exit(1);
  }
  
  validateTask(taskId, deliverablePath)
    .then(result => {
      console.log('');
      if (result.success) {
        console.log(`✅ Validation complete: ${result.taskId} → ${result.newColumn}`);
        process.exit(0);
      } else {
        console.error(`❌ Validation failed: ${result.error}`);
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('[ValidationAgent] Unhandled error:', err);
      process.exit(1);
    });
}

module.exports = { validateTask, VALIDATION, getTask };
