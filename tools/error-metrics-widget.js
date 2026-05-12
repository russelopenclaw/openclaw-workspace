#!/usr/bin/env node
/**
 * Error Metrics Widget for Mission Control Dashboard
 * 
 * Displays:
 * - Error counts (active/resolved)
 * - Gateway memory usage
 * - Memory trends
 * - OOM kill history
 * - System health summary
 * 
 * Usage:
 *   node tools/error-metrics-widget.js           # Markdown output
 *   node tools/error-metrics-widget.js --json    # JSON for API
 *   node tools/error-metrics-widget.js --cleanup # Archive old errors & refresh header
 *   node tools/error-metrics-widget.js --dedupe   # Merge duplicate errors
 *   node tools/error-metrics-widget.js --quick    # Lightweight JSON for heartbeat
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE = '/home/kevin/.openclaw/workspace';
const LEARNINGS_DIR = path.join(WORKSPACE, '.learnings');
const ERRORS_FILE = path.join(LEARNINGS_DIR, 'ERRORS.md');
const MEMORY_LOG = path.join(LEARNINGS_DIR, 'MEMORY-MONITOR.log');
const MEMORY_STATE = path.join(LEARNINGS_DIR, 'memory-monitor-state.json');

/**
 * Parse error counts from ERRORS.md
 */
function getErrorCounts() {
  try {
    if (!fs.existsSync(ERRORS_FILE)) {
      return { active: 0, resolved: 0, activeList: [], resolvedList: [] };
    }
    
    const content = fs.readFileSync(ERRORS_FILE, 'utf8');
    const lines = content.split('\n');
    
    const activeErrors = [];
    const resolvedErrors = [];
    let inActiveSection = false;
    let inResolvedSection = false;
    const errorIdPattern = /^\s*#+\s*\[ERR-\d{8}-\d{3}\]\s*(.+)/;
    
    for (const line of lines) {
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
      if (line.match(/^##\s+Error Format/i) || line.match(/^##\s+_/)) {
        inActiveSection = false;
        inResolvedSection = false;
        continue;
      }
      
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
    
    return {
      active: activeErrors.length,
      resolved: resolvedErrors.length,
      activeList: activeErrors,
      resolvedList: resolvedErrors
    };
  } catch (e) {
    return { active: 0, resolved: 0, activeList: [], resolvedList: [] };
  }
}

/**
 * Get gateway memory info
 */
function getGatewayMemory() {
  try {
    const pidOutput = execSync('systemctl --user show openclaw-gateway.service --value MainPID', {
      encoding: 'utf8',
      timeout: 5000
    }).trim();
    
    if (!pidOutput || pidOutput === '0') {
      return { pid: null, memoryMB: null, status: 'not_running' };
    }
    
    const pid = parseInt(pidOutput);
    const memOutput = execSync(`ps -o rss= -p ${pid} 2>&1`, {
      encoding: 'utf8',
      timeout: 5000
    }).trim();
    
    if (!memOutput) {
      return { pid, memoryMB: null, status: 'unknown' };
    }
    
    const memoryMB = Math.floor(parseInt(memOutput) / 1024);
    let status = 'healthy';
    if (memoryMB >= 900) status = 'critical';
    else if (memoryMB >= 800) status = 'warning';
    
    return { pid, memoryMB, status };
  } catch (e) {
    return { pid: null, memoryMB: null, status: 'error', error: e.message };
  }
}

/**
 * Get memory monitor state
 */
function getMemoryState() {
  try {
    if (fs.existsSync(MEMORY_STATE)) {
      return JSON.parse(fs.readFileSync(MEMORY_STATE, 'utf8'));
    }
  } catch (e) {}
  
  return { peakMB: 0, restartCount24h: 0, lastRestart: null };
}

/**
 * Check for recent OOM kills
 */
function getOOMHistory() {
  try {
    const output = execSync(
      'journalctl --user -u openclaw-gateway.service --since "7 days ago" --no-pager 2>&1 | grep -i "oom-kill" | wc -l',
      { encoding: 'utf8', timeout: 10000 }
    ).trim();
    
    const count = parseInt(output) || 0;
    
    // Get last OOM timestamp
    let lastOOM = null;
    if (count > 0) {
      const lastOutput = execSync(
        'journalctl --user -u openclaw-gateway.service --since "7 days ago" --no-pager | grep -i "oom-kill" | tail -1',
        { encoding: 'utf8', timeout: 10000 }
      ).trim();
      if (lastOutput) {
        lastOOM = lastOutput.split(' ')[0] + ' ' + lastOutput.split(' ')[1];
      }
    }
    
    return { count, lastOOM };
  } catch (e) {
    return { count: 0, lastOOM: null };
  }
}

/**
 * Get memory trend from log (last 24h)
 */
function getMemoryTrend() {
  try {
    if (!fs.existsSync(MEMORY_LOG)) {
      return { avgMB: null, minMB: null, maxMB: null, samples: 0 };
    }
    
    const content = fs.readFileSync(MEMORY_LOG, 'utf8');
    const lines = content.split('\n').filter(l => l.includes('Memory:'));
    
    if (lines.length === 0) {
      return { avgMB: null, minMB: null, maxMB: null, samples: 0 };
    }
    
    const memories = [];
    for (const line of lines) {
      const match = line.match(/Memory:\s*(\d+)MB/);
      if (match) {
        memories.push(parseInt(match[1]));
      }
    }
    
    if (memories.length === 0) {
      return { avgMB: null, minMB: null, maxMB: null, samples: 0 };
    }
    
    return {
      avgMB: Math.floor(memories.reduce((a, b) => a + b, 0) / memories.length),
      minMB: Math.min(...memories),
      maxMB: Math.max(...memories),
      samples: memories.length
    };
  } catch (e) {
    return { avgMB: null, minMB: null, maxMB: null, samples: 0 };
  }
}

/**
 * Generate markdown report
 */
function generateMarkdown() {
  const errors = getErrorCounts();
  const memory = getGatewayMemory();
  const memState = getMemoryState();
  const oomHistory = getOOMHistory();
  const trend = getMemoryTrend();
  
  const now = new Date().toISOString();
  
  // Status badge
  let statusBadge = '🟢';
  let statusText = 'Healthy';
  
  if (errors.active > 0) {
    statusBadge = '🟡';
    statusText = 'Minor Issues';
  }
  if (memory.status === 'critical' || oomHistory.count > 2) {
    statusBadge = '🔴';
    statusText = 'Needs Attention';
  }
  if (errors.active > 0 && memory.status === 'critical') {
    statusBadge = '🔴';
    statusText = 'Critical';
  }
  
  let md = `## ${statusBadge} Error & Memory Status ${statusText}\n\n`;
  
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Errors | ${errors.active + errors.resolved} |\n`;
  md += `| Active | ${errors.active} |\n`;
  md += `| Resolved | ${errors.resolved} |\n`;
  md += `| Gateway Memory | ${memory.memoryMB ? memory.memoryMB + 'MB' : 'N/A'} |\n`;
  md += `| Memory Peak (24h) | ${memState.peakMB}MB |\n`;
  md += `| Restarts (24h) | ${memState.restartCount24h} |\n`;
  md += `| OOM Kills (7d) | ${oomHistory.count} |\n\n`;
  
  // Memory trend
  if (trend.avgMB !== null) {
    md += `### Memory Trend (24h)\n\n`;
    md += `- **Average**: ${trend.avgMB}MB\n`;
    md += `- **Min**: ${trend.minMB}MB\n`;
    md += `- **Max**: ${trend.maxMB}MB\n`;
    md += `- **Samples**: ${trend.samples}\n\n`;
    
    // Visual bar
    const barWidth = 40;
    const minBar = Math.floor((trend.minMB / 1000) * barWidth);
    const avgBar = Math.floor((trend.avgMB / 1000) * barWidth);
    const maxBar = Math.floor((trend.maxMB / 1000) * barWidth);
    
    md += `\`\`\`\n`;
    md += `Min: [${'█'.repeat(Math.max(1, minBar))}${'░'.repeat(barWidth - Math.max(1, minBar))}] ${trend.minMB}MB\n`;
    md += `Avg: [${'█'.repeat(Math.max(1, avgBar))}${'░'.repeat(barWidth - Math.max(1, avgBar))}] ${trend.avgMB}MB\n`;
    md += `Max: [${'█'.repeat(Math.max(1, maxBar))}${'░'.repeat(barWidth - Math.max(1, maxBar))}] ${trend.maxMB}MB\n`;
    md += `     0MB                              800MB (warn)        1000MB (limit)\n`;
    md += `\`\`\`\n\n`;
  }
  
  // Recently resolved
  if (errors.resolvedList.length > 0) {
    md += `### Recently Resolved\n\n`;
    for (const err of errors.resolvedList.slice(0, 5)) {
      md += `- ~~${err}~~\n`;
    }
    md += '\n';
  }
  
  // Active errors
  if (errors.activeList.length > 0) {
    md += `### ⚠️ Active Issues\n\n`;
    for (const err of errors.activeList) {
      md += `- **${err}**\n`;
    }
    md += '\n';
  }
  
  // OOM history
  if (oomHistory.count > 0) {
    md += `### OOM Kill History\n\n`;
    md += `- **Total (7 days)**: ${oomHistory.count}\n`;
    if (oomHistory.lastOOM) {
      md += `- **Last occurrence**: ${oomHistory.lastOOM}\n`;
    }
    md += '\n';
  }
  
  md += `_Last checked: ${now}_\n`;
  
  return md;
}

/**
 * Generate JSON output
 */
function generateJSON() {
  const errors = getErrorCounts();
  const memory = getGatewayMemory();
  const memState = getMemoryState();
  const oomHistory = getOOMHistory();
  const trend = getMemoryTrend();
  
  let status = 'healthy';
  if (errors.active > 0) status = 'warning';
  if (memory.status === 'critical' || oomHistory.count > 2) status = 'critical';
  
  return {
    status,
    generated: new Date().toISOString(),
    errors: {
      total: errors.active + errors.resolved,
      active: errors.active,
      resolved: errors.resolved,
      activeList: errors.activeList,
      resolvedList: errors.resolvedList
    },
    memory: {
      current: memory.memoryMB,
      status: memory.status,
      pid: memory.pid,
      peak24h: memState.peakMB,
      avg24h: trend.avgMB,
      min24h: trend.minMB,
      max24h: trend.maxMB
    },
    restarts: {
      count24h: memState.restartCount24h,
      lastRestart: memState.lastRestart
    },
    oomKills: {
      count7d: oomHistory.count,
      lastOccurrence: oomHistory.lastOOM
    }
  };
}

/**
 * Refresh the status header in ERRORS.md to match actual counts
 */
function refreshHeader() {
  if (!fs.existsSync(ERRORS_FILE)) return false;
  
  const content = fs.readFileSync(ERRORS_FILE, 'utf8');
  const counts = getErrorCounts();
  
  const statusIcon = counts.active > 0 ? '⚠️' : '✅';
  const statusText = counts.active > 0 ? 'Issues Active' : 'All resolved';
  const newHeader = `> **System Status**: ${statusIcon} ${statusText} | 📊 Total: ${counts.resolved} resolved, ${counts.active} active`;
  
  const headerPattern = /> \*\*System Status\*\*: .+\| 📊 Total: .+/;
  const updated = content.replace(headerPattern, newHeader);
  
  if (updated !== content) {
    fs.writeFileSync(ERRORS_FILE, updated);
    return true;
  }
  return false;
}

/**
 * Run deduplication of repeated errors
 */
function runDedupe() {
  console.log('Running error deduplication...\n');
  
  const { dedupeErrors } = require('./auto-cleanup-errors.js');
  const result = dedupeErrors();
  
  if (result.merged === 0) {
    console.log('No duplicates found. Error log is clean!');
  } else {
    console.log(`\nMerged ${result.merged} duplicate(s):`);
    for (const merge of result.details) {
      console.log(`  - Kept [ERR-${merge.keptId}], merged [ERR-${merge.mergedId}]: ${merge.summary}`);
    }
  }
  
  // Refresh header after dedupe
  refreshHeader();
  
  console.log('\n✅ Deduplication complete!');
}

/**
 * Generate quick JSON for heartbeat consumption
 */
function generateQuick() {
  const counts = getErrorCounts();
  
  // Find last cleanup time from archive log
  let lastCleanup = null;
  try {
    const archiveContent = fs.readFileSync(ERRORS_ARCHIVED, 'utf8');
    const match = archiveContent.match(/Archived:\s*(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/g);
    if (match && match.length > 0) {
      const last = match[match.length - 1].replace('Archived: ', '');
      lastCleanup = new Date(last).toISOString();
    }
  } catch (e) {}
  
  return {
    active: counts.active,
    resolved: counts.resolved,
    lastCleanup
  };
}

/**
 * Run auto-cleanup (archive old errors, refresh header)
 */
function runCleanup() {
  console.log('Running error log cleanup...\n');
  
  const { cleanupErrors } = require('./auto-cleanup-errors.js');
  cleanupErrors();
  
  // Refresh header counts after cleanup
  const refreshed = refreshHeader();
  if (refreshed) {
    console.log('\n📊 Header counts refreshed');
  }
  
  // Regenerate and return results after cleanup
  console.log('\n🔄 Regenerating metrics after cleanup...\n');
  console.log(generateMarkdown());
}

// Main
const args = process.argv.slice(2);

if (args.includes('--json')) {
  console.log(JSON.stringify(generateJSON(), null, 2));
} else if (args.includes('--cleanup')) {
  runCleanup();
} else if (args.includes('--dedupe')) {
  runDedupe();
} else if (args.includes('--quick')) {
  console.log(JSON.stringify(generateQuick()));
} else {
  console.log(generateMarkdown());
}

module.exports = { 
  generateMarkdown, 
  generateJSON, 
  getErrorCounts, 
  getGatewayMemory,
  runCleanup,
  runDedupe,
  generateQuick,
  refreshHeader
};
