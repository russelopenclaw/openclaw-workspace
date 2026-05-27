#!/usr/bin/env node

/**
 * Pre-Deployment Validation Script
 * 
 * Runs automated checks from the pre-deployment checklist.
 * Usage: node tools/validate-deployment.js
 */

const { execSync } = require('child_process');
const { Pool } = require('pg');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

let passed = 0;
let failed = 0;
let skipped = 0;
const results = [];

function log(color, message) {
  console.log(`${color}${message}${COLORS.reset}`);
}

function pass(test) {
  passed++;
  results.push({ test, status: 'PASS' });
  log(COLORS.green, `✅ ${test}`);
}

function fail(test, reason) {
  failed++;
  results.push({ test, status: 'FAIL', reason });
  log(COLORS.red, `❌ ${test}: ${reason}`);
}

function skip(test, reason) {
  skipped++;
  results.push({ test, status: 'SKIP', reason });
  log(COLORS.yellow, `⚠️  ${test}: ${reason}`);
}

async function runCheck(name, fn) {
  try {
    await fn();
  } catch (error) {
    fail(name, error.message);
  }
}

// API Health Checks
async function checkGatewayStatus() {
  return new Promise((resolve) => {
    http.get('http://localhost:18789/status', (res) => {
      if (res.statusCode === 200) {
        pass('Gateway: GET /status');
        resolve();
      } else {
        fail('Gateway: GET /status', `Status ${res.statusCode}`);
        resolve();
      }
    }).on('error', (e) => {
      fail('Gateway: GET /status', e.message);
      resolve();
    });
  });
}

async function checkDatabaseConnection() {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'mission_control',
    user: 'alfred',
    password: 'AlfredDB2026Secure'
  });

  try {
    const result = await pool.query('SELECT 1');
    if (result.rows.length > 0) {
      pass('Database: Connection test');
    } else {
      fail('Database: Connection test', 'No rows returned');
    }
  } catch (error) {
    fail('Database: Connection test', error.message);
  } finally {
    await pool.end();
  }
}

async function checkDatabaseTables() {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'mission_control',
    user: 'alfred',
    password: 'AlfredDB2026Secure'
  });

  const requiredTables = ['agents', 'tasks', 'subagents'];
  
  for (const table of requiredTables) {
    try {
      const result = await pool.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${table}');`
      );
      if (result.rows[0].exists) {
        pass(`Database: Table ${table} exists`);
      } else {
        fail(`Database: Table ${table} exists`, 'Table not found');
      }
    } catch (error) {
      fail(`Database: Table ${table} exists`, error.message);
    }
  }

  await pool.end();
}

async function checkOllamaAPI() {
  return new Promise((resolve) => {
    http.get('http://192.168.1.33:11434/api/tags', (res) => {
      if (res.statusCode === 200) {
        pass('Ollama: API reachable');
        resolve();
      } else {
        fail('Ollama: API reachable', `Status ${res.statusCode}`);
        resolve();
      }
    }).on('error', (e) => {
      fail('Ollama: API reachable', e.message);
      resolve();
    });
  });
}

async function checkMissionControlUI() {
  return new Promise((resolve) => {
    http.get('http://localhost:8765/', (res) => {
      if (res.statusCode === 200 || res.statusCode === 307) {
        pass('Mission Control UI: Accessible');
        resolve();
      } else {
        fail('Mission Control UI: Accessible', `Status ${res.statusCode}`);
        resolve();
      }
    }).on('error', (e) => {
      fail('Mission Control UI: Accessible', e.message);
      resolve();
    });
  });
}

async function checkSystemdServices() {
  const services = ['alfred-hub', 'subagent-health-monitor'];
  
  for (const service of services) {
    try {
      execSync(`systemctl --user is-active ${service}`, { stdio: 'pipe' });
      pass(`Systemd: ${service}.service active`);
    } catch (error) {
      fail(`Systemd: ${service}.service active`, 'Service not active');
    }
  }
}

async function checkDiskSpace() {
  try {
    const output = execSync('df -h /home', { encoding: 'utf-8' });
    const match = output.match(/(\d+)%/);
    if (match) {
      const usage = parseInt(match[1]);
      if (usage < 90) {
        pass(`Disk space: ${100 - usage}% free`);
      } else {
        fail('Disk space', `Only ${100 - usage}% free (threshold: 10%)`);
      }
    } else {
      skip('Disk space', 'Could not parse df output');
    }
  } catch (error) {
    fail('Disk space', error.message);
  }
}

async function checkDocumentationExists() {
  const requiredDocs = [
    'docs/PRE-DEPLOYMENT-CHECKLIST.md',
    'docs/SYSTEM-ARCHITECTURE.md',
    'docs/OPERATIONAL-RUNBOOK.md'
  ];

  for (const doc of requiredDocs) {
    const fullPath = path.join('/home/kevin/.openclaw/workspace', doc);
    if (fs.existsSync(fullPath)) {
      pass(`Documentation: ${doc}`);
    } else {
      fail(`Documentation: ${doc}`, 'File not found');
    }
  }
}

async function checkNoActiveErrors() {
  const errorsFile = '/home/kevin/.openclaw/workspace/.learnings/ERRORS.md';
  try {
    const content = fs.readFileSync(errorsFile, 'utf-8');
    if (content.includes('*No active errors - all issues resolved!*')) {
      pass('No active errors in ERRORS.md');
    } else {
      log(COLORS.yellow, '⚠️  Active errors found in ERRORS.md - review before deployment');
      skipped++;
      results.push({ test: 'No active errors', status: 'SKIP', reason: 'Active errors present' });
    }
  } catch (error) {
    skip('No active errors', 'Could not read ERRORS.md');
  }
}

async function checkGitClean() {
  try {
    execSync('git status --porcelain', { stdio: 'pipe', cwd: '/home/kevin/.openclaw/workspace' });
    log(COLORS.yellow, '⚠️  Git working directory has uncommitted changes');
    skipped++;
    results.push({ test: 'Git clean', status: 'SKIP', reason: 'Uncommitted changes' });
  } catch (error) {
    // git status --porcelain exits with 0 if there are changes, 1 if clean
    pass('Git: Working directory clean');
  }
}

async function main() {
  log(COLORS.blue, '\n🚀 Pre-Deployment Validation\n');
  log(COLORS.blue, '=' .repeat(50) + '\n');

  // Run all checks
  await runCheck('Gateway status', checkGatewayStatus);
  await runCheck('Database connection', checkDatabaseConnection);
  await runCheck('Database tables', checkDatabaseTables);
  await runCheck('Ollama API', checkOllamaAPI);
  await runCheck('Mission Control UI', checkMissionControlUI);
  await runCheck('Systemd services', checkSystemdServices);
  await runCheck('Disk space', checkDiskSpace);
  await runCheck('Documentation', checkDocumentationExists);
  await runCheck('No active errors', checkNoActiveErrors);
  await runCheck('Git clean', checkGitClean);

  // Summary
  log(COLORS.blue, '\n' + '='.repeat(50));
  log(COLORS.blue, 'Summary\n');
  log(COLORS.green, `✅ Passed: ${passed}`);
  log(COLORS.red, `❌ Failed: ${failed}`);
  log(COLORS.yellow, `⚠️  Skipped: ${skipped}\n`);

  const total = passed + failed + skipped;
  const passRate = ((passed / total) * 100).toFixed(1);
  log(COLORS.blue, `Pass rate: ${passRate}%\n`);

  if (failed > 0) {
    log(COLORS.red, '❌ DEPLOYMENT NOT RECOMMENDED - Fix failed checks first\n');
    process.exit(1);
  } else if (skipped > 0) {
    log(COLORS.yellow, '⚠️  DEPLOYMENT POSSIBLE - Review skipped items\n');
    process.exit(0);
  } else {
    log(COLORS.green, '✅ DEPLOYMENT APPROVED - All checks passed\n');
    process.exit(0);
  }
}

main().catch(error => {
  log(COLORS.red, `\nFatal error: ${error.message}\n`);
  process.exit(1);
});
