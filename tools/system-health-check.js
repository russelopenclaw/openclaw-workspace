/**
 * System Health Check
 * 
 * Monitors infrastructure health:
 * - Ollama API reachable
 * - Gateway running
 * - Gateway memory usage (<800MB)
 * - Disk space >10%
 * - Check for error patterns in .learnings/ERRORS.md
 * 
 * Call from heartbeat every 30 minutes.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE = '/home/kevin/.openclaw/workspace';
const LEARNINGS_DIR = path.join(WORKSPACE, '.learnings');
const ERRORS_FILE = path.join(LEARNINGS_DIR, 'ERRORS.md');

/**
 * Check if Ollama API is reachable
 */
function checkOllama() {
  try {
    execSync('curl -s http://msi:11434/api/tags', { encoding: 'utf8', timeout: 5000 });
    return { ok: true, message: 'Ollama API reachable' };
  } catch (error) {
    return { ok: false, message: `Ollama API unreachable: ${error.message}` };
  }
}

/**
 * Check if OpenClaw gateway is running
 */
function checkGateway() {
  try {
    const output = execSync('openclaw gateway status', { encoding: 'utf8', timeout: 5000 });
    const isRunning = output.includes('running') || output.includes('active');
    return { 
      ok: isRunning, 
      message: isRunning ? 'Gateway running' : 'Gateway not running' 
    };
  } catch (error) {
    return { ok: false, message: `Gateway check failed: ${error.message}` };
  }
}

/**
 * Check gateway memory usage via systemctl
 */
function checkGatewayMemory() {
  try {
    // Get gateway PID
    const pidOutput = execSync('systemctl --user show openclaw-gateway.service --value MainPID', {
      encoding: 'utf8',
      timeout: 5000
    }).trim();
    
    if (!pidOutput || pidOutput === '0') {
      return {
        ok: false,
        message: 'Gateway not running',
        details: { memoryMB: null, pid: null }
      };
    }
    
    const pid = parseInt(pidOutput);
    
    // Get RSS memory in KB
    const memOutput = execSync(`ps -o rss= -p ${pid}`, {
      encoding: 'utf8',
      timeout: 5000
    }).trim();
    
    if (!memOutput) {
      return {
        ok: false,
        message: 'Could not read gateway memory',
        details: { memoryMB: null, pid }
      };
    }
    
    const memoryKB = parseInt(memOutput);
    const memoryMB = Math.floor(memoryKB / 1024);
    
    // Threshold: 800MB warning, 900MB critical
    const warning = memoryMB >= 800;
    const critical = memoryMB >= 900;
    
    return {
      ok: !critical,
      message: `Gateway memory: ${memoryMB}MB${critical ? ' (CRITICAL)' : warning ? ' (WARNING)' : ''}`,
      details: { memoryMB, pid, warning, critical }
    };
  } catch (error) {
    return { 
      ok: true, // Don't fail health check if we can't read memory
      message: `Memory check unavailable: ${error.message}`,
      details: { memoryMB: null, error: error.message }
    };
  }
}

/**
 * Check disk space
 */
function checkDiskSpace() {
  try {
    const output = execSync('df -h / | tail -1', { encoding: 'utf8' });
    const parts = output.trim().split(/\s+/);
    const usePercent = parseInt(parts[4].replace('%', ''));
    const available = 100 - usePercent;
    
    return {
      ok: available > 10,
      message: `Disk space: ${available}% free (${usePercent}% used)`,
      details: { available, used: usePercent }
    };
  } catch (error) {
    return { ok: false, message: `Disk check failed: ${error.message}` };
  }
}

/**
 * Check for error patterns in .learnings/ERRORS.md
 * 
 * Only counts actual error entries (ERR-YYYYMMDD-XXX format), not section headers or templates.
 * Separate counts for active vs resolved errors.
 */
function checkErrorPatterns() {
  try {
    if (!fs.existsSync(ERRORS_FILE)) {
      return { 
        ok: true, 
        message: 'No errors logged', 
        activeCount: 0,
        resolvedCount: 0,
        patterns: [] 
      };
    }
    
    const content = fs.readFileSync(ERRORS_FILE, 'utf8');
    const lines = content.split('\n');
    
    // Only match actual error IDs in format [ERR-YYYYMMDD-XXX]
    const errorIdPattern = /^\s*#+\s*\[ERR-\d{8}-\d{3}\]\s*(.+)/;
    
    // Track active vs resolved errors
    const activeErrors = [];
    const resolvedErrors = [];
    
    let inActiveSection = false;
    let inResolvedSection = false;
    
    for (const line of lines) {
      // Detect section headers
      if (line.match(/^##\s+Active Errors/i)) {
        inActiveSection = true;
        inResolvedSection = false;
        continue;
      }
      if (line.match(/^##\s+Resolved Errors/i)) {
        inResolvedSection = true;
        inActiveSection = false;
        continue;
      }
      // Reset on other major sections
      if (line.match(/^##\s+Error Format/i) || line.match(/^##\s+_/)) {
        inActiveSection = false;
        inResolvedSection = false;
        continue;
      }
      
      // Match error entries
      const match = line.match(errorIdPattern);
      if (match) {
        const errorName = match[1].trim();
        if (inActiveSection) {
          activeErrors.push(errorName);
        } else if (inResolvedSection) {
          resolvedErrors.push(errorName);
        }
      }
    }
    
    const totalErrors = activeErrors.length + resolvedErrors.length;
    const hasActiveErrors = activeErrors.length > 0;
    
    // Generate detailed message
    let message = `${totalErrors} error(s) logged`;
    if (resolvedErrors.length > 0) {
      message += ` (${resolvedErrors.length} resolved`;
      if (activeErrors.length > 0) {
        message += `, ${activeErrors.length} active`;
      }
      message += ')';
    }
    
    // OK if no active errors and total history <= 10
    return {
      ok: !hasActiveErrors && totalErrors <= 10,
      message,
      activeCount: activeErrors.length,
      resolvedCount: resolvedErrors.length,
      activeErrors,
      resolvedErrors,
      patterns: [...activeErrors, ...resolvedErrors].slice(0, 10)
    };
  } catch (error) {
    return { 
      ok: true, 
      message: `Error pattern check skipped: ${error.message}`,
      activeCount: 0,
      resolvedCount: 0,
      patterns: []
    };
  }
}

/**
 * Get error trends and metrics
 */
function getErrorMetrics() {
  try {
    const result = checkErrorPatterns();
    
    // Calculate trend (simplified - could be enhanced with historical data)
    const metrics = {
      active: result.activeCount,
      resolved: result.resolvedCount,
      total: result.activeCount + result.resolvedCount,
      hasActiveErrors: result.activeCount > 0,
      status: result.activeCount === 0 ? 'healthy' : 'needs_attention',
      lastChecked: new Date().toISOString()
    };
    
    // Status badge
    if (metrics.active === 0 && metrics.total === 0) {
      metrics.badge = '🟢 Clean';
    } else if (metrics.active === 0) {
      metrics.badge = '✅ All Resolved';
    } else if (metrics.active <= 3) {
      metrics.badge = '⚠️ Minor Issues';
    } else {
      metrics.badge = '🔴 Needs Attention';
    }
    
    return metrics;
  } catch (error) {
    return {
      active: 0,
      resolved: 0,
      total: 0,
      hasActiveErrors: false,
      status: 'unknown',
      badge: '❓ Unknown',
      lastChecked: new Date().toISOString()
    };
  }
}

/**
 * Run all health checks
 */
async function runHealthCheck() {
  const checks = {
    ollama: checkOllama(),
    gateway: checkGateway(),
    gatewayMemory: checkGatewayMemory(),
    disk: checkDiskSpace(),
    errors: checkErrorPatterns()
  };
  
  const allOk = Object.values(checks).every(c => c.ok);
  
  // Generate summary message
  const summary = Object.entries(checks)
    .map(([name, result]) => `${result.ok ? '✅' : '❌'} ${name}: ${result.message}`)
    .join('\n');
  
  return {
    ok: allOk,
    checks,
    summary: `System Health Check:\n${summary}`,
    metrics: getErrorMetrics()
  };
}

/**
 * Auto-cleanup old resolved errors (older than 30 days)
 * Archives them to a separate file for historical reference
 */
function cleanupResolvedErrors() {
  try {
    if (!fs.existsSync(ERRORS_FILE)) {
      return { cleaned: 0, message: 'No errors file to clean' };
    }
    
    const content = fs.readFileSync(ERRORS_FILE, 'utf8');
    const lines = content.split('\n');
    
    // Find resolved errors older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const errorsToArchive = [];
    let currentError = null;
    let currentDate = null;
    
    let inResolvedSection = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.match(/^##\s+Resolved Errors/i)) {
        inResolvedSection = true;
        continue;
      }
      if (line.match(/^##\s+Active Errors/i) || line.match(/^##\s+Error Format/i)) {
        inResolvedSection = false;
      }
      
      if (inResolvedSection) {
        const errorMatch = line.match(/^###\s*\[ERR-(\d{4})(\d{2})(\d{2})-\d{3}\]/);
        if (errorMatch) {
          // Save previous error if exists
          if (currentError && currentDate) {
            const errorDate = new Date(`${currentDate}T00:00:00Z`);
            if (errorDate < thirtyDaysAgo) {
              errorsToArchive.push(currentError);
            }
          }
          currentError = { header: line, lines: [line] };
          currentDate = `${errorMatch[1]}-${errorMatch[2]}-${errorMatch[3]}`;
        } else if (currentError) {
          if (line.match(/^###\s*\[/) || line.match(/^##\s+/)) {
            // New error or new section, save current
            if (currentDate) {
              const errorDate = new Date(`${currentDate}T00:00:00Z`);
              if (errorDate < thirtyDaysAgo) {
                errorsToArchive.push(currentError);
              }
            }
            currentError = line.match(/^###\s*\[/) ? { header: line, lines: [line] } : null;
            currentDate = null;
          } else {
            currentError.lines.push(line);
          }
        }
      }
    }
    
    // Check the last error
    if (currentError && currentDate && inResolvedSection) {
      const errorDate = new Date(`${currentDate}T00:00:00Z`);
      if (errorDate < thirtyDaysAgo) {
        errorsToArchive.push(currentError);
      }
    }
    
    if (errorsToArchive.length === 0) {
      return { cleaned: 0, message: 'No old resolved errors to archive' };
    }
    
    // Archive old errors
    const archivePath = path.join(LEARNINGS_DIR, 'ERRORS-ARCHIVED.md');
    const archiveContent = `# Archived Errors\n\nThese errors were resolved more than 30 days ago and archived for historical reference.\n\nLast archived: ${new Date().toISOString()}\n\n` + 
      errorsToArchive.map(e => e.lines.join('\n')).join('\n\n') + '\n';
    
    // Append to archive file
    if (fs.existsSync(archivePath)) {
      fs.appendFileSync(archivePath, '\n---\n\n' + errorsToArchive.map(e => e.lines.join('\n')).join('\n\n') + '\n');
    } else {
      fs.writeFileSync(archivePath, archiveContent);
    }
    
    // Remove archived errors from main file
    const activeContent = lines.filter(line => {
      return !errorsToArchive.some(e => e.lines.includes(line));
    }).join('\n');
    
    fs.writeFileSync(ERRORS_FILE, activeContent);
    
    return { cleaned: errorsToArchive.length, message: `Archived ${errorsToArchive.length} old resolved error(s)` };
  } catch (error) {
    return { cleaned: 0, message: `Cleanup failed: ${error.message}` };
  }
}

/**
 * Auto-fix common issues
 */
async function autoFix(issue) {
  console.log(`Attempting auto-fix for: ${issue}`);
  
  // Gateway not running → restart
  if (issue.includes('Gateway')) {
    try {
      execSync('openclaw gateway restart', { timeout: 30000 });
      return { fixed: true, message: 'Gateway restarted successfully' };
    } catch (error) {
      return { fixed: false, message: `Failed to restart gateway: ${error.message}` };
    }
  }
  
  // Ollama unreachable → check if it's a network issue
  if (issue.includes('Ollama')) {
    try {
      execSync('ping -c 1 msi', { timeout: 5000 });
      return { 
        fixed: false, 
        message: 'Ollama server appears down, network is OK. Manual intervention needed.' 
      };
    } catch (pingError) {
      return {
        fixed: false,
        message: 'Network connectivity issue to Ollama server. Check router/ethernet.'
      };
    }
  }
  
  return { fixed: false, message: 'No auto-fix available for this issue' };
}

module.exports = {
  runHealthCheck,
  checkOllama,
  checkGateway,
  checkGatewayMemory,
  checkDiskSpace,
  checkErrorPatterns,
  cleanupResolvedErrors,
  getErrorMetrics,
  autoFix
};

// Self-test
if (require.main === module) {
  (async () => {
    console.log('Running system health check...\n');
    const result = await runHealthCheck();
    console.log(result.summary);
    
    if (!result.ok) {
      console.log('\n❌ Issues detected, attempting auto-fix...\n');
      for (const [name, check] of Object.entries(result.checks)) {
        if (!check.ok) {
          const fix = await autoFix(check.message);
          console.log(`${name}: ${fix.message}`);
        }
      }
    }
  })();
}
