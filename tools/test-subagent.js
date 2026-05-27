#!/usr/bin/env node
/**
 * Test Subagent for Health Monitoring
 * 
 * This subagent simulates a long-running task.
 * Use it to test the health monitoring system.
 * 
 * Usage: 
 *   node tools/test-subagent.js --duration 300  # Run for 5 minutes
 *   node tools/test-subagent.js --crash         # Crash after 30 seconds
 */

const { execSync } = require('child_process');

function log(message) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[${timestamp}] ${message}`);
}

const args = process.argv.slice(2);
const shouldCrash = args.includes('--crash');
const durationArg = args.find(a => a.startsWith('--duration='));
const duration = durationArg ? parseInt(durationArg.split('=')[1]) : (shouldCrash ? 30 : 300);

log(`=== Test Subagent Started ===`);
log(`Duration: ${duration}s`);
log(`Mode: ${shouldCrash ? 'CRASH TEST' : 'NORMAL'}`);
log('');

log('Performing mock task...');
let elapsed = 0;
const interval = 10; // Log every 10 seconds

const timer = setInterval(() => {
  elapsed += interval;
  log(`Progress: ${elapsed}/${duration}s (${Math.round(elapsed/duration*100)}%)`);
  
  if (shouldCrash && elapsed >= 30) {
    log('💥 CRASH TEST: Simulating unexpected termination...');
    process.exit(1);
  }
  
  if (elapsed >= duration) {
    log('✅ Task completed successfully!');
    clearInterval(timer);
    process.exit(0);
  }
}, interval * 1000);

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('Received SIGINT, shutting down gracefully...');
  clearInterval(timer);
  process.exit(0);
});
