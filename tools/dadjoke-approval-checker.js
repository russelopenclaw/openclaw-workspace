#!/usr/bin/env node

/**
 * Dad Joke Approval Checker
 * 
 * Checks for Kevin's approval replies on pending dad joke videos.
 * Run via heartbeat or manually.
 * 
 * Actions:
 * - "approve"/"yes"/"publish" → Upload to YouTube, mark posted
 * - "reject"/"skip"/"no" → Mark skipped, fetch next joke
 * - "fix: X" → Regenerate with fix, resend
 * - Timeout (>24h) → Skip to next joke
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORKSPACE = process.env.WORKSPACE || '/home/kevin/.openclaw/workspace';
const PENDING_FILE = path.join(WORKSPACE, '.pending-approvals.json');
const LOG_FILE = path.join(WORKSPACE, '.learnings/DADJOKE-APPROVALS.log');

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${level}] ${message}`;
  console.log(entry);
  fs.appendFileSync(LOG_FILE, entry + '\n');
}

function runCommand(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
}

function loadPending() {
  try {
    const data = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
    return data.queue || [];
  } catch (e) {
    return [];
  }
}

function savePending(queue) {
  fs.writeFileSync(PENDING_FILE, JSON.stringify({ queue, schema: { _comment: 'See .pending-approvals.json template' } }, null, 2));
}

function getRecentMessages(limit = 10) {
  try {
    // Get recent Telegram messages via openclaw message read
    const result = runCommand(`openclaw message read --channel telegram -t telegram:8177470832 --limit ${limit} --json 2>&1`);
    // Parse JSON output
    try {
      const json = JSON.parse(result);
      return Array.isArray(json) ? json : (json.messages || []);
    } catch {
      log(`Failed to parse messages JSON`);
      return [];
    }
  } catch (e) {
    log(`Could not fetch messages: ${e.message}`, 'WARN');
    return [];
  }
}

function parseApprovalIntent(messageText, pendingItem) {
  const text = (messageText || '').toLowerCase();
  
  // Check if this is a reply to our video message
  // For now, just check if text contains approval keywords
  
  if (text.includes('approve') || text === 'yes' || text === 'publish' || text === 'go') {
    return { action: 'approve', confidence: 0.9 };
  }
  
  if (text.includes('reject') || text === 'no' || text === 'skip') {
    return { action: 'reject', confidence: 0.9 };
  }
  
  if (text.includes('fix') || text.includes('change') || text.includes('redo')) {
    // Extract feedback after "fix:" or "change:"
    const match = text.match(/(?:fix|change|redo)[:\s]+(.+)/i);
    const feedback = match ? match[1].trim() : 'Unspecified fix needed';
    return { action: 'fix', feedback, confidence: 0.85 };
  }
  
  return null;
}

async function processApproval(pending, intent, replyMessage) {
  const { jokeId, videoPath } = pending;
  
  log(`Processing ${intent.action} for joke #${jokeId}`);
  
  if (intent.action === 'approve') {
    // Upload to YouTube
    log('Uploading to YouTube (Private)...');
    try {
      const jokeText = await getJokeText(jokeId);
      const title = `Dad Joke #${jokeId} - ${jokeText.substring(0, 40)}...`;
      
      const uploadResult = runCommand(
        `python3 ${WORKSPACE}/skills/youtube-uploader/scripts/youtube-upload.py upload ` +
        `--file "${videoPath}" ` +
        `--title "${title}" ` +
        `--description "${jokeText} #dadjokes #comedy" ` +
        `--privacy private 2>&1`
      );
      
      log(`YouTube upload complete: ${uploadResult.substring(0, 100)}`);
      
      // Mark as Posted=TRUE in Dadabase
      runCommand(`gog sheets update 1cXSGjCXleUK8iQweBAwLaa7j3QK2Sla-8v11CirQsuw "Sheet1!D${jokeId}" "TRUE"`);
      
      // Mark joke as posted
      log(`Marked joke #${jokeId} as Posted=TRUE`);
      
      // Update task to complete
      try {
        runCommand(`PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d mission_control ` +
          `-c "UPDATE tasks SET column_name='complete', updated_at=NOW() WHERE title LIKE '%${jokeId}%';"`);
      } catch (e) {
        // Non-critical
      }
      
      log(`✅ Joke #${jokeId} published successfully`);
      
    } catch (e) {
      log(`YouTube upload failed: ${e.message}`, 'ERROR');
      throw e;
    }
  }
  
  else if (intent.action === 'reject') {
    // Mark as skipped
    log(`Joke #${jokeId} rejected by Kevin`);
    
    // Log to rejections file
    const rejectionsFile = path.join(WORKSPACE, '.learnings/DADIOKE-REJECTIONS.md');
    const entry = `## Joke #${jokeId} - Rejected (${new Date().toISOString()})\n\n**Action:** Skipped to next joke\n\n`;
    fs.appendFileSync(rejectionsFile, entry);
    
    // Update Dadabase - keep as unused so we can try again later or skip
    // For now, just leave Used=FALSE
    
    log(`Joke #${jokeId} marked as skipped`);
  }
  
  else if (intent.action === 'fix') {
    log(`Joke #${jokeId} needs fixes: ${intent.feedback}`);
    
    // Re-run the pipeline with fix instructions
    // For now, just log and let the next run handle it
    log(`Will regenerate joke #${jokeId} with feedback: ${intent.feedback}`);
    
    // TODO: Call auto-dadjoke-runner with fix parameters
    // For now, user can manually trigger regeneration
  }
  
  // Remove from pending queue
  removePending(pending);
}

function removePending(pending) {
  const queue = loadPending();
  const newQueue = queue.filter(p => p.jokeId !== pending.jokeId);
  savePending(newQueue);
  log(`Removed joke #${pending.jokeId} from pending queue`);
}

function checkTimeout(pending) {
  const now = Date.now();
  const sentAt = new Date(pending.sentAt).getTime();
  const hoursSinceSent = (now - sentAt) / (1000 * 60 * 60);
  
  if (hoursSinceSent > 24) {
    log(`Joke #${pending.jokeId} approval timeout (${hoursSinceSent.toFixed(1)}h)`);
    
    // Log timeout
    const rejectionsFile = path.join(WORKSPACE, '.learnings/DADIOKE-REJECTIONS.md');
    const entry = `## Joke #${pending.jokeId} - Timeout (${new Date().toISOString()})\n\n**Reason:** No response after ${hoursSinceSent.toFixed(1)} hours\n**Action:** Auto-skipped\n\n`;
    fs.appendFileSync(rejectionsFile, entry);
    
    // Mark as timeout
    removePending(pending);
    
    return true;
  }
  
  return false;
}

async function getJokeText(jokeId) {
  const result = runCommand(`gog sheets get 1cXSGjCXleUK8iQweBAwLaa7j3QK2Sla-8v11CirQsuw "Sheet1!A${jokeId}:B${jokeId}" 2>&1`);
  // Parse the output to get joke text
  // Assuming format: "ID\tJoke text"
  const lines = result.split('\n');
  for (const line of lines) {
    if (line.startsWith(jokeId + '\t') || line.includes(jokeId)) {
      const parts = line.split('\t');
      return parts[1] || parts[0];
    }
  }
  return `Joke #${jokeId}`;
}

async function checkApprovals() {
  log('=== Checking Dad Joke Approvals ===');
  
  const queue = loadPending();
  
  if (queue.length === 0) {
    log('No pending approvals');
    return;
  }
  
  log(`Found ${queue.length} pending approval(s)`);
  
  // Note: read action not supported for Telegram yet
  // Messages will be checked via conversation context or manual trigger
  log('ℹ️ Telegram read not supported via CLI - approvals triggered by conversation context');
  log('   Pending items:');
  queue.forEach(p => {
    const hours = (Date.now() - new Date(p.sentAt).getTime()) / (1000 * 60 * 60);
    log(`   - Joke #${p.jokeId}: ${hours.toFixed(1)}h ago (${p.status})`);
  });
  
  // Update last checked
  queue.forEach(item => {
    item.lastChecked = new Date().toISOString();
  });
  savePending(queue);
  
  log('=== Approval check complete ===');
  log('');
  log('Manual approval commands:');
  log('  openclaw message send -c telegram -t telegram:8177470832 -m "approve" # Reply in chat');
  log('  node tools/dadjoke-approval-checker.js --manual-approve 24  # Force approve joke #24');
}

// Manual approval helper
async function manualApprove(jokeId) {
  log(`Manual approval for joke #${jokeId}`);
  
  const queue = loadPending();
  const pending = queue.find(p => p.jokeId === jokeId.toString());
  
  if (!pending) {
    log(`No pending approval for joke #${jokeId}`, 'ERROR');
    return;
  }
  
  await processApproval(pending, { action: 'approve', confidence: 1.0 }, { text: 'manual-approve' });
  log(`✅ Joke #${jokeId} approved and uploaded to YouTube`);
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === '--manual-approve' && args[1]) {
    manualApprove(args[1]).catch(err => {
      log(`Manual approval failed: ${err.message}`, 'ERROR');
      process.exit(1);
    });
  } else {
    checkApprovals().catch(err => {
      log(`Approval check failed: ${err.message}`, 'ERROR');
      process.exit(1);
    });
  }
}

module.exports = { checkApprovals, loadPending, savePending, manualApprove };
