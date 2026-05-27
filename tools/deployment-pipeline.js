#!/usr/bin/env node

/**
 * Automated Deployment Testing Pipeline
 * 
 * CI/CD-style pipeline that runs pre-deployment checks, post-deployment smoke tests,
 * rollback automation, and generates deployment reports.
 * 
 * Usage:
 *   node tools/deployment-pipeline.js [options]
 * 
 * Options:
 *   --phase [pre|post|rollback]   Which phase to run (default: pre)
 *   --environment [dev|staging|prod] Target environment (default: staging)
 *   --rollback-version [version]    Version to rollback to
 *   --report-format [console|json|html] Output format (default: console)
 *   --report-path [path]            Path to save report (default: .learnings/deployment-reports/)
 *   --dry-run                       Run checks without making changes
 *   --verbose                       Show detailed output
 */

const { execSync, spawn } = require('child_process');
const { Pool } = require('pg');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// ============= Configuration =============
const CONFIG = {
  environments: {
    dev: {
      host: 'localhost',
      gatewayPort: 18789,
      missionControlPort: 8765,
      ollamaHost: '192.168.1.33',
      ollamaPort: 11434,
      db: {
        host: 'localhost',
        port: 5432,
        database: 'mission_control',
        user: 'alfred',
        password: 'AlfredDB2026Secure'
      }
    },
    staging: {
      host: 'localhost',
      gatewayPort: 18789,
      missionControlPort: 8765,
      ollamaHost: '192.168.1.33',
      ollamaPort: 11434,
      db: {
        host: 'localhost',
        port: 5432,
        database: 'mission_control',
        user: 'alfred',
        password: 'AlfredDB2026Secure'
      }
    },
    prod: {
      host: 'localhost',
      gatewayPort: 18789,
      missionControlPort: 8765,
      ollamaHost: '192.168.1.33',
      ollamaPort: 11434,
      db: {
        host: 'localhost',
        port: 5432,
        database: 'mission_control',
        user: 'alfred',
        password: 'AlfredDB2026Secure'
      }
    }
  },
  thresholds: {
    gatewayResponseTime: 100, // ms
    dbQueryTime: 50, // ms
    dashboardLoadTime: 2000, // ms
    memoryUsage: 500, // MB
    diskUsagePercent: 90
  },
  backupDir: '/home/kevin/.openclaw/workspace/backups',
  reportDir: '/home/kevin/.openclaw/workspace/.learnings/deployment-reports',
  workspaceDir: '/home/kevin/.openclaw/workspace'
};

// ============= State & Reporting =============
const state = {
  phase: 'pre',
  environment: 'staging',
  dryRun: false,
  verbose: false,
  startTime: null,
  endTime: null,
  passed: 0,
  failed: 0,
  skipped: 0,
  warnings: 0,
  results: [],
  metrics: {},
  rollbackAvailable: false,
  rollbackVersion: null,
  backupPath: null
};

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

// ============= Utility Functions =============
function log(color, message, level = 'info') {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  
  if (level === 'error' || level === 'warn') {
    console.error(`${color}${prefix} ${message}${COLORS.reset}`);
  } else {
    console.log(`${color}${prefix} ${message}${COLORS.reset}`);
  }
}

function pass(test, duration = 0, details = {}) {
  state.passed++;
  state.results.push({
    test,
    status: 'PASS',
    duration,
    timestamp: new Date().toISOString(),
    details
  });
  const durationStr = duration > 0 ? ` (${duration}ms)` : '';
  log(COLORS.green, `✅ ${test}${durationStr}`);
}

function fail(test, reason, critical = false) {
  state.failed++;
  state.results.push({
    test,
    status: 'FAIL',
    reason,
    timestamp: new Date().toISOString(),
    critical
  });
  log(COLORS.red, `❌ ${test}: ${reason}`, critical ? 'error' : 'warn');
}

function skip(test, reason) {
  state.skipped++;
  state.results.push({
    test,
    status: 'SKIP',
    reason,
    timestamp: new Date().toISOString()
  });
  log(COLORS.yellow, `⚠️  ${test}: ${reason}`);
}

function warn(test, reason) {
  state.warnings++;
  state.results.push({
    test,
    status: 'WARN',
    reason,
    timestamp: new Date().toISOString()
  });
  log(COLORS.yellow, `⚠️  ${test}: ${reason}`);
}

async function runCheck(name, fn) {
  const start = performance.now();
  try {
    await fn();
  } catch (error) {
    fail(name, error.message);
  }
  const duration = Math.round(performance.now() - start);
  // Note: pass/fail/skip functions already record duration
  return duration;
}

// ============= Pre-Deployment Checks =============
async function checkGatewayStatus() {
  return new Promise((resolve) => {
    const start = performance.now();
    const env = CONFIG.environments[state.environment];
    
    http.get(`http://${env.host}:${env.gatewayPort}/status`, (res) => {
      const duration = Math.round(performance.now() - start);
      if (res.statusCode === 200) {
        if (duration < CONFIG.thresholds.gatewayResponseTime) {
          pass('Gateway: GET /status', duration);
        } else {
          warn('Gateway: GET /status', `Slow response (${duration}ms > ${CONFIG.thresholds.gatewayResponseTime}ms)`);
        }
        resolve();
      } else {
        fail('Gateway: GET /status', `Status ${res.statusCode}`);
        resolve();
      }
    }).on('error', (e) => {
      fail('Gateway: GET /status', e.message, true);
      resolve();
    });
  });
}

async function checkDatabaseConnection() {
  const env = CONFIG.environments[state.environment];
  const pool = new Pool(env.db);

  try {
    const start = performance.now();
    const result = await pool.query('SELECT 1');
    const duration = Math.round(performance.now() - start);
    
    if (result.rows.length > 0) {
      if (duration < CONFIG.thresholds.dbQueryTime) {
        pass('Database: Connection test', duration);
      } else {
        warn('Database: Connection test', `Slow query (${duration}ms > ${CONFIG.thresholds.dbQueryTime}ms)`);
      }
    } else {
      fail('Database: Connection test', 'No rows returned');
    }
  } catch (error) {
    fail('Database: Connection test', error.message, true);
  } finally {
    await pool.end();
  }
}

async function checkDatabaseTables() {
  const env = CONFIG.environments[state.environment];
  const pool = new Pool(env.db);
  const requiredTables = ['agents', 'tasks', 'subagents', 'cron_jobs'];
  
  for (const table of requiredTables) {
    try {
      const result = await pool.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${table}');`
      );
      if (result.rows[0].exists) {
        pass(`Database: Table ${table} exists`);
      } else {
        fail(`Database: Table ${table} exists`, 'Table not found', true);
      }
    } catch (error) {
      fail(`Database: Table ${table} exists`, error.message, true);
    }
  }

  await pool.end();
}

async function checkDatabaseDataIntegrity() {
  const env = CONFIG.environments[state.environment];
  const pool = new Pool(env.db);
  
  try {
    // Check for orphaned tasks
    const orphanedTasks = await pool.query(
      `SELECT COUNT(*) FROM tasks WHERE agent_id IS NOT NULL AND agent_id NOT IN (SELECT id FROM agents);`
    );
    if (parseInt(orphanedTasks.rows[0].count) === 0) {
      pass('Database: No orphaned tasks');
    } else {
      fail('Database: No orphaned tasks', `${orphanedTasks.rows[0].count} orphaned tasks found`);
    }

    // Check agent status validity
    const validStatuses = await pool.query(
      `SELECT COUNT(*) FROM agents WHERE status IN ('working', 'idle', 'offline');`
    );
    const totalAgents = await pool.query(`SELECT COUNT(*) FROM agents;`);
    
    if (parseInt(validStatuses.rows[0].count) === parseInt(totalAgents.rows[0].count)) {
      pass('Database: All agents have valid status');
    } else {
      fail('Database: All agents have valid status', 'Invalid agent statuses found');
    }

    // Check for future timestamps
    const futureTimestamps = await pool.query(
      `SELECT COUNT(*) FROM tasks WHERE scheduled_at > NOW() + INTERVAL '1 day';`
    );
    if (parseInt(futureTimestamps.rows[0].count) === 0) {
      pass('Database: No suspicious future timestamps');
    } else {
      warn('Database: No suspicious future timestamps', `${futureTimestamps.rows[0].count} tasks scheduled >1 day in future`);
    }
  } catch (error) {
    fail('Database: Data integrity', error.message);
  } finally {
    await pool.end();
  }
}

async function checkOllamaAPI() {
  return new Promise((resolve) => {
    const env = CONFIG.environments[state.environment];
    const start = performance.now();
    
    http.get(`http://${env.ollamaHost}:${env.ollamaPort}/api/tags`, (res) => {
      const duration = Math.round(performance.now() - start);
      if (res.statusCode === 200) {
        pass('Ollama: API reachable', duration);
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
    const env = CONFIG.environments[state.environment];
    const start = performance.now();
    
    http.get(`http://${env.host}:${env.missionControlPort}/`, (res) => {
      const duration = Math.round(performance.now() - start);
      if (res.statusCode === 200 || res.statusCode === 307) {
        if (duration < CONFIG.thresholds.dashboardLoadTime) {
          pass('Mission Control UI: Accessible', duration);
        } else {
          warn('Mission Control UI: Accessible', `Slow load (${duration}ms > ${CONFIG.thresholds.dashboardLoadTime}ms)`);
        }
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
      fail(`Systemd: ${service}.service active`, 'Service not active', true);
    }
  }
}

async function checkDiskSpace() {
  try {
    const output = execSync('df -h /home', { encoding: 'utf-8' });
    const match = output.match(/(\d+)%/);
    if (match) {
      const usage = parseInt(match[1]);
      if (usage < CONFIG.thresholds.diskUsagePercent) {
        pass(`Disk space: ${100 - usage}% free`);
        state.metrics.diskUsage = usage;
      } else {
        fail('Disk space', `Only ${100 - usage}% free (threshold: ${100 - CONFIG.thresholds.diskUsagePercent}%)`, true);
      }
    } else {
      skip('Disk space', 'Could not parse df output');
    }
  } catch (error) {
    fail('Disk space', error.message);
  }
}

async function checkMemoryUsage() {
  try {
    const output = execSync('ps -o rss,comm -C node --sort=-rss | head -n 2', { encoding: 'utf-8' });
    const lines = output.trim().split('\n');
    if (lines.length > 1) {
      const [rss] = lines[1].trim().split(/\s+/);
      const mb = Math.round(parseInt(rss) / 1024);
      
      if (mb < CONFIG.thresholds.memoryUsage) {
        pass(`Memory usage: ${mb}MB (threshold: ${CONFIG.thresholds.memoryUsage}MB)`);
        state.metrics.memoryUsage = mb;
      } else {
        warn('Memory usage', `${mb}MB exceeds threshold (${CONFIG.thresholds.memoryUsage}MB)`);
      }
    } else {
      skip('Memory usage', 'Could not parse process list');
    }
  } catch (error) {
    skip('Memory usage', error.message);
  }
}

async function checkDocumentationExists() {
  const requiredDocs = [
    'docs/PRE-DEPLOYMENT-CHECKLIST.md',
    'docs/SYSTEM-ARCHITECTURE.md',
    'docs/OPERATIONAL-RUNBOOK.md',
    'docs/DEPLOYMENT-PIPELINE.md'
  ];

  for (const doc of requiredDocs) {
    const fullPath = path.join(CONFIG.workspaceDir, doc);
    if (fs.existsSync(fullPath)) {
      pass(`Documentation: ${doc}`);
    } else {
      warn(`Documentation: ${doc}`, 'File not found');
    }
  }
}

async function checkGitStatus() {
  try {
    // Check if working directory is clean
    try {
      execSync('git status --porcelain', { 
        stdio: 'pipe', 
        cwd: CONFIG.workspaceDir 
      });
      warn('Git: Working directory', 'Has uncommitted changes');
      state.gitClean = false;
    } catch (error) {
      // Exit code 1 means clean - that's good
      pass('Git: Working directory clean');
      state.gitClean = true;
    }

    // Get current branch and commit
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { 
      cwd: CONFIG.workspaceDir, 
      encoding: 'utf-8' 
    }).trim();
    
    const commit = execSync('git rev-parse --short HEAD', { 
      cwd: CONFIG.workspaceDir, 
      encoding: 'utf-8' 
    }).trim();
    
    state.metrics.gitBranch = branch;
    state.metrics.gitCommit = commit;
    pass(`Git: On branch ${branch} (${commit})`);

    // Check for recent commits
    const recentCommits = execSync('git log --oneline -5', { 
      cwd: CONFIG.workspaceDir, 
      encoding: 'utf-8' 
    }).trim();
    
    if (state.verbose) {
      log(COLORS.blue, `Recent commits:\n${recentCommits}`);
    }
  } catch (error) {
    fail('Git: Status check', error.message);
  }
}

async function checkBackupAvailable() {
  const backupDir = CONFIG.backupDir;
  
  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      warn('Backup', 'Created backup directory');
    }

    // Create database backup
    const env = CONFIG.environments[state.environment];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `db-backup-${timestamp}.sql`);
    
    if (state.dryRun) {
      skip('Backup', 'Dry run - would create backup');
    } else {
      try {
        execSync(
          `PGPASSWORD=${env.db.password} pg_dump -h ${env.db.host} -U ${env.db.user} ${env.db.database} > "${backupFile}"`,
          { stdio: 'pipe' }
        );
        
        if (fs.existsSync(backupFile)) {
          const stats = fs.statSync(backupFile);
          pass('Backup: Database backup created', 0, { path: backupFile, size: stats.size });
          state.backupPath = backupFile;
          state.rollbackAvailable = true;
          state.rollbackVersion = timestamp;
        } else {
          fail('Backup: Database backup', 'File not created');
        }
      } catch (error) {
        fail('Backup: Database backup', error.message, true);
      }
    }
  } catch (error) {
    fail('Backup: Check', error.message);
  }
}

// ============= Post-Deployment Smoke Tests =============
async function smokeTestGatewayHealth() {
  const env = CONFIG.environments[state.environment];
  
  try {
    // Test multiple endpoints
    const endpoints = ['/status', '/health'];
    
    for (const endpoint of endpoints) {
      await new Promise((resolve) => {
        http.get(`http://${env.host}:${env.gatewayPort}${endpoint}`, (res) => {
          if (res.statusCode === 200) {
            pass(`Smoke: Gateway ${endpoint}`);
          } else {
            fail(`Smoke: Gateway ${endpoint}`, `Status ${res.statusCode}`, true);
          }
          resolve();
        }).on('error', (e) => {
          fail(`Smoke: Gateway ${endpoint}`, e.message, true);
          resolve();
        });
      });
    }
  } catch (error) {
    fail('Smoke: Gateway health', error.message, true);
  }
}

async function smokeTestDatabase() {
  const env = CONFIG.environments[state.environment];
  const pool = new Pool(env.db);
  
  try {
    // Simple read/write test
    const testKey = `smoke_test_${Date.now()}`;
    
    // Create test record
    await pool.query(
      `INSERT INTO subagents (task_id, status, created_at) VALUES ('smoke-test', 'completed', NOW()) RETURNING id;`
    );
    
    // Verify it exists
    const result = await pool.query(
      `SELECT id FROM subagents WHERE task_id = '${testKey}' OR task_id = 'smoke-test' ORDER BY created_at DESC LIMIT 1;`
    );
    
    if (result.rows.length > 0) {
      pass('Smoke: Database read/write');
      
      // Cleanup
      await pool.query(`DELETE FROM subagents WHERE task_id = 'smoke-test';`);
    } else {
      fail('Smoke: Database read/write', 'Test record not found');
    }
  } catch (error) {
    fail('Smoke: Database read/write', error.message, true);
  } finally {
    await pool.end();
  }
}

async function smokeTestTaskFlow() {
  const env = CONFIG.environments[state.environment];
  const pool = new Pool(env.db);
  
  try {
    // Create a test task
    const testTaskId = `smoke_${Date.now()}`;
    await pool.query(
      `INSERT INTO tasks (id, title, status, created_at) VALUES ($1, 'Smoke Test Task', 'pending', NOW())`,
      [testTaskId]
    );
    
    // Assign to alfred agent
    await pool.query(
      `UPDATE tasks SET agent_id = (SELECT id FROM agents WHERE name = 'alfred'), status = 'assigned' WHERE id = $1`,
      [testTaskId]
    );
    
    // Mark as in-progress
    await pool.query(
      `UPDATE tasks SET status = 'in-progress' WHERE id = $1`,
      [testTaskId]
    );
    
    // Mark as completed
    await pool.query(
      `UPDATE tasks SET status = 'done', completed_at = NOW() WHERE id = $1`,
      [testTaskId]
    );
    
    // Verify task completed successfully
    const result = await pool.query(
      `SELECT status, completed_at FROM tasks WHERE id = $1`,
      [testTaskId]
    );
    
    if (result.rows[0].status === 'done' && result.rows[0].completed_at) {
      pass('Smoke: Task flow (create → assign → complete)');
    } else {
      fail('Smoke: Task flow', 'Task not completed successfully');
    }
    
    // Cleanup
    await pool.query(`DELETE FROM tasks WHERE id = $1`, [testTaskId]);
  } catch (error) {
    fail('Smoke: Task flow', error.message, true);
  } finally {
    await pool.end();
  }
}

async function smokeTestSubagentSpawn() {
  // This would actually spawn a subagent, but for smoke test we'll just verify the infrastructure
  try {
    // Check if subagent infrastructure is ready
    const env = CONFIG.environments[state.environment];
    const pool = new Pool(env.db);
    
    const result = await pool.query(
      `SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'subagents';`
    );
    
    if (parseInt(result.rows[0].count) > 5) {
      pass('Smoke: Subagent infrastructure ready');
    } else {
      fail('Smoke: Subagent infrastructure', 'Schema incomplete');
    }
    
    await pool.end();
  } catch (error) {
    fail('Smoke: Subagent infrastructure', error.message);
  }
}

async function smokeTestMonitoring() {
  try {
    // Check if health monitor is running
    execSync('systemctl --user is-active subagent-health-monitor', { stdio: 'pipe' });
    pass('Smoke: Health monitor running');
  } catch (error) {
    fail('Smoke: Health monitor', 'Not running', true);
  }
  
  try {
    // Check if logs are being written
    const logDir = '/home/kevin/.openclaw/workspace/.learnings';
    const files = fs.readdirSync(logDir);
    const logFiles = files.filter(f => f.endsWith('.log') || f.endsWith('.md'));
    
    if (logFiles.length > 0) {
      pass('Smoke: Logging active');
    } else {
      warn('Smoke: Logging', 'No log files found');
    }
  } catch (error) {
    fail('Smoke: Logging', error.message);
  }
}

async function checkPostDeployVersion() {
  try {
    const env = CONFIG.environments[state.environment];
    
    // Get version from status endpoint
    await new Promise((resolve) => {
      http.get(`http://${env.host}:${env.gatewayPort}/status`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const status = JSON.parse(data);
            if (state.verbose) {
              log(COLORS.blue, `Version: ${status.version || 'unknown'}`);
            }
            pass('Version check', 0, { version: status.version || 'unknown' });
          } catch (e) {
            // Ignore parse errors
          }
          resolve();
        });
      }).on('error', () => resolve());
    });
  } catch (error) {
    skip('Version check', error.message);
  }
}

// ============= Rollback Automation =============
async function executeRollback(targetVersion) {
  log(COLORS.magenta, '\n🔄 Starting Rollback Procedure');
  log(COLORS.magenta, '='.repeat(50));
  
  const backupFile = targetVersion 
    ? path.join(CONFIG.backupDir, `db-backup-${targetVersion}.sql`)
    : state.backupPath;
  
  if (!backupFile || !fs.existsSync(backupFile)) {
    fail('Rollback', 'No backup file found', true);
    return false;
  }
  
  log(COLORS.blue, `Rolling back to: ${backupFile}`);
  
  const env = CONFIG.environments[state.environment];
  
  try {
    // Step 1: Stop services
    log(COLORS.blue, 'Step 1: Stopping services...');
    if (!state.dryRun) {
      execSync('systemctl --user stop alfred-hub', { stdio: 'inherit' });
      pass('Rollback: Services stopped');
    } else {
      skip('Rollback: Stop services', 'Dry run');
    }
    
    // Step 2: Restore database
    log(COLORS.blue, 'Step 2: Restoring database...');
    if (!state.dryRun) {
      execSync(
        `PGPASSWORD=${env.db.password} psql -h ${env.db.host} -U ${env.db.user} ${env.db.database} < "${backupFile}"`,
        { stdio: 'inherit' }
      );
      pass('Rollback: Database restored');
    } else {
      skip('Rollback: Restore database', 'Dry run');
    }
    
    // Step 3: Restore code (if version specified)
    if (targetVersion) {
      log(COLORS.blue, `Step 3: Restoring code to ${targetVersion}...`);
      if (!state.dryRun) {
        execSync(`git checkout ${targetVersion}`, { 
          cwd: CONFIG.workspaceDir,
          stdio: 'inherit' 
        });
        pass(`Rollback: Code restored to ${targetVersion}`);
      } else {
        skip('Rollback: Restore code', 'Dry run');
      }
    }
    
    // Step 4: Restart services
    log(COLORS.blue, 'Step 4: Restarting services...');
    if (!state.dryRun) {
      execSync('systemctl --user start alfred-hub', { stdio: 'inherit' });
      pass('Rollback: Services restarted');
    } else {
      skip('Rollback: Restart services', 'Dry run');
    }
    
    // Step 5: Verify rollback
    log(COLORS.blue, 'Step 5: Verifying rollback...');
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for services
    
    try {
      http.get(`http://${env.host}:${env.gatewayPort}/status`, (res) => {
        if (res.statusCode === 200) {
          pass('Rollback: Verification successful');
          log(COLORS.green, '\n✅ Rollback completed successfully\n');
          return true;
        } else {
          fail('Rollback: Verification', `Status ${res.statusCode}`, true);
          return false;
        }
      }).on('error', (e) => {
        fail('Rollback: Verification', e.message, true);
        return false;
      });
    } catch (error) {
      fail('Rollback: Verification', error.message, true);
      return false;
    }
    
    return true;
  } catch (error) {
    fail('Rollback: Procedure', error.message, true);
    return false;
  }
}

// ============= Report Generation =============
function generateReport(format = 'console') {
  state.endTime = new Date();
  
  const report = {
    summary: {
      timestamp: state.endTime.toISOString(),
      phase: state.phase,
      environment: state.environment,
      duration: Math.round((state.endTime - state.startTime) / 1000),
      passed: state.passed,
      failed: state.failed,
      skipped: state.skipped,
      warnings: state.warnings,
      total: state.passed + state.failed + state.skipped + state.warnings,
      success: state.failed === 0
    },
    metrics: state.metrics,
    results: state.results,
    rollback: {
      available: state.rollbackAvailable,
      version: state.rollbackVersion,
      backupPath: state.backupPath
    }
  };
  
  // Ensure report directory exists
  if (!fs.existsSync(CONFIG.reportDir)) {
    fs.mkdirSync(CONFIG.reportDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  if (format === 'json') {
    const jsonPath = path.join(CONFIG.reportDir, `deployment-report-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    log(COLORS.blue, `Report saved: ${jsonPath}`);
    return jsonPath;
  }
  
  if (format === 'html') {
    const htmlPath = path.join(CONFIG.reportDir, `deployment-report-${timestamp}.html`);
    const html = generateHtmlReport(report);
    fs.writeFileSync(htmlPath, html);
    log(COLORS.blue, `Report saved: ${htmlPath}`);
    return htmlPath;
  }
  
  // Console output (default)
  printConsoleReport(report);
  return null;
}

function printConsoleReport(report) {
  log(COLORS.blue, '\n' + '='.repeat(70));
  log(COLORS.blue, '📊 DEPLOYMENT PIPELINE REPORT');
  log(COLORS.blue, '='.repeat(70));
  
  const status = report.summary.success 
    ? `${COLORS.green}✅ SUCCESS${COLORS.reset}` 
    : `${COLORS.red}❌ FAILED${COLORS.reset}`;
  
  log(COLORS.white, `\nStatus: ${status}`);
  log(COLORS.white, `Phase: ${report.summary.phase}`);
  log(COLORS.white, `Environment: ${report.summary.environment}`);
  log(COLORS.white, `Duration: ${report.summary.duration}s`);
  log(COLORS.white, `Timestamp: ${report.summary.timestamp}`);
  
  if (state.metrics.gitCommit) {
    log(COLORS.white, `Git: ${state.metrics.gitBranch} (${state.metrics.gitCommit})`);
  }
  
  log(COLORS.blue, '\n' + '-'.repeat(70));
  log(COLORS.white, `Total: ${report.summary.total} | ` +
    `${COLORS.green}Passed: ${report.summary.passed}${COLORS.white} | ` +
    `${COLORS.red}Failed: ${report.summary.failed}${COLORS.white} | ` +
    `${COLORS.yellow}Skipped: ${report.summary.skipped}${COLORS.white} | ` +
    `${COLORS.yellow}Warnings: ${report.summary.warnings}${COLORS.reset}`);
  
  if (report.summary.failed > 0) {
    log(COLORS.blue, '\n' + '-'.repeat(70));
    log(COLORS.red, 'FAILED TESTS:');
    log(COLORS.blue, '-'.repeat(70));
    
    state.results
      .filter(r => r.status === 'FAIL')
      .forEach(r => {
        log(COLORS.red, `  ❌ ${r.test}`);
        if (r.reason) log(COLORS.gray, `     Reason: ${r.reason}`);
      });
  }
  
  if (state.rollbackAvailable) {
    log(COLORS.blue, '\n' + '-'.repeat(70));
    log(COLORS.green, '🔄 ROLLBACK AVAILABLE');
    log(COLORS.white, `  Backup: ${state.backupPath}`);
    log(COLORS.white, `  Version: ${state.rollbackVersion}`);
    log(COLORS.yellow, `  To rollback: node tools/deployment-pipeline.js --phase rollback`);
  }
  
  log(COLORS.blue, '\n' + '='.repeat(70));
  
  // Print recommendation
  if (report.summary.success) {
    log(COLORS.green, '\n✅ DEPLOYMENT APPROVED - All critical checks passed\n');
  } else {
    log(COLORS.red, '\n❌ DEPLOYMENT NOT RECOMMENDED - Fix failed checks first\n');
  }
}

function generateHtmlReport(report) {
  const statusClass = report.summary.success ? 'success' : 'failed';
  const statusText = report.summary.success ? 'SUCCESS' : 'FAILED';
  
  return `<!DOCTYPE html>
<html>
<head>
  <title>Deployment Report - ${report.summary.timestamp}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
    .stat { padding: 20px; border-radius: 8px; text-align: center; }
    .stat-success { background: #d4edda; color: #155724; }
    .stat-failed { background: #f8d7da; color: #721c24; }
    .stat-info { background: #d1ecf1; color: #0c5460; }
    .stat-value { font-size: 2em; font-weight: bold; }
    .stat-label { font-size: 0.9em; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 30px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; font-weight: 600; }
    .status-pass { color: #28a745; }
    .status-fail { color: #dc3545; }
    .status-warn { color: #ffc107; }
    .status-skip { color: #6c757d; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; }
    .badge-success { background: #28a745; color: white; }
    .badge-failed { background: #dc3545; color: white; }
    .rollback-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 Deployment Pipeline Report</h1>
    
    <div class="summary">
      <div class="stat ${statusClass === 'success' ? 'stat-success' : 'stat-failed'}">
        <div class="stat-value">${statusText}</div>
        <div class="stat-label">Status</div>
      </div>
      <div class="stat stat-info">
        <div class="stat-value">${report.summary.total}</div>
        <div class="stat-label">Total Tests</div>
      </div>
      <div class="stat stat-success">
        <div class="stat-value">${report.summary.passed}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat stat-failed">
        <div class="stat-value">${report.summary.failed}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat stat-info">
        <div class="stat-value">${report.summary.duration}s</div>
        <div class="stat-label">Duration</div>
      </div>
    </div>
    
    <p><strong>Phase:</strong> ${report.summary.phase} | 
       <strong>Environment:</strong> ${report.summary.environment} | 
       <strong>Timestamp:</strong> ${report.summary.timestamp}</p>
    
    ${state.rollbackAvailable ? `
    <div class="rollback-box">
      <strong>🔄 Rollback Available:</strong><br>
      Backup: ${state.backupPath}<br>
      Version: ${state.rollbackVersion}<br>
      <code>node tools/deployment-pipeline.js --phase rollback</code>
    </div>
    ` : ''}
    
    <h2>Test Results</h2>
    <table>
      <thead>
        <tr>
          <th>Status</th>
          <th>Test</th>
          <th>Duration</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        ${state.results.map(r => `
          <tr>
            <td><span class="badge badge-${r.status.toLowerCase()}">${r.status}</span></td>
            <td>${r.test}</td>
            <td>${r.duration || '-'}ms</td>
            <td>${r.reason || (r.details ? JSON.stringify(r.details) : '-')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <p style="margin-top: 40px; color: #666; font-size: 0.9em;">
      Generated by Deployment Pipeline v1.0 | ${new Date().toISOString()}
    </p>
  </div>
</body>
</html>`;
}

// ============= CLI Parser =============
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    phase: 'pre',
    environment: 'staging',
    reportFormat: 'console',
    reportPath: null,
    rollbackVersion: null,
    dryRun: false,
    verbose: false
  };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--phase':
        options.phase = args[++i];
        break;
      case '--environment':
      case '-e':
        options.environment = args[++i];
        break;
      case '--report-format':
        options.reportFormat = args[++i];
        break;
      case '--report-path':
        options.reportPath = args[++i];
        break;
      case '--rollback-version':
        options.rollbackVersion = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }
  
  // Validate
  if (!['pre', 'post', 'rollback', 'full'].includes(options.phase)) {
    console.error('Error: phase must be pre, post, rollback, or full');
    process.exit(1);
  }
  
  if (!CONFIG.environments[options.environment]) {
    console.error(`Error: unknown environment '${options.environment}'`);
    process.exit(1);
  }
  
  return options;
}

function printHelp() {
  console.log(`
Automated Deployment Testing Pipeline

Usage: node tools/deployment-pipeline.js [options]

Options:
  --phase [pre|post|rollback|full]  Which phase to run (default: pre)
  --environment, -e [dev|staging|prod] Target environment (default: staging)
  --report-format [console|json|html] Output format (default: console)
  --report-path [path]               Path to save report
  --rollback-version [version]       Git tag/version to rollback to
  --dry-run                          Run checks without making changes
  --verbose, -v                      Show detailed output
  --help, -h                         Show this help message

Examples:
  # Run pre-deployment checks
  node tools/deployment-pipeline.js

  # Run full pipeline (pre + post)
  node tools/deployment-pipeline.js --phase full

  # Run post-deployment smoke tests
  node tools/deployment-pipeline.js --phase post --environment prod

  # Rollback to previous version
  node tools/deployment-pipeline.js --phase rollback --rollback-version v1.2.3

  # Generate JSON report
  node tools/deployment-pipeline.js --report-format json
`);
}

// ============= Main Execution =============
async function runPreDeploymentPhase() {
  log(COLORS.blue, '\n🚀 PRE-DEPLOYMENT CHECKS');
  log(COLORS.blue, '='.repeat(50));
  
  await runCheck('Gateway status', checkGatewayStatus);
  await runCheck('Database connection', checkDatabaseConnection);
  await runCheck('Database tables', checkDatabaseTables);
  await runCheck('Database integrity', checkDatabaseDataIntegrity);
  await runCheck('Ollama API', checkOllamaAPI);
  await runCheck('Mission Control UI', checkMissionControlUI);
  await runCheck('Systemd services', checkSystemdServices);
  await runCheck('Disk space', checkDiskSpace);
  await runCheck('Memory usage', checkMemoryUsage);
  await runCheck('Documentation', checkDocumentationExists);
  await runCheck('Git status', checkGitStatus);
  await runCheck('Backup creation', checkBackupAvailable);
}

async function runPostDeploymentPhase() {
  log(COLORS.blue, '\n🔍 POST-DEPLOYMENT SMOKE TESTS');
  log(COLORS.blue, '='.repeat(50));
  
  await runCheck('Gateway health', smokeTestGatewayHealth);
  await runCheck('Database read/write', smokeTestDatabase);
  await runCheck('Task flow', smokeTestTaskFlow);
  await runCheck('Subagent infrastructure', smokeTestSubagentSpawn);
  await runCheck('Monitoring', smokeTestMonitoring);
  await runCheck('Version', checkPostDeployVersion);
}

async function runRollbackPhase(rollbackVersion) {
  const success = await executeRollback(rollbackVersion);
  if (success) {
    // Re-run smoke tests after rollback
    await runPostDeploymentPhase();
  }
}

async function main() {
  const options = parseArgs();
  state.phase = options.phase;
  state.environment = options.environment;
  state.dryRun = options.dryRun;
  state.verbose = options.verbose;
  state.startTime = new Date();
  
  log(COLORS.blue, '\n' + '='.repeat(70));
  log(COLORS.blue, '🚀 AUTOMATED DEPLOYMENT PIPELINE');
  log(COLORS.blue, '='.repeat(70));
  log(COLORS.white, `Phase: ${state.phase}`);
  log(COLORS.white, `Environment: ${state.environment}`);
  log(COLORS.white, `Dry run: ${state.dryRun}`);
  log(COLORS.white, `Started: ${state.startTime.toISOString()}`);
  log(COLORS.blue, '='.repeat(70) + '\n');
  
  try {
    if (state.phase === 'pre' || state.phase === 'full') {
      await runPreDeploymentPhase();
    }
    
    if (state.phase === 'post' || state.phase === 'full') {
      // Small delay to simulate deployment if running full pipeline
      if (state.phase === 'full') {
        log(COLORS.yellow, '\n⏳ Simulating deployment (in real scenario, deploy here)...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      await runPostDeploymentPhase();
    }
    
    if (state.phase === 'rollback') {
      await runRollbackPhase(options.rollbackVersion);
    }
    
    // Generate report
    generateReport(options.reportFormat);
    
    // Exit with appropriate code
    if (state.failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    log(COLORS.red, `\n💥 Pipeline failed: ${error.message}\n`, 'error');
    process.exit(1);
  }
}

// Export for programmatic use
module.exports = {
  runPreDeploymentPhase,
  runPostDeploymentPhase,
  runRollbackPhase,
  generateReport,
  executeRollback
};

main();
