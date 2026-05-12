#!/usr/bin/env node
/**
 * gog Auth Monitor
 * 
 * Detects Google OAuth auth failures for gog service
 * Auto-recovers when possible, alerts when manual intervention needed
 * 
 * Usage:
 *   node tools/gog-auth-monitor.js
 * 
 * Integration: Called by heartbeat-runner.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '../.learnings/gog-auth-state.json');
const MAX_CONSECUTIVE_FAILURES = 2;

/**
 * Load auth state from file
 */
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[gog-auth] Failed to load state:', e.message);
  }
  
  return {
    consecutiveFailures: 0,
    lastSuccess: null,
    lastFailure: null,
    lastCheck: null,
    recovered: false
  };
}

/**
 * Save auth state to file
 */
function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error('[gog-auth] Failed to save state:', e.message);
  }
}

/**
 * Test gog auth by running a simple command
 */
function testGogAuth() {
  try {
    // Try to read from Dadabase sheet - lightweight auth check
    // Uses the known sheet ID from TOOLS.md
    const DADABASE_ID = '1cXSGjCXleUK8iQweBAwLaa7j3QK2Sla-8v11CirQsuw';
    execSync(`gog sheets get ${DADABASE_ID} "A1"`, { 
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { ok: true, error: null };
  } catch (e) {
    const stderr = e.stderr || '';
    const isAuthError = stderr.toLowerCase().includes('auth') || 
                        stderr.toLowerCase().includes('token') ||
                        stderr.toLowerCase().includes('unauthorized') ||
                        stderr.toLowerCase().includes('oauth') ||
                        stderr.toLowerCase().includes('credential');
    
    return { 
      ok: false, 
      error: stderr.trim(),
      isAuthError
    };
  }
}

/**
 * Attempt auto-recovery via gog auth refresh
 */
function attemptRecovery() {
  console.log('[gog-auth] Attempting auto-recovery...');
  
  try {
    // Try to refresh auth
    execSync('gog auth --refresh', {
      encoding: 'utf8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Verify recovery worked
    const testResult = testGogAuth();
    if (testResult.ok) {
      console.log('[gog-auth] ✅ Auto-recovery successful');
      return { success: true, message: 'Auto-recovery successful' };
    } else {
      console.log('[gog-auth] ⚠️ Auto-recovery failed, manual intervention needed');
      return { 
        success: false, 
        message: 'Auto-recovery failed',
        manualCommand: 'gog auth --reauth'
      };
    }
  } catch (e) {
    console.log('[gog-auth] ⚠️ Auto-recovery failed:', e.message);
    return { 
      success: false, 
      message: 'Auto-recovery failed: ' + e.message,
      manualCommand: 'gog auth --reauth'
    };
  }
}

/**
 * Main monitoring function
 */
async function monitor() {
  const state = loadState();
  const testResult = testGogAuth();
  
  state.lastCheck = new Date().toISOString();
  
  if (testResult.ok) {
    // Success - reset counters
    console.log('[gog-auth] ✅ Auth check passed');
    state.consecutiveFailures = 0;
    state.lastSuccess = state.lastCheck;
    state.recovered = false;
    saveState(state);
    
    return {
      status: 'ok',
      consecutiveFailures: 0,
      action: null
    };
  }
  
  // Failure
  console.log('[gog-auth] ❌ Auth check failed:', testResult.error);
  state.consecutiveFailures++;
  state.lastFailure = state.lastCheck;
  
  // Check if we should attempt recovery
  if (state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && !state.recovered) {
    console.log(`[gog-auth] ⚠️ ${state.consecutiveFailures} consecutive failures, attempting recovery...`);
    
    const recovery = attemptRecovery();
    state.recovered = true;
    saveState(state);
    
    if (recovery.success) {
      return {
        status: 'recovered',
        consecutiveFailures: 0,
        action: 'auto-recovered'
      };
    } else {
      return {
        status: 'failed',
        consecutiveFailures: state.consecutiveFailures,
        action: 'manual-intervention-required',
        manualCommand: recovery.manualCommand,
        error: recovery.message
      };
    }
  }
  
  saveState(state);
  
  return {
    status: 'failing',
    consecutiveFailures: state.consecutiveFailures,
    action: state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES ? 'recovery-needed' : 'monitoring',
    error: testResult.error
  };
}

/**
 * Get human-readable status message
 */
function getStatusMessage(result) {
  switch (result.status) {
    case 'ok':
      return '✅ gog auth healthy';
    case 'recovered':
      return '✅ gog auth auto-recovered';
    case 'failed':
      return `⚠️ gog auth failed (${result.consecutiveFailures}x) - Run: ${result.manualCommand}`;
    case 'failing':
      return `⚠️ gog auth degrading (${result.consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES} failures)`;
    default:
      return '❓ gog auth unknown status';
  }
}

// CLI mode
if (require.main === module) {
  monitor().then(result => {
    console.log('\n📊 Status:', getStatusMessage(result));
    console.log('📝 Full result:', JSON.stringify(result, null, 2));
    
    if (result.status === 'failed' && result.manualCommand) {
      console.log('\n🔧 Manual fix:');
      console.log(`   ${result.manualCommand}`);
    }
  });
}

module.exports = {
  monitor,
  testGogAuth,
  loadState,
  saveState,
  getStatusMessage,
  MAX_CONSECUTIVE_FAILURES
};
