#!/usr/bin/env node
/**
 * Process Subagent Respawn Queue
 * 
 * Called by main agent to process pending respawn requests.
 * This bridges the gap between the monitoring daemon (which may not have spawn permissions)
 * and the main agent (which does).
 * 
 * Usage: node tools/process-respawn-queue.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const QUEUE_FILE = path.join(__dirname, '../.learnings/SUBAGENT-RESPAWN-QUEUE.json');
const LOG_FILE = path.join(__dirname, '../.learnings/SUBAGENT-HEALTH.log');

function log(message, level = 'info') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const line = `[${timestamp}] [RESPAWN] [${level.toUpperCase()}] ${message}\n`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch (e) {
    // Ignore log write errors
  }
}

async function processQueue() {
  if (!fs.existsSync(QUEUE_FILE)) {
    log('No respawn queue found - all clear');
    return { processed: 0 };
  }
  
  let queue;
  try {
    queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  } catch (error) {
    log(`Failed to parse respawn queue: ${error.message}`, 'error');
    // Corrupt file, remove it
    try { fs.unlinkSync(QUEUE_FILE); } catch (e) {}
    return { processed: 0, error: error.message };
  }
  
  if (queue.length === 0) {
    log('Respawn queue is empty');
    fs.unlinkSync(QUEUE_FILE);
    return { processed: 0 };
  }
  
  log(`Processing respawn queue: ${queue.length} item(s)`);
  
  const results = {
    processed: 0,
    failed: 0,
    remaining: []
  };
  
  for (const item of queue) {
    try {
      log(`Respawning: ${item.label || 'Untitled subagent'}`);
      log(`  Task: ${item.task.substring(0, 100)}...`);
      
      // Spawn via openclaw command
      const taskEscaped = item.task.replace(/"/g, '\\"');
      const labelEscaped = (item.label || 'Respawned subagent').replace(/"/g, '\\"');
      const cmd = `openclaw subagents spawn --task "${taskEscaped}" --label "${labelEscaped}"`;
      
      const output = execSync(cmd, { encoding: 'utf8', timeout: 15000 });
      log(`✅ Spawned: ${output.trim()}`);
      results.processed++;
      
    } catch (error) {
      log(`❌ Failed to respawn ${item.label}: ${error.message}`, 'error');
      
      // Retry logic - only retry up to 3 times
      const attempts = item.attempts || 1;
      if (attempts < 3) {
        log(`  Will retry (attempt ${attempts + 1}/3)`);
        item.attempts = attempts + 1;
        results.remaining.push(item);
      } else {
        log(`  Max retries reached - manual intervention required`, 'error');
        results.failed++;
      }
    }
  }
  
  // Write remaining items back to queue
  if (results.remaining.length > 0) {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(results.remaining, null, 2));
    log(`Remaining in queue: ${results.remaining.length}`);
  } else {
    try { fs.unlinkSync(QUEUE_FILE); } catch (e) {}
    log('Queue cleared');
  }
  
  log(`Summary: ${results.processed} processed, ${results.failed} failed, ${results.remaining.length} retrying`);
  
  return results;
}

// Run if called directly
if (require.main === module) {
  processQueue()
    .then(results => {
      console.log('\n=== Respawn Queue Processing Complete ===');
      console.log(`Processed: ${results.processed}`);
      console.log(`Failed: ${results.failed}`);
      console.log(`Retrying: ${results.remaining.length}`);
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { processQueue };
