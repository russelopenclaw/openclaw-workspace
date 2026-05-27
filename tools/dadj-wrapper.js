#!/usr/bin/env node
/**
 * Dad Joke Daily Task Wrapper
 * Creates task, runs pipeline, updates state
 * Image validation: Qwen 3.5 Vision checks background (no text)
 * Regenerates on failure (max 3 retries)
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WS = '/home/kevin/.openclaw/workspace';
const SS = '1cXSGjCXleUK8iQweBAwLaa7j3QK2Sla-8v11CirQsuw';

function sh(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', cwd: WS }); }
  catch (e) { return ''; }
}

function log(msg) {
  console.log('[' + new Date().toISOString() + '] ' + msg);
}

// Get next unused joke ID
function getNextJokeId() {
  try {
    const data = sh('gog sheets get ' + SS + ' "Sheet1!A10:D50"');
    for (const row of data.trim().split('\n')) {
      if (row.includes('FALSE')) {
        const m = row.match(/^([0-9]+)/);
        if (m) return m[1];
      }
    }
  }
  catch (e) { log('Fetch failed: ' + e.message); }
  return 'unknown';
}

const jokeId = getNextJokeId();
log('=== Dad Joke Task Wrapper ===');
log('Joke #' + jokeId);

// Create task with Qwen 3.5 validation requirements
const title = 'Dad Joke #' + jokeId + ' Video';
const deliv = 'Video MP4 rendered, uploaded to MinIO, Dadabase Used=TRUE, approval sent';
const crit = [
  'Video renders without errors',
  'Text displays correctly (Georgia serif font)',
  'Audio padded with 1s start/end buffers',
  'Background image validated by Qwen 3.5 Vision: no text, colorful cartoon, clean for overlay',
  'Image regeneration on validation failure (max 3 retries)',
  'Video validated by Qwen 3.5 Vision: text matches joke, rendered correctly',
  'All assets uploaded to MinIO: hp1/dadj/' + jokeId + '/',
  'Dadbabase row C' + (parseInt(jokeId) + 1) + ' marked Used=TRUE',
  'Approval message sent to telegram:8177470832 with video attached',
];

let cmd = 'node tools/create-task.js ' + JSON.stringify(title) + ' ' + JSON.stringify(deliv);
crit.forEach(c => { cmd += ' --criteria ' + JSON.stringify(c); });
cmd += ' --agent DadJ' + ' --desc "Daily automated with Qwen 3.5 validation"';

log('Creating task...');
const out = sh(cmd);
log(out.trim().split('\n')[0]);

// Run pipeline
log('Running pipeline...');
sh('node tools/auto-dadj');
log('Pipeline done');

log('=== Complete ===');
