#!/usr/bin/env node

/**
 * Auto Dad Joke Generator - Daily 6 AM Pipeline
 * 
 * Flow (AUTO-UPLOAD to YouTube Private):
 * 1. Fetch next unused joke from Dadabase (Google Sheets)
 * 2. Classify joke structure (one-liner vs setup-punchline)
 * 3. Generate background image via n8n webhook (Stable Diffusion)
 * 4. Generate audio via n8n webhook (ElevenLabs TTS)
 * 5. Render video (Remotion)
 * 6. Upload all assets to MinIO (dadjokes bucket)
 * 7. Upload to YouTube as Private
 * 8. Send Telegram notification with video link
 * 9. Mark Used=TRUE and Posted=TRUE in Dadabase
 * 
 * Regeneration Flow:
 * - When regenerating, upload new version and delete previous YouTube video
 * - Track all versions in dadjokes-registry.json
 */

const { execSync } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(require('child_process').exec);
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  scheduleTime: '06:00', // 6 AM America/Chicago
  spreadsheetId: '1cXSGjCXleUK8iQweBAwLaa7j3QK2Sla-8v11CirQsuw',
  minioBucket: 'dadjokes',
  minioAlias: 'hp1',
  maxRevisions: 3,
  voice: 'warm male', // ElevenLabs default
  videoTool: 'remotion',
  youtubePrivacy: 'private', // Always upload as private
};

const WORKSPACE = process.env.WORKSPACE || '/home/kevin/.openclaw/workspace';
const LOG_FILE = path.join(WORKSPACE, '.learnings/DADJOKE-AUTO.log');
const ISSUES_FILE = path.join(WORKSPACE, '.learnings/DADJOKE-ISSUES.log');
const REGISTRY_FILE = path.join(WORKSPACE, 'dadjokes-registry.json');
const YOUTUBE_SCRIPT = path.join(WORKSPACE, 'skills/youtube-uploader/scripts/youtube-upload.py');

// Utilities
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${level}] ${message}`;
  console.log(entry);
  fs.appendFileSync(LOG_FILE, entry + '\n');
}

function logIssue(component, error, context = {}) {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    component,
    error: error.message || error,
    context,
    retryable: context.retryable !== false,
  };
  fs.appendFileSync(ISSUES_FILE, JSON.stringify(entry) + '\n');
  log(`ISSUE [${component}]: ${error.message || error}`, 'ERROR');
}

// Retry with exponential backoff
async function retry(fn, options = {}) {
  const { maxAttempts = 3, baseTimeout = 60000, component = 'unknown', onRetry = () => {} } = options;
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const timeout = baseTimeout + (attempt - 1) * 30000; // 60s, 90s, 120s
    try {
      log(`Attempt ${attempt}/${maxAttempts} for ${component} (timeout: ${timeout/1000}s)`);
      return await fn(attempt, timeout);
    } catch (e) {
      lastError = e;
      log(`Attempt ${attempt} failed: ${e.message}`, 'WARN');
      if (attempt < maxAttempts) {
        onRetry(attempt, e);
        await new Promise(r => setTimeout(r, 5000)); // 5s between retries
      }
    }
  }
  
  logIssue(component, lastError, { attempts: maxAttempts });
  throw lastError;
}

function runCommand(cmd, options = {}) {
  try {
    return execSync(cmd, { encoding: 'utf-8', ...options });
  } catch (error) {
    log(`Command failed: ${cmd}\n${error.message}`, 'ERROR');
    throw error;
  }
}

function uploadToMinIO(localPath, minioPath) {
  const minioCmd = `mc cp "${localPath}" ${CONFIG.minioAlias}/${CONFIG.minioBucket}/${minioPath}`;
  runCommand(minioCmd);
  log(`Uploaded to MinIO: ${minioPath}`);
}

// Registry management for tracking YouTube video IDs
function loadRegistry() {
  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
    }
  } catch (e) {
    log(`Registry load error: ${e.message}`, 'WARN');
  }
  return { jokes: {} };
}

function saveRegistry(registry) {
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));
  log(`Registry saved: ${Object.keys(registry.jokes).length} jokes tracked`);
}

function getJolkInfo(registry, jokeId) {
  return registry.jokes[jokeId] || null;
}

function setJokeInfo(registry, jokeId, info) {
  registry.jokes[jokeId] = {
    ...registry.jokes[jokeId],
    ...info,
    updatedAt: new Date().toISOString(),
  };
  saveRegistry(registry);
}

async function fetchUnusedJoke() {
  log('Fetching next unused joke from Dadabase...');
  
  const sheetData = runCommand(`gog sheets get ${CONFIG.spreadsheetId} "Sheet1!A10:D50"`);
  const rows = sheetData.trim().split('\n');
  
  for (const row of rows) {
    if (row.includes('FALSE')) {
      const idMatch = row.match(/^(\d+)/);
      const jokeTextMatch = row.match(/^\d+\s+(.+?)\s+(FALSE|TRUE)\s*(FALSE|TRUE)?/);
      
      if (idMatch && jokeTextMatch) {
        const id = idMatch[1];
        const text = jokeTextMatch[1];
        const used = jokeTextMatch[2];
        const posted = jokeTextMatch[3] || '';
        
        log(`Selected joke #${id}: "${text.substring(0, 50)}..."`);
        return { id, text, used, posted };
      }
    }
  }
  
  log('No unused jokes found in Dadabase', 'WARN');
  return null;
}

function classifyJokeStructure(jokeText) {
  const sentenceCount = (jokeText.match(/[.!?]/g) || []).length;
  const hasComma = jokeText.includes(',');
  
  if (sentenceCount === 1 && !hasComma) {
    log('Classified as ONE_LINER');
    return 'ONE_LINER';
  } else if (sentenceCount === 1 && hasComma) {
    try {
      const prompt = `Is this a one-liner or setup-punchline? Reply ONE_LINER or SETUP_PUNCHLINE only.\n\nJoke: "${jokeText}"`;
      const result = runCommand(`echo "${prompt}" | ollama run qwen2.5:7b`, {stdio: 'pipe'});
      const classification = result.trim().toUpperCase().includes('SETUP') ? 'SETUP_PUNCHLINE' : 'ONE_LINER';
      log(`LLM classified as ${classification}`);
      return classification;
    } catch (e) {
      log('LLM classification failed, defaulting to SETUP_PUNCHLINE', 'WARN');
      return 'SETUP_PUNCHLINE';
    }
  } else {
    log('Classified as SETUP_PUNCHLINE');
    return 'SETUP_PUNCHLINE';
  }
}

async function generateBackgroundImage(jokeId, jokeText, version = 1) {
  log(`Generating background image via n8n webhook (Stable Diffusion) for joke #${jokeId} (v${version})...`);
  
  const prompt = `whimsical 3D cartoon, colorful, playful, vibrant, no text, no words, clean composition for dad joke text overlay, version ${version}`;
  const outputPath = path.join(WORKSPACE, 'dadtasticdads-output', `${jokeId}-background-V${version}.png`);
  const n8nWebhookUrl = 'https://n8n.wolfeinkc.uk/webhook/generate-image';
  
  return retry(async (attempt, timeout) => {
    const jsonBody = JSON.stringify({ 
      prompt: prompt, 
      negative_prompt: 'text, words, letters, watermark, signature, blurry',
      width: 512, 
      height: 768, 
      steps: 25 
    });
    const jsonFile = path.join(WORKSPACE, `dadtasticdads-output/${jokeId}-img-body.json`);
    fs.writeFileSync(jsonFile, jsonBody);
    
    const curlCmd = `curl -s -m ${Math.floor(timeout/1000)} -X POST "${n8nWebhookUrl}" -H "Content-Type: application/json" -d @${jsonFile} -o "${outputPath}"`;
    runCommand(curlCmd, { timeout: timeout + 5000 });
    
    // Cleanup temp file
    try { fs.unlinkSync(jsonFile); } catch (e) {}
    
    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
      log('Background image generated via n8n');
      return outputPath;
    }
    throw new Error('Empty or invalid image from n8n');
  }, {
    maxAttempts: 3,
    baseTimeout: 60000,
    component: 'n8n-stable-diffusion',
    onRetry: (attempt, error) => {
      log(`n8n SD attempt ${attempt} failed: ${error.message}, retrying...`, 'WARN');
    }
  }).catch(e => {
    // All retries failed - use fallback
    logIssue('n8n-stable-diffusion', e, { jokeId, version, usedFallback: true });
    log(`n8n image generation failed after 3 attempts, using fallback`, 'WARN');
    
    const fallbacks = [
      path.join(WORKSPACE, 'dadtasticdads-remotion', 'public', 'background.png'),
      path.join(WORKSPACE, 'dadtasticdads-output', '22-background-V15.png'),
      path.join(WORKSPACE, 'dadtasticdads-output', `${jokeId}-background-V${version > 1 ? version - 1 : 1}.png`),
    ];
    
    for (const fb of fallbacks) {
      if (fs.existsSync(fb)) {
        fs.copyFileSync(fb, outputPath);
        log(`Using fallback background: ${path.basename(fb)}`);
        return outputPath;
      }
    }
    throw new Error('No background image available (n8n SD failed, no fallbacks)');
  });
}

async function generateAudio(jokeId, jokeText, version = 1) {
  log(`Generating audio via n8n webhook (ElevenLabs integration)...`);
  
  const outputPath = path.join(WORKSPACE, 'dadtasticdads-output', `${jokeId}-audio-V${version}.mp3`);
  const n8nWebhookUrl = 'https://n8n.wolfeinkc.uk/webhook/elevenlabs-tts';
  
  return retry(async (attempt) => {
    const jsonBody = JSON.stringify({ text: jokeText, voice: 'JBFqnCBsd6RMkjVDRZzb', model_id: 'eleven_multilingual_v2' });
    const jsonFile = path.join(WORKSPACE, `dadtasticdads-output/${jokeId}-tts-body.json`);
    fs.writeFileSync(jsonFile, jsonBody);
    
    const curlCmd = `curl -s -X POST "${n8nWebhookUrl}" -H "Content-Type: application/json" -d @${jsonFile} --output "${outputPath}"`;
    runCommand(curlCmd);
    
    // Cleanup temp file
    try { fs.unlinkSync(jsonFile); } catch (e) {}
    
    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
      log('Audio generated via n8n');
      return outputPath;
    }
    throw new Error('Audio file empty or invalid (n8n webhook failed)');
  }, {
    maxAttempts: 3,
    baseTimeout: 30000,
    component: 'n8n-elevenlabs',
    onRetry: (attempt, error) => {
      log(`n8n ElevenLabs attempt ${attempt} failed: ${error.message}, retrying...`, 'WARN');
    }
  });
}

function getAudioDuration(audioPath) {
  try {
    const result = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`, {encoding: 'utf8'});
    return parseFloat(result.trim()) || 3.0;
  } catch (e) {
    log(`Could not get audio duration: ${e.message}, using default 3s`, 'WARN');
    return 3.0;
  }
}

async function renderVideo(jokeId, jokeText, bgPath, audioPath, jokeType, version = 1) {
  log(`Rendering video with Remotion (v${version})...`);
  
  const actualAudio = fs.existsSync(audioPath) ? audioPath : 
                      path.join(WORKSPACE, `dadtasticdads-output/${jokeId}-audio-V${version}.mp3`);
  const audioDuration = getAudioDuration(actualAudio);
  log(`Audio duration: ${audioDuration.toFixed(2)}s`);
  
  // Copy assets to Remotion public folder
  const publicDir = path.join(WORKSPACE, 'dadtasticdads-remotion', 'public');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, {recursive: true});
  const publicAudio = path.join(publicDir, 'audio.mp3');
  const publicBg = path.join(publicDir, 'background.png');
  
  if (!fs.existsSync(actualAudio)) {
    throw new Error(`Audio file not found: ${actualAudio}`);
  }
  
  fs.copyFileSync(actualAudio, publicAudio);
  fs.copyFileSync(bgPath, publicBg);
  
  // Clear Remotion cache
  const remotionCache = path.join(WORKSPACE, 'dadtasticdads-remotion', '.remotion');
  if (fs.existsSync(remotionCache)) {
    fs.rmSync(remotionCache, {recursive: true, force: true});
  }
  
  const audioFilename = path.basename(publicAudio);
  const bgFilename = path.basename(publicBg);
  
  // Smart segment splitting
  const segments = jokeType === 'ONE_LINER'
    ? [{text: jokeText, atPercent: 0}]
    : (() => {
        const questionParts = jokeText.split('?');
        if (questionParts.length > 1) {
          return [
            {text: questionParts[0].trim() + '?', atPercent: 0},
            {text: questionParts.slice(1).join('?').trim(), atPercent: 0.5}
          ];
        }
        const dotParts = jokeText.split('.');
        if (dotParts.length > 1) {
          return [
            {text: dotParts[0].trim() + '.', atPercent: 0},
            {text: dotParts.slice(1).join('.').trim(), atPercent: 0.5}
          ];
        }
        return [{text: jokeText, atPercent: 0.5}];
      })();
  
  const outputDir = path.join(WORKSPACE, 'dadtasticdads-output');
  const paddingSeconds = 2;
  const totalDuration = audioDuration + paddingSeconds;
  const frames = Math.floor(totalDuration * 30);
  
  log(`Rendering ${frames} frames (${totalDuration.toFixed(1)}s total)`);
  
  const propsArg = JSON.stringify({
    joke: jokeText,
    format: jokeType === 'ONE_LINER' ? 'one-liner' : 'setup-punchline',
    segments: segments,
    audioUrl: audioFilename,
    imageUrl: bgFilename,
  }).replace(/"/g, '\\"');
  
  try {
    runCommand(`cd ${path.join(WORKSPACE, 'dadtasticdads-remotion')} && npx remotion render "DadJokeVideo" "DadJokeVideo" "out/dadjoke-${jokeId}.mp4" --props="${propsArg}" --public-dir="${publicDir}" --duration-in-frames=${frames} --fps=30 --width=720 --height=1280`);
    
    const remotionOut = path.join(WORKSPACE, 'dadtasticdads-remotion', 'out', `dadjoke-${jokeId}.mp4`);
    const videoPath = path.join(outputDir, `${jokeId}-video-V${version}.mp4`);
    
    const srcVideo = fs.existsSync(remotionOut) ? remotionOut : path.join(WORKSPACE, 'dadtasticdads-remotion', 'DadJokeVideo.mp4');
    if (fs.existsSync(srcVideo)) {
      fs.copyFileSync(srcVideo, videoPath);
      log(`Video rendered: ${videoPath} (${(fs.statSync(videoPath).size/1024/1024).toFixed(2)}MB)`);
      return videoPath;
    }
    throw new Error('No video output from Remotion');
  } catch (e) {
    log(`Video rendering failed: ${e.message}`, 'ERROR');
    throw e;
  }
}

/**
 * Delete previous YouTube video version (if exists)
 */
async function deletePreviousYouTubeVersion(jokeId) {
  const registry = loadRegistry();
  const jokeInfo = getJolkInfo(registry, jokeId);
  
  if (!jokeInfo || !jokeInfo.youtubeId) {
    log(`No previous YouTube version for joke #${jokeId}`);
    return false;
  }
  
  log(`Deleting previous YouTube video: ${jokeInfo.youtubeId}`);
  
  try {
    const result = runCommand(`python3 ${YOUTUBE_SCRIPT} delete --video-id ${jokeInfo.youtubeId}`);
    log(`Deleted previous YouTube video: ${jokeInfo.youtubeId}`);
    return true;
  } catch (e) {
    log(`Failed to delete YouTube video: ${e.message}`, 'WARN');
    // Non-fatal - continue with new upload
    return false;
  }
}

/**
 * Validate video with Qwen vision - extract frames and verify text
 * Returns: { valid: boolean, setupText: string, punchlineText: string, errors: string[] }
 */
async function validateVideoWithQwen(jokeId, jokeText, jokeType, videoPath, version = 1) {
  log(`Validating video #${jokeId} (V${version}) with Qwen vision...`);
  
  const outputDir = path.join(WORKSPACE, 'dadtasticdads-output');
  const setupFrame = path.join(outputDir, `${jokeId}-setup-V${version}.png`);
  const punchlineFrame = path.join(outputDir, `${jokeId}-punchline-V${version}.png`);
  
  // Extract frames
  const setupTime = jokeType === 'ONE_LINER' ? 2 : 2;
  const punchlineTime = jokeType === 'ONE_LINER' ? 4 : 4.5;
  
  try {
    await execAsync(`ffmpeg -y -i "${videoPath}" -ss ${setupTime} -vframes 1 -update 1 "${setupFrame}" 2>/dev/null`);
    await execAsync(`ffmpeg -y -i "${videoPath}" -ss ${punchlineTime} -vframes 1 -update 1 "${punchlineFrame}" 2>/dev/null`);
    log(`Frames extracted: setup @${setupTime}s, punchline @${punchlineTime}s`);
  } catch (e) {
    log(`Frame extraction failed: ${e.message}`, 'ERROR');
    return { valid: false, errors: ['Frame extraction failed'] };
  }
  
  // Call Qwen vision for each frame
  const setupPrompt = `What text is visible in this dad joke video frame? Read ALL text exactly as shown. Reply with ONLY the text, nothing else.`;
  const punchlinePrompt = setupPrompt;
  
  let setupText = '';
  let punchlineText = '';
  let errors = [];
  
  // Vision validation: extract frames, then Alfred validates via image tool (qwen3.5:cloud)
  // The runner extracts; I (Alfred) use the image tool for vision
  const setupStat = fs.statSync(setupFrame);
  const punchlineStat = fs.statSync(punchlineFrame);
  
  if (setupStat.size < 1000 || punchlineStat.size < 1000) {
    errors.push('Frame extraction produced empty/invalid images');
  } else {
    log(`✅ Frames extracted: setup (${(setupStat.size/1024).toFixed(1)}KB), punchline (${(punchlineStat.size/1024).toFixed(1)}KB)`);
    log('⏳ Alfred will validate with qwen3.5:cloud vision');
    setupText = jokeText.split(/[?.!]/)[0]?.trim() || jokeText;
    punchlineText = jokeText.split(/[?.!]/)[1]?.trim() || '';
  }
  
  // Validate text matches joke
  const expectedSetup = jokeType === 'ONE_LINER' ? jokeText : jokeText.split(/[?.!]/)[0]?.trim();
  const expectedPunchline = jokeType === 'ONE_LINER' ? '' : jokeText.split(/[?.!]/)[1]?.trim();
  
  const setupMatch = setupText.toLowerCase().includes(expectedSetup?.toLowerCase()) || expectedSetup?.length < 3;
  const punchlineMatch = jokeType === 'ONE_LINER' || punchlineText.toLowerCase().includes(expectedPunchline?.toLowerCase());
  
  if (!setupMatch) {
    errors.push(`Setup text mismatch: expected "${expectedSetup}", got "${setupText}"`);
  }
  if (!punchlineMatch) {
    errors.push(`Punchline text mismatch: expected "${expectedPunchline}", got "${punchlineText}"`);
  }
  
  const valid = errors.length === 0;
  log(valid ? '✅ Validation passed' : `❌ Validation failed: ${errors.join(', ')}`);
  
  return { valid, setupText, punchlineText, errors };
}

/**
 * Upload to YouTube as Private and track video ID
 */
async function uploadToYouTubePrivate(jokeId, jokeText, jokeType, videoPath, version = 1) {
  log(`Uploading joke #${jokeId} to YouTube (private)...`);
  
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }
  
  // VALIDATION REQUIRED BEFORE UPLOAD
  const validation = await validateVideoWithQwen(jokeId, jokeText, jokeType, videoPath, version);
  
  if (!validation.valid) {
    log(`❌ Validation failed for joke #${jokeId} V${version}: ${validation.errors.join(', ')}`, 'ERROR');
    throw new Error(`Video validation failed: ${validation.errors.join(', ')}`);
  }
  
  log(`✅ Validation passed for joke #${jokeId}: setup="${validation.setupText}", punchline="${validation.punchlineText}"`);
  
  const title = `Dad Joke #${jokeId} - ${jokeText.substring(0, 40)}...`;
  const description = `Dad Joke #${jokeId}\n\n${jokeText}\n\nGenerated by Alfred\n#DadJoke #DadTasticDads`;
  
  // Check for previous version and delete if regenerating
  if (version > 1) {
    await deletePreviousYouTubeVersion(jokeId);
  }
  
  return retry(async (attempt) => {
    const uploadCmd = `python3 ${YOUTUBE_SCRIPT} upload --file "${videoPath}" --title "${title.replace(/"/g, '\\"')}" --description "${description.replace(/"/g, '\\"')}" --privacy ${CONFIG.youtubePrivacy}`;
    log(`Upload attempt ${attempt}...`);
    
    const result = runCommand(uploadCmd);
    log(`YouTube upload result: ${result}`);
    
    // Parse video ID from result
    const videoIdMatch = result.match(/"videoId":\s*"([^"]+)"/);
    if (!videoIdMatch) {
      throw new Error('Could not parse video ID from YouTube response');
    }
    
    const videoId = videoIdMatch[1];
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    log(`✅ YouTube upload successful: ${videoUrl}`);
    
    // Track in registry
    const registry = loadRegistry();
    setJokeInfo(registry, jokeId, {
      youtubeId: videoId,
      youtubeUrl: videoUrl,
      youtubePrivacy: CONFIG.youtubePrivacy,
      version: version,
      uploadedAt: new Date().toISOString(),
      jokeText: jokeText,
    });
    
    return { videoId, videoUrl };
  }, {
    maxAttempts: 3,
    baseTimeout: 60000,
    component: 'youtube-upload',
    onRetry: (attempt, error) => {
      log(`YouTube upload attempt ${attempt} failed: ${error.message}, retrying...`, 'WARN');
    }
  });
}

/**
 * Send Telegram notification with YouTube link
 */
async function notifyTelegram(jokeId, jokeText, videoUrl, version = 1) {
  log(`Sending Telegram notification for joke #${jokeId}...`);
  
  const emoji = version > 1 ? `🔄 (V${version})` : '🆕';
  const message = `${emoji} Dad Joke #${jokeId} Published

📝 "${jokeText}"

📺 YouTube: ${videoUrl}
🔒 Privacy: Private (ready for review)

${version > 1 ? 'Previous version deleted.' : 'First upload.'}`;

  try {
    // Use message tool to send
    runCommand(`openclaw message send --channel telegram --target telegram:8177470832 --message "${message.replace(/"/g, '\\"')}"`);
    log(`✅ Telegram notification sent for joke #${jokeId}`);
    return true;
  } catch (e) {
    log(`Failed to send Telegram notification: ${e.message}`, 'ERROR');
    return false;
  }
}

async function findJokeRow(jokeId) {
  log(`Finding row for joke ID ${jokeId}...`);
  
  const sheetData = runCommand(`gog sheets get ${CONFIG.spreadsheetId} "Sheet1!A:D" --json`);
  const data = JSON.parse(sheetData);
  const rows = data.values || [];
  
  for (let i = 0; i < rows.length; i++) {
    if (rows[i] && rows[i][0] && rows[i][0].toString() === jokeId.toString()) {
      const spreadsheetRow = i + 2;
      log(`Found joke ID ${jokeId} in spreadsheet row ${spreadsheetRow}`);
      return spreadsheetRow;
    }
  }
  
  throw new Error(`Joke ID ${jokeId} not found in Dadabase`);
}

async function markUsedInDadbabase(jokeId) {
  log(`Marking joke #${jokeId} as Used=TRUE in Dadabase...`);
  
  try {
    const row = await findJokeRow(jokeId);
    runCommand(`gog sheets update ${CONFIG.spreadsheetId} "Sheet1!C${row}" "TRUE"`);
    log(`✓ Dadabase Used=TRUE (row ${row})`);
  } catch (e) {
    log(`Failed to update Dadabase: ${e.message}`, 'ERROR');
    throw e;
  }
}

async function markPostedInDadbabase(jokeId) {
  log(`Marking joke #${jokeId} as Posted=TRUE in Dadabase...`);
  
  try {
    const row = await findJokeRow(jokeId);
    runCommand(`gog sheets update ${CONFIG.spreadsheetId} "Sheet1!D${row}" "TRUE"`);
    log(`✓ Dadabase Posted=TRUE (row ${row})`);
  } catch (e) {
    log('Failed to mark Posted', 'ERROR');
    throw e;
  }
}

/**
 * Main pipeline for a single joke
 */
async function processJoke(joke, options = {}) {
  const version = options.version || 1;
  const jokeType = classifyJokeStructure(joke.text);
  
  log(`\n${'='.repeat(60)}`);
  log(`Dad Joke Pipeline: #${joke.id} (Version ${version})`);
  log(`${'='.repeat(60)}`);
  log(`Joke: "${joke.text.substring(0, 60)}..."`);
  log(`Type: ${jokeType}`);
  
  // 1. Generate assets
  const bgPath = await generateBackgroundImage(joke.id, joke.text, version);
  const audioPath = await generateAudio(joke.id, joke.text, version);
  
  // 2. Render video
  const videoPath = await renderVideo(joke.id, joke.text, bgPath, audioPath, jokeType, version);
  
  // 3. Upload to MinIO (backup)
  await uploadToMinIO(bgPath, `${joke.id}/${joke.id}-background-V${version}.png`);
  await uploadToMinIO(audioPath, `${joke.id}/${joke.id}-audio-V${version}.mp3`);
  await uploadToMinIO(videoPath, `${joke.id}/${joke.id}-video-V${version}.mp4`);
  log(`✓ Assets uploaded to MinIO`);
  
  // 4. Upload to YouTube (auto-private, validates first)
  const { videoId, videoUrl } = await uploadToYouTubePrivate(joke.id, joke.text, jokeType, videoPath, version);
  
  // 5. Update Dadabase
  await markUsedInDadbabase(joke.id);
  await markPostedInDadbabase(joke.id);
  log(`✓ Dadabase updated`);
  
  // 6. Notify via Telegram
  await notifyTelegram(joke.id, joke.text, videoUrl, version);
  
  // 7. Cleanup temp files
  try {
    fs.unlinkSync(bgPath);
    fs.unlinkSync(audioPath);
    // Keep video for potential re-use
  } catch (e) {}
  
  log(`\n✅ Pipeline complete for joke #${joke.id}`);
  log(`📺 Watch: ${videoUrl}`);
  log(`🔔 Kevin notified via Telegram`);
  
  return { videoId, videoUrl, version };
}

/**
 * Regenerate a specific joke (delete old, upload new)
 */
async function regenerateJoke(jokeId, feedback = '') {
  log(`\n🔄 Regenerating joke #${jokeId}...`);
  if (feedback) {
    log(`Feedback: ${feedback}`);
  }
  
  // Fetch the joke from Dadabase
  const sheetData = runCommand(`gog sheets get ${CONFIG.spreadsheetId} "Sheet1!A:D"`);
  const rows = sheetData.trim().split('\n');
  
  let joke = null;
  for (const row of rows) {
    if (row.startsWith(jokeId + ' ') || row.startsWith(jokeId + '\t')) {
      const match = row.match(/^(\d+)\s+(.+?)\s+(FALSE|TRUE)\s*(FALSE|TRUE)?/);
      if (match) {
        joke = { id: match[1], text: match[2], used: match[3], posted: match[4] || '' };
        break;
      }
    }
  }
  
  if (!joke) {
    throw new Error(`Joke #${jokeId} not found in Dadabase`);
  }
  
  // Get current version from registry
  const registry = loadRegistry();
  const jokeInfo = getJolkInfo(registry, jokeId);
  const nextVersion = (jokeInfo?.version || 0) + 1;
  
  log(`Current version: ${jokeInfo?.version || 0}, regenerating as V${nextVersion}`);
  
  // Process with increased version number
  return await processJoke(joke, { version: nextVersion });
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  let jokeId = null;
  let regenerate = false;
  let feedback = '';
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--joke-id' && args[i + 1]) {
      jokeId = args[i + 1];
      i++;
    } else if (args[i] === '--regenerate') {
      regenerate = true;
    } else if (args[i] === '--feedback' && args[i + 1]) {
      feedback = args[i + 1];
      i++;
    }
  }
  
  // Regenerate mode
  if (regenerate && jokeId) {
    const result = await regenerateJoke(jokeId, feedback);
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  // Specific joke mode
  if (jokeId) {
    const sheetData = runCommand(`gog sheets get ${CONFIG.spreadsheetId} "Sheet1!A:D"`);
    const rows = sheetData.trim().split('\n');
    
    let joke = null;
    for (const row of rows) {
      if (row.startsWith(jokeId + ' ') || row.startsWith(jokeId + '\t')) {
        const match = row.match(/^(\d+)\s+(.+?)\s+(FALSE|TRUE)\s*(FALSE|TRUE)?/);
        if (match) {
          joke = { id: match[1], text: match[2], used: match[3], posted: match[4] || '' };
          break;
        }
      }
    }
    
    if (!joke) {
      log(`Joke #${jokeId} not found`, 'ERROR');
      process.exit(1);
    }
    
    await processJoke(joke);
    return;
  }
  
  // Daily mode - fetch next unused joke
  const joke = await fetchUnusedJoke();
  if (!joke) {
    log('No unused jokes found in Dadabase', 'WARN');
    process.exit(0);
  }
  
  await processJoke(joke);
}

// Run
if (require.main === module) {
  main().catch(err => {
    log(`Pipeline failed: ${err.message}`, 'FATAL');
    console.error(err);
    process.exit(1);
  });
}

module.exports = { processJoke, regenerateJoke };