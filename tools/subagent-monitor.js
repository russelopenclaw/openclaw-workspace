#!/usr/bin/env node
/**
 * Subagent Completion Monitor - v2
 * 
 * Uses OpenClaw's internal sessions API to track completions.
 * Updates PostgreSQL subagents table automatically when subagents complete.
 * 
 * Usage: node subagent-monitor.js [--interval 30]
 * 
 * MIGRATION: 2026-03-05 - Migrated from JSON to PostgreSQL
 */

const { Pool } = require('pg');

const POSTGRES_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'mission_control',
  user: 'alfred',
  password: 'AlfredDB2026Secure'
};

const POLL_INTERVAL_MS = parseInt(process.argv[3]) || 30000;

// Known processed subagents
let knownSubagents = new Set();

/**
 * Load known subagents from PostgreSQL
 */
async function loadKnown() {
  const pool = new Pool(POSTGRES_CONFIG);
  
  try {
    // Load active and recent subagents
    const [activeResult, recentResult] = await Promise.all([
      pool.query('SELECT run_id FROM subagents WHERE status = $1', ['running']),
      pool.query('SELECT run_id FROM subagents WHERE status IN ($1, $2) ORDER BY completed_at DESC LIMIT 20', ['done', 'completed'])
    ]);
    
    [...activeResult.rows, ...recentResult.rows].forEach(row => {
      knownSubagents.add(row.run_id);
    });
    
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] Initialized with ${knownSubagents.size} known subagents from PostgreSQL`);
    
    return knownSubagents.size;
  } catch (error) {
    console.error('Failed to load known subagents:', error.message);
    return 0;
  } finally {
    await pool.end();
  }
}

/**
 * Save subagent status to PostgreSQL
 */
async function saveSubagentStatus(subagentData) {
  const pool = new Pool(POSTGRES_CONFIG);
  
  try {
    const { runId, label, task, status, startedAt, completedAt, runtime, totalTokens } = subagentData;
    
    if (status === 'done' || status === 'completed') {
      // Update existing record to completed
      await pool.query(`
        UPDATE subagents
        SET status = $1,
            completed_at = COALESCE($2, NOW()),
            runtime = $3,
            total_tokens = $4,
            last_updated = NOW()
        WHERE run_id = $5
      `, [status, completedAt, runtime, totalTokens, runId]);
    } else {
      // Insert or update active subagent
      await pool.query(`
        INSERT INTO subagents (run_id, label, task, status, started_at, last_updated)
        VALUES ($1, $2, $3, $4, COALESCE($5, NOW()), NOW())
        ON CONFLICT (run_id) 
        DO UPDATE SET 
          status = EXCLUDED.status,
          task = EXCLUDED.task,
          last_updated = NOW()
      `, [runId, label, task, status, startedAt]);
    }
    
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] Updated subagent ${runId} (${status}) in PostgreSQL`);
    return true;
  } catch (error) {
    console.error('Failed to save subagent status:', error.message);
    return false;
  } finally {
    await pool.end();
  }
}

/**
 * CRITICAL: Use the sessions_list tool to get live subagent data
 * This is called indirectly through the main session
 */
async function checkCompletions() {
  // Note: This is a placeholder - the real implementation uses the sessions_list tool
  // We'll handle this in the main session instead
  console.log('[Subagent Monitor] checkCompletions() should be called from main session with sessions_list output');
  return null;
}

/**
 * Process session data and update PostgreSQL
 */
async function processSessions(activeSessions) {
  const pool = new Pool(POSTGRES_CONFIG);
  const timestamp = new Date().toLocaleTimeString();
  
  try {
    // Get current active subagents from PostgreSQL
    const activeResult = await pool.query(
      'SELECT run_id, label, task, started_at FROM subagents WHERE status = $1',
      ['running']
    );
    
    const activeRunIds = new Set(
      activeSessions
        .filter(s => s.key && s.key.includes('subagent:'))
        .map(s => {
          const match = s.key.match(/subagent:([a-f0-9-]+)/i);
          return match ? match[1] : null;
        })
        .filter(Boolean)
    );
    
    // Find completions (subagents in DB but not in active sessions)
    const completions = [];
    for (const dbSubagent of activeResult.rows) {
      if (!activeRunIds.has(dbSubagent.run_id)) {
        completions.push(dbSubagent);
      }
    }
    
    if (completions.length === 0) {
      console.log(`[${timestamp}] No completions detected`);
      return { completions: [], count: 0 };
    }
    
    console.log(`[${timestamp}] Found ${completions.length} completed subagent(s)`);
    
    // Mark each completion in PostgreSQL
    for (const completion of completions) {
      await pool.query(`
        UPDATE subagents
        SET status = $1,
            completed_at = NOW(),
            runtime = EXTRACT(EPOCH FROM (NOW() - started_at)) / 60 || 'm',
            last_updated = NOW()
        WHERE run_id = $2
      `, ['done', completion.run_id]);
      
      console.log(`[${timestamp}] Marked subagent ${completion.run_id} (${completion.label}) as done`);
    }
    
    return {
      completions: completions.map(c => ({
        runId: c.run_id,
        label: c.label,
        task: c.task
      })),
      count: completions.length
    };
  } catch (error) {
    console.error('Failed to process sessions:', error.message);
    return { completions: [], count: 0, error: error.message };
  } finally {
    await pool.end();
  }
}

// Export for use in main session
module.exports = { 
  loadKnown, 
  saveSubagentStatus,
  processSessions,
  checkCompletions
};

// If run directly, just init and exit (main session handles the polling)
if (require.main === module) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] [Subagent Monitor] Utility module loaded`);
  console.log(`[${timestamp}] [Subagent Monitor] Use in main session:`);
  console.log('  const monitor = require("./tools/subagent-monitor.js");');
  console.log('  await monitor.loadKnown();');
  console.log('  // Then call sessions_list tool and processSessions()');
  
  // Initialize
  loadKnown().catch(console.error);
}
