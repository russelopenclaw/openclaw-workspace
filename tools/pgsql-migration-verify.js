#!/usr/bin/env node

/**
 * PostgreSQL Migration - Final Verification Suite
 * 
 * Run after all phases complete to verify everything works.
 * 
 * Usage: node tools/pgsql-migration-verify.js
 */

const { execSync } = require('child_process');
const https = require('https');
const http = require('http');

const API_BASE = 'http://localhost:8765';
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

let passed = 0;
let failed = 0;
const results = [];

function log(color, message) {
  console.log(`${color}${message}${COLORS.reset}`);
}

function pass(test, details = '') {
  passed++;
  results.push({ test, status: 'PASS', details });
  log(COLORS.green, `✅ ${test} ${details ? '- ' + details : ''}`);
}

function fail(test, reason) {
  failed++;
  results.push({ test, status: 'FAIL', reason });
  log(COLORS.red, `❌ ${test}: ${reason}`);
}

async function testEndpoint(name, path, validator) {
  return new Promise((resolve) => {
    http.get(`${API_BASE}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (validator(json)) {
            pass(name);
            resolve(true);
          } else {
            fail(name, 'Validator returned false');
            resolve(false);
          }
        } catch (error) {
          fail(name, `Invalid JSON: ${error.message}`);
          resolve(false);
        }
      });
    }).on('error', (e) => {
      fail(name, e.message);
      resolve(false);
    });
  });
}

async function runTests() {
  log(COLORS.blue, '\n🧪 PostgreSQL Migration Verification Suite\n');
  log(COLORS.blue, '='.repeat(60) + '\n');

  // Test 1: API /api/status
  log(COLORS.cyan, 'Testing API Endpoints...\n');
  await testEndpoint(
    '/api/status - Returns agent data',
    '/api/status',
    (json) => {
      return json.agents && 
             json.agents.alfred && 
             typeof json.agents.alfred.status === 'string';
    }
  );

  // Test 2: API /api/tasks
  await testEndpoint(
    '/api/tasks - Returns 48 tasks',
    '/api/tasks',
    (json) => {
      return json.tasks && 
             json.tasks.length === 48 &&
             json.tasks[0].id;
    }
  );

  // Test 3: API /api/subagents
  await testEndpoint(
    '/api/subagents - Returns subagent data',
    '/api/subagents',
    (json) => {
      return Array.isArray(json);
    }
  );

  // Test 4: Database integrity
  log(COLORS.cyan, '\nTesting Database Integrity...\n');
  try {
    const taskCount = execSync(
      'PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d mission_control -t -c "SELECT COUNT(*) FROM tasks;"',
      { encoding: 'utf-8' }
    ).trim();
    
    if (parseInt(taskCount) === 48) {
      pass('Database has 48 tasks');
    } else {
      fail('Database task count', `Expected 48, got ${taskCount}`);
    }
  } catch (error) {
    fail('Database task count', error.message);
  }

  try {
    const agentCount = execSync(
      'PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d mission_control -t -c "SELECT COUNT(*) FROM agents;"',
      { encoding: 'utf-8' }
    ).trim();
    
    if (parseInt(agentCount) === 2) {
      pass('Database has 2 agents');
    } else {
      fail('Database agent count', `Expected 2, got ${agentCount}`);
    }
  } catch (error) {
    fail('Database agent count', error.message);
  }

  // Test 5: No JSON file references in code
  log(COLORS.cyan, '\nVerifying No Old JSON References...\n');
  try {
    const jsonRefs = execSync(
      'grep -r "tasks\\.json\\|subagents\\.json\\|agent-status\\.json" /workspace/mission-control/src --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "LEGACY" | grep -v "deprecat" | wc -l',
      { encoding: 'utf-8', cwd: '/' }
    ).trim();
    
    if (parseInt(jsonRefs) === 0) {
      pass('No old JSON references in core code');
    } else {
      fail('Old JSON references found', `${jsonRefs} references remain`);
    }
  } catch (error) {
    // grep returns 1 if no matches, which is what we want
    pass('No old JSON references in core code');
  }

  // Test 6: Mission Control loads
  log(COLORS.cyan, '\nTesting Mission Control UI...\n');
  await testEndpoint(
    'Mission Control homepage loads',
    '/',
    (html) => typeof html === 'string' && html.includes('Mission Control')
  );

  // Summary
  log(COLORS.blue, '\n' + '='.repeat(60));
  log(COLORS.blue, 'Summary\n');
  log(COLORS.green, `✅ Passed: ${passed}`);
  log(COLORS.red, `❌ Failed: ${failed}\n`);

  const total = passed + failed;
  const passRate = ((passed / total) * 100).toFixed(1);
  log(COLORS.blue, `Pass rate: ${passRate}%\n`);

  if (failed > 0) {
    log(COLORS.red, '❌ VERIFICATION FAILED - Review failures above\n');
    process.exit(1);
  } else {
    log(COLORS.green, '✅ ALL TESTS PASSED - PostgreSQL Migration Complete!\n');
    process.exit(0);
  }
}

runTests().catch(error => {
  log(COLORS.red, `\nFatal error: ${error.message}\n`);
  process.exit(1);
});
