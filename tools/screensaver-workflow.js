#!/usr/bin/env node
/**
 * Screensaver Prompt Workflow Manager
 * 
 * Manages the one-at-a-time workflow for generating screensaver videos:
 * 1. Pick next pending prompt
 * 2. Generate image (Stable Diffusion)
 * 3. Validate image (Qwen vision)
 * 4. Mark complete or retry
 * 
 * Usage:
 *   const workflow = require('./tools/screensaver-workflow.js');
 *   await workflow.processNextPrompt();
 */

const { execSync } = require('child_process');

const DB_CMD = 'PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d mission_control';

/**
 * Get next pending prompt
 */
function getNextPending() {
  try {
    const result = execSync(
      `${DB_CMD} -t -A -F '|' -c "SELECT id, video_number, video_title, prompt_number, model, prompt_text FROM screensaver_prompts WHERE status = 'pending' ORDER BY video_number, prompt_number LIMIT 1;"`,
      { encoding: 'utf8', stdio: 'pipe' }
    );
    
    const line = result.trim();
    if (!line) return null;
    
    const [id, videoNumber, videoTitle, promptNumber, model, promptText] = line.split('|');
    
    return {
      id,
      videoNumber: parseInt(videoNumber),
      videoTitle,
      promptNumber: parseInt(promptNumber),
      model,
      promptText
    };
  } catch (e) {
    console.error('Error fetching next pending:', e.message);
    return null;
  }
}

/**
 * Update prompt status
 */
function updateStatus(id, status, extraFields = {}) {
  const fields = Object.entries(extraFields).map(([k, v]) => `${k} = '${String(v).replace(/'/g, "''")}'`).join(', ');
  const sql = `UPDATE screensaver_prompts SET status = '${status}', updated_at = NOW()${fields ? ', ' + fields : ''} WHERE id = '${id}'`;
  
  try {
    execSync(`${DB_CMD} -c "${sql}"`, { stdio: 'pipe' });
    return true;
  } catch (e) {
    console.error('Error updating status:', e.message);
    return false;
  }
}

/**
 * Get progress dashboard
 */
function getDashboard() {
  try {
    const result = execSync(
      `${DB_CMD} -t -A -F '|' -c "SELECT video_number, video_title, status, COUNT(*) as count FROM screensaver_prompts GROUP BY video_number, video_title, status ORDER BY video_number, status;"`,
      { encoding: 'utf8' }
    );
    
    const lines = result.trim().split('\n').filter(l => l.trim());
    const dashboard = {};
    
    for (const line of lines) {
      const [videoNumber, videoTitle, status, count] = line.split('|');
      if (!dashboard[videoTitle]) {
        dashboard[videoTitle] = { total: 0, pending: 0, generating: 0, validating: 0, complete: 0, failed: 0 };
      }
      dashboard[videoTitle][status] = parseInt(count);
      dashboard[videoTitle].total += parseInt(count);
    }
    
    return dashboard;
  } catch (e) {
    console.error('Error fetching dashboard:', e.message);
    return null;
  }
}

/**
 * Retry all failed prompts
 */
function retryFailed() {
  try {
    const result = execSync(
      `${DB_CMD} -c "UPDATE screensaver_prompts SET status = 'pending' WHERE status = 'failed';"`,
      { stdio: 'pipe' }
    );
    console.log('✅ Retrying failed prompts');
    return true;
  } catch (e) {
    console.error('Error retrying failed:', e.message);
    return false;
  }
}

/**
 * Process next prompt (main workflow)
 */
async function processNextPrompt(options = {}) {
  const { 
    effect = 'auto', 
    duration = 24, 
    sampler = 'DPM++ 2M Karras', 
    steps = 30,
    audio = null,
    audioVolume = 0.5
  } = options;
  
  const prompt = getNextPending();
  
  if (!prompt) {
    console.log('✅ No pending prompts - all done!');
    return { done: true };
  }
  
  console.log(`🎬 Processing: ${prompt.videoTitle} (Prompt #${prompt.promptNumber})`);
  console.log(`   Model: ${prompt.model}`);
  console.log(`   ID: ${prompt.id}`);
  console.log(`   Effect: ${effect}`);
  console.log(`   Sampler: ${sampler} (${steps} steps)`);
  
  // Step 1: Mark as generating
  updateStatus(prompt.id, 'generating', { 
    effect_type: effect === 'auto' ? 'zoom_in' : effect,
    effect_duration: duration,
    sampler,
    steps
  });
  console.log('   Status: generating');
  
  // Step 2: Generate image (call SD skill)
  // This would integrate with your existing SD pipeline
  console.log('   → Generate image with Stable Diffusion...');
  // Placeholder: integrate with skills/stable-diffusion/SKILL.md
  
  // Step 3: Validate image (call Qwen vision)
  // updateStatus(prompt.id, 'validating', { image_path: '/path/to/image.png' });
  // console.log('   Status: validating');
  
  // Step 4: Generate video with effect
  // const effects = require('./screensaver-effects.js');
  // await effects.generateVideo({ input: imagePath, output: videoPath, effect, duration, audio, audioVolume });
  
  // Step 5: Mark complete or failed
  // updateStatus(prompt.id, 'complete', { 
  //   completed_at: new Date().toISOString(),
  //   video_path: videoPath 
  // });
  // OR: updateStatus(prompt.id, 'failed', { validation_result: 'Text detected in image' });
  
  return { done: false, prompt };
}

/**
 * Print dashboard
 */
function printDashboard() {
  const dashboard = getDashboard();
  
  if (!dashboard) return;
  
  console.log('\n📊 Screensaver Progress Dashboard\n');
  console.log('Video'.padEnd(35) + 'Total  Pending  Generating  Validating  Complete  Failed');
  console.log('─'.repeat(80));
  
  for (const [title, stats] of Object.entries(dashboard)) {
    console.log(
      title.padEnd(35) +
      String(stats.total).padStart(5) +
      String(stats.pending).padStart(7) +
      String(stats.generating || 0).padStart(10) +
      String(stats.validating || 0).padStart(11) +
      String(stats.complete).padStart(8) +
      String(stats.failed || 0).padStart(7)
    );
  }
  
  console.log('─'.repeat(80));
  
  const totals = Object.values(dashboard).reduce((acc, stats) => {
    acc.total += stats.total;
    acc.pending += stats.pending;
    acc.complete += stats.complete;
    acc.failed = (acc.failed || 0) + (stats.failed || 0);
    return acc;
  }, { total: 0, pending: 0, complete: 0, failed: 0 });
  
  console.log(
    'TOTAL'.padEnd(35) +
    String(totals.total).padStart(5) +
    String(totals.pending).padStart(7) +
    String(totals.complete).padStart(21) +
    String(totals.failed).padStart(7)
  );
  
  const percent = ((totals.complete / totals.total) * 100).toFixed(1);
  console.log(`\nProgress: ${totals.complete}/${totals.total} (${percent}%)`);
}

// CLI mode
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--dashboard') || args.includes('-d')) {
    printDashboard();
  } else if (args.includes('--retry')) {
    retryFailed();
    printDashboard();
  } else if (args.includes('--next')) {
    processNextPrompt();
  } else {
    console.log('Usage: node tools/screensaver-workflow.js [options]');
    console.log('  --dashboard, -d  Show progress dashboard');
    console.log('  --next           Process next pending prompt');
    console.log('  --retry          Retry all failed prompts');
    console.log('');
    printDashboard();
  }
}

module.exports = {
  getNextPending,
  updateStatus,
  getDashboard,
  printDashboard,
  retryFailed,
  processNextPrompt
};
