/**
 * Completion Verifier
 * 
 * Before marking a task as "done", verify it actually works:
 * - Check files were created/modified
 * - Smoke test API endpoints
 * - Verify no obvious errors
 * 
 * Call this when a subagent reports completion.
 * 
 * MIGRATION: 2026-03-05 - Migrated from JSON to PostgreSQL
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const POSTGRES_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'mission_control',
  user: 'alfred',
  password: 'AlfredDB2026Secure'
};

const WORKSPACE = '/home/kevin/.openclaw/workspace';

/**
 * Check if files exist and were recently modified
 */
function verifyFilesExist(expectedFiles, maxAgeMinutes = 10) {
  const results = [];
  const now = Date.now();
  
  for (const filePath of expectedFiles) {
    try {
      const stats = fs.statSync(filePath);
      const ageMs = now - stats.mtimeMs;
      const ageMinutes = Math.floor(ageMs / 60000);
      
      results.push({
        file: filePath,
        exists: true,
        recentlyModified: ageMinutes <= maxAgeMinutes,
        ageMinutes,
        size: stats.size
      });
    } catch (error) {
      results.push({
        file: filePath,
        exists: false,
        error: error.message
      });
    }
  }
  
  const allExist = results.every(r => r.exists);
  const allRecent = results.every(r => r.recentlyModified);
  
  return {
    ok: allExist && allRecent,
    files: results,
    message: allExist 
      ? (allRecent ? `All ${results.length} file(s) exist and recently modified` 
                   : `All files exist but some are not recent`)
      : `Missing ${results.filter(r => !r.exists).length} file(s)`
  };
}

/**
 * Smoke test an API endpoint
 */
function smokeTestApi(url, method = 'GET', expectedStatus = 200) {
  try {
    const cmd = `curl -s -o /dev/null -w "%{http_code}" -X ${method} "${url}"`;
    const statusCode = execSync(cmd, { encoding: 'utf8', timeout: 5000 }).trim();
    
    const ok = parseInt(statusCode) === expectedStatus;
    
    return {
      ok,
      url,
      method,
      expectedStatus,
      actualStatus: parseInt(statusCode),
      message: ok 
        ? `API ${method} ${url} returned ${statusCode}`
        : `API ${method} ${url} returned ${statusCode}, expected ${expectedStatus}`
    };
  } catch (error) {
    return {
      ok: false,
      url,
      method,
      error: error.message,
      message: `API test failed: ${error.message}`
    };
  }
}

/**
 * Check if a page loads without errors (basic check)
 */
function smokeTestPage(url) {
  try {
    const output = execSync(`curl -s -o /dev/null -w "%{http_code}" "${url}"`, {
      encoding: 'utf8',
      timeout: 5000
    }).trim();
    
    const statusCode = parseInt(output);
    const ok = statusCode >= 200 && statusCode < 400;
    
    return {
      ok,
      url,
      statusCode,
      message: ok 
        ? `Page ${url} loads (HTTP ${statusCode})`
        : `Page ${url} returned HTTP ${statusCode}`
    };
  } catch (error) {
    return {
      ok: false,
      url,
      error: error.message,
      message: `Page test failed: ${error.message}`
    };
  }
}

/**
 * Verify task completion based on task metadata
 */
function verifyTaskCompletion(task, subagentResult = {}) {
  const verifications = [];
  
  // Check if task description mentions specific files
  const filePatterns = [
    /created [`']?([^`'\s]+\.ts)['`]?/i,
    /updated [`']?([^`'\s]+\.ts)['`]?/i,
    /file[:\s]+[`']?([^`'\s]+\.(ts|js|json|md))['`]?/i
  ];
  
  const description = task.description + ' ' + (subagentResult.text || '');
  const foundFiles = [];
  
  for (const pattern of filePatterns) {
    const matches = description.match(pattern);
    if (matches && matches[1]) {
      const filePath = matches[1].startsWith('/') 
        ? matches[1] 
        : path.join(WORKSPACE, matches[1]);
      foundFiles.push(filePath);
    }
  }
  
  // Verify found files
  if (foundFiles.length > 0) {
    const fileCheck = verifyFilesExist(foundFiles);
    verifications.push(fileCheck);
  }
  
  // Check for API endpoints
  const apiPatterns = [
    /API.*?(\/api\/[^\s'"]+)/i,
    /endpoint.*?(\/api\/[^\s'"]+)/i,
    /route.*?(\/api\/[^\s'"]+)/i
  ];
  
  const foundApis = [];
  for (const pattern of apiPatterns) {
    const matches = description.match(pattern);
    if (matches && matches[1]) {
      foundApis.push(`http://localhost:8765${matches[1]}`);
    }
  }
  
  // Smoke test APIs
  for (const apiUrl of foundApis) {
    const apiCheck = smokeTestApi(apiUrl);
    verifications.push(apiCheck);
  }
  
  // Aggregate results
  const allOk = verifications.every(v => v.ok);
  
  return {
    ok: allOk,
    verifications,
    filesChecked: foundFiles.length,
    apisChecked: foundApis.length,
    message: allOk
      ? '✅ All verifications passed'
      : `⚠️ ${verifications.filter(v => !v.ok).length} verification(s) failed`
  };
}

/**
 * Log verification result to task_history table in PostgreSQL
 */
async function logVerification(taskId, verification) {
  const pool = new Pool(POSTGRES_CONFIG);
  
  try {
    await pool.query(`
      INSERT INTO task_history (task_id, status, note, created_at)
      VALUES ($1, $2, $3, NOW())
    `, [taskId, 'verified', `Completion verification: ${verification.message}`]);
    
    console.log(`Logged verification for task ${taskId}: ${verification.message}`);
    return true;
  } catch (error) {
    console.error('Failed to log verification:', error.message);
    return false;
  } finally {
    await pool.end();
  }
}

/**
 * Get task from PostgreSQL
 */
async function getTask(taskId) {
  const pool = new Pool(POSTGRES_CONFIG);
  
  try {
    const result = await pool.query(
      'SELECT id, title, description, column_name FROM tasks WHERE id = $1',
      [taskId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      column: row.column_name
    };
  } catch (error) {
    console.error('Failed to get task:', error.message);
    return null;
  } finally {
    await pool.end();
  }
}

/**
 * Full verification workflow: get task, verify, and log
 */
async function verifyAndLog(taskId, subagentResult = {}) {
  const task = await getTask(taskId);
  if (!task) {
    return {
      ok: false,
      error: 'Task not found',
      taskId
    };
  }
  
  const verification = verifyTaskCompletion(task, subagentResult);
  
  if (verification.ok) {
    await logVerification(taskId, verification);
  }
  
  return {
    ok: verification.ok,
    taskId,
    verification
  };
}

module.exports = {
  verifyFilesExist,
  smokeTestApi,
  smokeTestPage,
  verifyTaskCompletion,
  logVerification,
  getTask,
  verifyAndLog
};

// Self-test
if (require.main === module) {
  console.log('Running completion verifier self-test...\n');
  
  const testFiles = [
    '/home/kevin/.openclaw/workspace/tools/completion-verifier.js',
    '/home/kevin/.openclaw/workspace/nonexistent-file.txt'
  ];
  
  const fileResult = verifyFilesExist(testFiles);
  console.log('File check:', fileResult);
  
  const apiResult = smokeTestApi('http://localhost:8765/api/brain/items');
  console.log('API check:', apiResult);
}
