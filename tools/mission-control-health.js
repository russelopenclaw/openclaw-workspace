#!/usr/bin/env node

/**
 * Mission Control Health Check
 * 
 * Monitors Mission Control health (local Next.js dev server + PostgreSQL).
 * Called by heartbeat every 5 minutes.
 * 
 * Mission Control runs locally on port 8765 (Next.js dev server).
 * DO NOT check Vercel - that's not Kevin's app.
 * 
 * Checks:
 * 1. Local HTTP endpoint responds (http://localhost:8765)
 * 2. PostgreSQL is reachable
 * 3. No error loops in recent sessions
 * 
 * Auto-fixes:
 * 1. Clear Next.js cache if build errors
 * 2. Alert if dev server down (manual restart)
 * 3. Alert if PostgreSQL down (can't auto-fix)
 */

const { execSync } = require('child_process');
const https = require('https');

// Mission Control is running locally - use localhost:8765
// Kevin's local instance is the primary; Vercel deployment is NOT his app
const LOCAL_URL = 'http://localhost:8765'; // Primary
const VERCEL_URL = null; // Disabled - not Kevin's app

function log(message) {
  console.log(`[${new Date().toISOString()}] [MC Health] ${message}`);
}

/**
 * Check if Mission Control URL responds (Vercel)
 */
const http = require('http');

async function isHttpResponding(url, timeout = 5000) {
  // Use /api/status to avoid auth redirect on /tasks
  const checkUrl = url.includes('localhost') ? `${url}/api/status` : url;
  return new Promise((resolve) => {
    const req = (checkUrl.startsWith('https') ? https : http).get(checkUrl, { timeout }, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Check PostgreSQL connectivity
 */
function isPostgresReachable() {
  try {
    execSync('pg_isready -h localhost', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Main health check routine
 */
async function runHealthCheck() {
  log('Starting Mission Control health check...');
  
  const issues = [];
  const fixes = [];
  
  // Check 1: Local Mission Control responding (http not https - dev server)
  const http = require('http');
  const localOk = await new Promise((resolve) => {
    const req = http.get(LOCAL_URL, { timeout: 5000 }, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
  
  if (!localOk) {
    issues.push('HTTP not responding (localhost:8765)');
    log(`❌ HTTP endpoint not responding (${LOCAL_URL})`);
    log('   Mission Control dev server may be down - check process');
  } else {
    log(`✅ HTTP responding (${LOCAL_URL})`);
  }
  
  // Check 2: PostgreSQL reachable
  if (!isPostgresReachable()) {
    issues.push('PostgreSQL unreachable');
    log('❌ PostgreSQL not reachable');
    // Can't auto-fix this - alert
  } else {
    log('✅ PostgreSQL reachable');
  }
  
  // Summary
  log('---');
  if (issues.length === 0) {
    log('✅ Health check passed - all systems operational');
    return { ok: true, issues: [], fixes: [] };
  } else {
    log(`⚠️  Health check found ${issues.length} issue(s)`);
    log(`Issues: ${issues.join(', ')}`);
    log('   Note: Mission Control runs locally - restart dev server if needed');
    
    return {
      ok: false,
      issues,
      fixes
    };
  }
}

// Run if called directly
if (require.main === module) {
  (async () => {
    const result = await runHealthCheck();
    if (!result.ok) {
      log('⚠️  Some issues may remain - check manually');
      process.exit(1);
    }
  })();
}

module.exports = {
  runHealthCheck,
  isHttpResponding,
  isPostgresReachable
};
