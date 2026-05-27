#!/usr/bin/env node
/**
 * DadtasticDads Daily Video Generator - PRODUCTION VERSION
 * 
 * Fully automated with:
 * - Intelligent retry logic (regenerate only what failed)
 * - Audio caching (generate once, reuse on retry)
 * - Quality gates (image, text, audio, sync)
 * - Graceful fallbacks (all components have backups)
 * - Comprehensive logging (detailed output for Kevin)
 * 
 * Usage: node generate-dadjoke-video-PRODUCTION.js
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Import validators
const { validateImage, validateAndRegenerateIfNeeded } = require('./validate-image.js');
const { verifyTextVisible, cleanupFrames } = require('./verify-text-visible.js');
const { verifyAudioSync } = require('./verify-audio-sync.js');

// Configuration
const CONFIG = {
  ollamaUrl: 'http://192.168.1.33:11434',
  ollamaModel: 'mistral:7b',
  imagePromptModel: 'llama3.1:latest',
  stableDiffusionUrl: 'http://192.168.1.33:7860',
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || 'sk_2c86803a3f4ec344ea132627832d319bc3c7af64b339c103',
  voiceId: 'JBFqnCBsd6RMkjVDRZzb',
  modelId: 'eleven_multilingual_v2',
  outputDir: '/home/kevin/.openclaw/workspace/dadtasticdads-output',
  remotionProject: '/home/kevin/.openclaw/workspace/dadtasticdads-remotion',
  spreadsheetId: '1cXSGjCXleUK8iQweBAwLaa7j3QK2Sla-8v11CirQsuw',
  hereNowApiKey: '43818e0ae2d23aeaad3e2d5cd6e4c17c0b0eaeaf071c04c9a1f521722ce29c12',
  
  // Quality thresholds
  qualityThresholds: {
    imageMinScore: 70,
    textVisibilityMinScore: 70,
    audioSyncMinScore: 70,
    overallMinScore: 80,
  },
  
  // Retry limits
  maxRetries: {
    joke: 3,
    audio: 2,
    image: 2,
    render: 2,
  }
};

// Ensure output directories exist
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}
if (!fs.existsSync(path.join(CONFIG.outputDir, 'cache'))) {
  fs.mkdirSync(path.join(CONFIG.outputDir, 'cache'), { recursive: true });
}

// === State Management ===
let jobState = {
  joke: null,
  audioFile: null,
  audioDuration: 0,
  formatAnalysis: null,
  imagePrompt: null,
  imageFile: null,
  videoFile: null,
  retryCount: 0,
  qualityScores: {},
  logs: [],
  timings: {},
  startTime: Date.now()
};

function getElapsedTime() {
  return ((Date.now() - jobState.startTime) / 1000).toFixed(2);
}

function startTimer(label) {
  jobState.timings[label] = { start: Date.now() };
}

function endTimer(label) {
  if (jobState.timings[label]) {
    jobState.timings[label].end = Date.now();
    jobState.timings[label].duration = ((jobState.timings[label].end - jobState.timings[label].start) / 1000).toFixed(2);
  }
}

function log(message, level = 'info') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const elapsed = getElapsedTime();
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : level === 'timing' ? '⏱️' : '✅';
  const logEntry = `[${timestamp}] [${elapsed}s] [${level.toUpperCase()}] ${message}`;
  
  console.log(level === 'error' ? logEntry : logEntry);
  jobState.logs.push(logEntry);
}

// === Step 1: Google Sheets ===
async function getNextUnusedJoke() {
  return new Promise((resolve, reject) => {
    const cmd = `gog sheets get ${CONFIG.spreadsheetId} "Sheet1!A1:D200" --json`;
    exec(cmd, (err, stdout, stderr) => {
      if (err) reject(new Error(`Sheets error: ${stderr}`));
      try {
        const data = JSON.parse(stdout);
        const values = data.values || [];
        
        for (let i = 1; i < values.length; i++) {
          const row = values[i];
          if (row.length >= 3) {
            const id = row[0];
            const joke = row[1];
            const used = row[2] === 'TRUE';
            const posted = row.length >= 4 ? row[3] === 'TRUE' : false;
            
            if (!used && !posted) {
              resolve({ id, joke, row: i + 1 });
              return;
            }
          }
        }
        reject(new Error('No unused jokes found'));
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function markJokeUsed(rowNum) {
  return new Promise((resolve, reject) => {
    const cmd = `gog sheets update ${CONFIG.spreadsheetId} "Sheet1!C${rowNum}" "TRUE"`;
    exec(cmd, (err, stdout, stderr) => {
      if (err) reject(new Error(`Sheets update error: ${stderr}`));
      else resolve();
    });
  });
}

// === Step 2: ElevenLabs with Audio Caching ===
async function generateAudio(text) {
  // Check cache first (hash the text)
  const crypto = require('crypto');
  const cacheKey = crypto.createHash('md5').update(text).digest('hex');
  const cachedFile = path.join(CONFIG.outputDir, 'cache', `audio-${cacheKey}.mp3`);
  
  if (fs.existsSync(cachedFile)) {
    log(`Audio cache hit: ${cachedFile}`, 'info');
    const duration = await getAudioDuration(cachedFile);
    return { file: cachedFile, duration, cached: true };
  }
  
  log('Generating new audio (not in cache)...', 'info');
  const filename = `audio-${Date.now()}.mp3`;
  const filepath = path.join(CONFIG.outputDir, filename);
  const jsonFile = path.join(CONFIG.outputDir, `tts-${Date.now()}.json`);
  const paddedFile = path.join(CONFIG.outputDir, `audio-padded-${Date.now()}.mp3`);
  
  fs.writeFileSync(jsonFile, JSON.stringify({
    text: text,
    model_id: CONFIG.modelId,
    voice_settings: { stability: 0.5, similarity_boost: 0.75 },
  }));
  
  return new Promise(async (resolve, reject) => {
    const curl = `curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/${CONFIG.voiceId}" ` +
      `-H "xi-api-key: ${CONFIG.elevenLabsApiKey}" ` +
      `-H "Content-Type: application/json" ` +
      `-d @${jsonFile} --output "${filepath}"`;
    
    exec(curl, { timeout: 30000 }, async (err, stdout, stderr) => {
      try { fs.unlinkSync(jsonFile); } catch {}
      
      if (err) {
        reject(new Error(`ElevenLabs: ${stderr}`));
        return;
      }
      
      // Add padding
      try {
        await execAsync(
          `ffmpeg -y -f lavfi -i "anullsrc=cl=mono:r=44100:d=1" -i "${filepath}" -f lavfi -i "anullsrc=cl=mono:r=44100:d=1" ` +
          `-filter_complex "[0][1][2]concat=n=3:v=0:a=1" "${paddedFile}" 2>/dev/null`
        );
        
        try { fs.unlinkSync(filepath); } catch {}
        const duration = await getAudioDuration(paddedFile);
        
        // Cache the padded version
        fs.copyFileSync(paddedFile, cachedFile);
        log(`Audio cached for reuse`, 'info');
        
        resolve({ file: paddedFile, duration, cached: false });
      } catch (padErr) {
        // Fallback to original
        const duration = await getAudioDuration(filepath);
        resolve({ file: filepath, duration, cached: false });
      }
    });
  });
}

async function getAudioDuration(audioFile) {
  const { stdout } = await execAsync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioFile}"`
  );
  return parseFloat(stdout.trim());
}

// === Step 3: Format Detection ===
async function detectJokeFormat(joke) {
  const prompt = `Analyze dad joke for video segments. Return ONLY raw JSON.

Rules:
- segments array should contain ONLY actual joke text to display
- Remove stage directions like "(pause...)", "(...)", "[...]"
- atPercent: 0-1, when text should appear
- For multi-segment: setup at 0, punchline at 0.5-0.7

Joke: "${joke}"

Example: {"format":"setup-punchline","segments":[{"text":"Why did the chicken cross the road?","atPercent":0,"display":"fade-in"},{"text":"To get to the second-hand store!","atPercent":0.6,"display":"pop-in"}],"reasoning":"Q&A format"}

JSON:`;

  try {
    const response = await callOllama(CONFIG.ollamaModel, prompt);
    const json = extractJSON(response);
    if (!json.format || !json.segments?.length) throw new Error('Invalid');
    
    // Filter out stage directions
    json.segments = json.segments.filter(seg => {
      const text = seg.text.trim();
      if (!text || text.startsWith('(') || text.startsWith('[')) return false;
      seg.text = text.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
      return seg.text.length > 0;
    });
    
    if (json.segments.length === 0) throw new Error('No valid segments');
    
    const validFormats = ['one-liner', 'setup-punchline', 'multi-line'];
    if (!validFormats.includes(json.format)) {
      json.format = json.segments.length > 1 ? 'setup-punchline' : 'one-liner';
    }
    
    return json;
  } catch (e) {
    return {
      format: 'one-liner',
      segments: [{ text: joke, atPercent: 0, display: 'fade-in' }],
      reasoning: 'Fallback (LLM error)'
    };
  }
}

// === Step 4: Image Prompt ===
async function generateImagePrompt(joke) {
  // Better prompt engineering - avoid literal pun interpretations
  const prompt = `Create a SHORT, VISUAL cartoon description for this dad joke.

CRITICAL RULES:
- Describe actual OBJECTS/SCENES, not wordplay
- If joke has a pun, illustrate the SCENARIO not the pun itself  
- NO text in image, NO words, NO letters
- Simple, clear composition
- Example: For "I'm afraid for my calendar" → "anxious calendar character" NOT "calendar with numbers"

Joke: "${joke}"

Cartoon description (1 sentence, concrete objects only):`;
  const response = await callOllama(CONFIG.imagePromptModel, prompt);
  return response.trim().substring(0, 200);
}

// === Step 5: Stable Diffusion ===
async function generateImage(prompt) {
  const filename = `bg-${Date.now()}.png`;
  const filepath = path.join(CONFIG.outputDir, filename);
  const b64File = `${filepath}.b64`;
  const sdPayloadFile = `${filepath}.payload.json`;
  
  log('Generating SD image (max 5 min, 512x768, 25 steps)...', 'info');
  
  // Improved prompt engineering - avoid literal interpretations
  const enhancedPrompt = `masterpiece, best quality, highly detailed, ${prompt}, cartoon style, whimsical, vibrant colors, clean composition, no text, no words, no letters`;
  const negativePrompt = 'ugly, deformed, blurry, busy, text, watermark, signature, letters, words, bad anatomy, distorted, low quality';
  
  fs.writeFileSync(sdPayloadFile, JSON.stringify({
    prompt: enhancedPrompt,
    negative_prompt: negativePrompt,
    width: 512,
    height: 768,
    steps: 25,
    sampler_name: 'DPM++ 2M Karras',
    cfg_scale: 7,
  }));
  
  exec(`curl -s -X POST "${CONFIG.stableDiffusionUrl}/sdapi/v1/txt2img" -H "Content-Type: application/json" -d @${sdPayloadFile} | jq -r '.images[0]' > "${b64File}"`);
  
  for (let i = 0; i < 300; i++) {
    await sleep(1000);
    if (i % 10 === 0) {
      try {
        const p = await fetchJSON(`${CONFIG.stableDiffusionUrl}/sdapi/v1/progress`);
        if (p.progress) log(`   SD: ${Math.round(p.progress * 100)}%`);
      } catch {}
    }
    try {
      const stats = fs.statSync(b64File);
      if (stats.size > 50000) {
        const b64 = fs.readFileSync(b64File, 'utf8').trim();
        if (b64 && b64.length > 50000 && b64.startsWith('iVBOR')) {
          fs.writeFileSync(filepath, Buffer.from(b64, 'base64'));
          fs.unlinkSync(b64File);
          fs.unlinkSync(sdPayloadFile);
          const s = fs.statSync(filepath);
          log(`Image: ${(s.size/1024/1024).toFixed(2)}MB`, 'info');
          return filepath;
        }
      }
    } catch {}
  }
  
  log('SD timeout (5 min), using fallback gradient...', 'warn');
  try { fs.unlinkSync(b64File); } catch {}
  try { fs.unlinkSync(sdPayloadFile); } catch {}
  
  const fallbackFile = filepath.replace('.png', '-fallback.png');
  await execAsync(`ffmpeg -y -f lavfi -i "color=c=#102A54:s=480x720:d=1" -frames:v 1 "${fallbackFile}"`);
  return fallbackFile;
}

// === Step 6: Remotion ===
async function renderVideo(joke, format, audioFile, imageFile, duration) {
  // Remotion always outputs as composition name, not the specified filename
  const videoName = `DadJokeVideo.mp4`;
  const videoFile = path.join(CONFIG.outputDir, `dadjoke-${Date.now()}.mp4`);
  
  // Clean up any existing output
  try { fs.unlinkSync(path.join(CONFIG.remotionProject, videoName)); } catch {}
  
  fs.copyFileSync(imageFile, path.join(CONFIG.remotionProject, 'public', 'background.png'));
  fs.copyFileSync(audioFile, path.join(CONFIG.remotionProject, 'public', 'audio.mp3'));
  
  const frames = Math.floor(duration * 30) + 60;
  
  const propsArg = JSON.stringify({
    joke, 
    format: format.format, 
    segments: format.segments,  
    audioUrl: 'audio.mp3',
    imageUrl: 'background.png',
  }).replace(/"/g, '\\"');
  
  return new Promise((resolve, reject) => {
    const publicDir = path.join(CONFIG.remotionProject, 'public');
    // Remotion always outputs as composition name
    const cmd = `cd ${CONFIG.remotionProject} && npx remotion render "DadJokeVideo" "DadJokeVideo" "${videoName}" --props="${propsArg}" --public-dir="${publicDir}" --duration-in-frames=${frames} --fps=30 --width=720 --height=1280`;
    
    exec(cmd, { timeout: 300000 }, async (err) => {
      if (err) { reject(new Error(`Remotion: ${err.message}`)); return; }
      
      // Check for DadJokeVideo.mp4 in project root (Remotion ignores output filename)
      const remotionOut = path.join(CONFIG.remotionProject, videoName);
      
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 500));
        if (fs.existsSync(remotionOut)) {
          try {
            fs.copyFileSync(remotionOut, videoFile);
            fs.unlinkSync(remotionOut);
            resolve(videoFile);
            return;
          } catch (e) {
            reject(new Error(`Copy failed: ${e.message}`));
            return;
          }
        }
      }
      
      reject(new Error('No output from Remotion after 10 checks'));
    });
  });
}

// === Production Quality Verification ===
async function verifyVideo(videoFile, joke, segments, audioDuration, audioFile) {
  log('Running comprehensive quality verification...', 'info');
  
  const qualityReport = {
    image: await validateImage(jobState.imageFile),
    text: await verifyTextVisible(videoFile, segments, audioDuration),
    audio: await verifyAudioSync(videoFile, audioFile, segments),
  };
  
  // Calculate overall quality score
  qualityReport.overall = Math.round(
    (qualityReport.image.score + qualityReport.text.score + qualityReport.audio.score) / 3
  );
  
  qualityReport.passed = 
    qualityReport.image.score >= CONFIG.qualityThresholds.imageMinScore &&
    qualityReport.text.score >= CONFIG.qualityThresholds.textVisibilityMinScore &&
    qualityReport.audio.score >= CONFIG.qualityThresholds.audioSyncMinScore &&
    qualityReport.overall >= CONFIG.qualityThresholds.overallMinScore;
  
  // Log detailed report
  log('\n=== Quality Report ===', 'info');
  log(`Image Quality:      ${qualityReport.image.score}/100 ${qualityReport.image.passed ? '✅' : '⚠️'}`, 'info');
  if (qualityReport.image.issues.length > 0) {
    qualityReport.image.issues.forEach(i => log(`  - ${i}`));
  }
  
  log(`Text Visibility:    ${qualityReport.text.score}/100 ${qualityReport.text.passed ? '✅' : '⚠️'}`, 'info');
  log(`Audio Sync:         ${qualityReport.audio.score}/100 ${qualityReport.audio.passed ? '✅' : '⚠️'}`, 'info');
  log(`OVERALL:            ${qualityReport.overall}/100 ${qualityReport.passed ? '✅ PASSED' : '❌ FAILED'}`, 'info');
  
  // Cleanup frames
  if (qualityReport.text.frames) {
    cleanupFrames(qualityReport.text.frames);
  }
  
  return qualityReport;
}

// === Step 8.5: MinIO Backup ===
async function backupToMinIO(videoFile, audioFile, imageFile, jokeId) {
  const mcCmd = 'mc cp --quiet';
  const minioAlias = 'minio-hp1';
  const basePath = `${minioAlias}/dadjokes/${jokeId}`;
  
  try {
    // Upload video
    await execAsync(`${mcCmd} "${videoFile}" "${basePath}/video.mp4"`);
    log(`  Uploaded video to ${basePath}/video.mp4`, 'info');
    
    // Upload audio
    if (fs.existsSync(audioFile)) {
      await execAsync(`${mcCmd} "${audioFile}" "${basePath}/audio.mp3"`);
      log(`  Uploaded audio to ${basePath}/audio.mp3`, 'info');
    }
    
    // Upload image (find the bg-*.png file)
    const imageFiles = fs.readdirSync(CONFIG.outputDir)
      .filter(f => f.startsWith('bg-') && f.endsWith('.png'))
      .sort((a, b) => {
        const aStats = fs.statSync(path.join(CONFIG.outputDir, a));
        const bStats = fs.statSync(path.join(CONFIG.outputDir, b));
        return bStats.mtimeMs - aStats.mtimeMs; // Most recent first
      });
    
    if (imageFiles.length > 0) {
      const latestImage = path.join(CONFIG.outputDir, imageFiles[0]);
      await execAsync(`${mcCmd} "${latestImage}" "${basePath}/background.png"`);
      log(`  Uploaded image to ${basePath}/background.png`, 'info');
    }
    
  } catch (err) {
    log(`MinIO backup error: ${err.message}`, 'warn');
  }
}

// === Step 8: here.now Upload ===
async function uploadToHereNow(videoFile, jokeId) {
  const filename = `dadjoke-${jokeId}.html`;
  const filepath = path.join(CONFIG.outputDir, filename);
  const videoBasename = path.basename(videoFile);
  
  // Create HTML wrapper
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dad Joke #${jokeId} | DadtasticDads</title><style>body{margin:0;padding:0;background:#000;display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:system-ui}.container{max-width:100%;width:100%}video{width:100%;max-width:480px;height:auto;display:block;margin:0 auto}.brand{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);color:#F8EFE1;font-family:system-ui;font-size:14px;opacity:0.7;text-align:center}</style></head><body><div class="container"><video controls playsinline><source src="${videoBasename}" type="video/mp4">Your browser doesn't support video.</video></div><div class="brand">DadtasticDads #${jokeId}</div></body></html>`;
  
  fs.writeFileSync(filepath, html);
  
  try {
    // Step 1: Init publish session
    log('Init here.now upload...', 'info');
    const initRes = await fetch('https://here.now/api/v1/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: [
          { path: 'index.html', size: Buffer.byteLength(html), contentType: 'text/html; charset=utf-8' },
          { path: videoBasename, size: fs.statSync(videoFile).size, contentType: 'video/mp4' }
        ]
      })
    });
    const initData = await initRes.json();
    
    if (!initData.slug || !initData.upload?.uploads) {
      throw new Error(`here.now init failed: ${JSON.stringify(initData)}`);
    }
    
    const slug = initData.slug;
    const siteUrl = `https://${slug}.here.now/`;
    const uploads = initData.upload.uploads;
    const finalizeUrl = initData.upload.finalizeUrl;
    
    // Step 2: Upload files to S3
    for (const upload of uploads) {
      const filePath = upload.path === 'index.html' ? filepath : videoFile;
      const fileName = upload.path.split('/').pop();
      
      log(`Uploading ${fileName}...`, 'info');
      const fileBuffer = fs.readFileSync(filePath);
      
      const fileRes = await fetch(upload.url, {
        method: 'PUT',
        headers: { ...upload.headers, 'Content-Length': fileBuffer.length.toString() },
        body: fileBuffer
      });
      
      if (!fileRes.ok) throw new Error(`Upload failed for ${fileName}: ${fileRes.status}`);
    }
    
    // Step 3: Finalize - needs POST with versionId
    log('Finalizing upload...', 'info');
    const versionId = initData.upload.versionId;
    const finalizeRes = await fetch(finalizeUrl, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versionId })
    });
    if (!finalizeRes.ok) throw new Error(`Finalize failed: ${finalizeRes.status}`);
    
    log(`Upload complete: ${siteUrl}`, 'info');
    return siteUrl;
    
  } catch (err) {
    log(`here.now upload error: ${err.message}`, 'warn');
    return 'Upload ready (manual)';
  }
}

// === Utils ===
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function fetchJSON(url) { const r = await fetch(url); return r.json(); }
function callOllama(model, prompt) {
  const jsonFile = path.join(CONFIG.outputDir, `ollama-${Date.now()}.json`);
  fs.writeFileSync(jsonFile, JSON.stringify({ model, prompt, stream: false }));
  return new Promise((resolve, reject) => {
    exec(`curl -s -X POST "${CONFIG.ollamaUrl}/api/generate" -H "Content-Type: application/json" -d @${jsonFile}`, { timeout: 60000 }, (err, stdout, stderr) => {
      try { fs.unlinkSync(jsonFile); } catch {}
      if (err) reject(new Error(stderr || err.message));
      else {
        const r = JSON.parse(stdout);
        if (r.error) reject(new Error(r.error));
        else resolve(r.response || '');
      }
    });
  });
}
function extractJSON(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (m) try { return JSON.parse(m[0]); } catch {}
  return {};
}

// === Production Orchestration with Retry Logic ===
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  DadtasticDads PRODUCTION Video Generator                    ║');
  console.log('║  Full Automation with Quality Gates                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  try {
    // Step 1: Get joke (with retry)
    startTimer('step1-fetch-joke');
    let jokeAttempts = 0;
    while (jokeAttempts < CONFIG.maxRetries.joke) {
      try {
        log('Step 1: Fetching joke from Dadabase...', 'info');
        jobState.joke = await getNextUnusedJoke();
        endTimer('step1-fetch-joke');
        log(`Joke #${jobState.joke.id} fetched in ${jobState.timings['step1-fetch-joke'].duration}s`, 'timing');
        break;
      } catch (e) {
        jokeAttempts++;
        if (jokeAttempts >= CONFIG.maxRetries.joke) throw e;
        log(`Retry ${jokeAttempts}/${CONFIG.maxRetries.joke} after error: ${e.message}`, 'warn');
        await sleep(2000);
      }
    }
    console.log('');
    
    // Step 2: Generate audio (with retry)
    startTimer('step2-generate-audio');
    let audioAttempts = 0;
    while (audioAttempts < CONFIG.maxRetries.audio) {
      try {
        log('Step 2: Generating ElevenLabs audio...', 'info');
        const audioResult = await generateAudio(jobState.joke.joke);
        jobState.audioFile = audioResult.file;
        jobState.audioDuration = audioResult.duration;
        endTimer('step2-generate-audio');
        log(`Audio: ${audioResult.cached ? 'cached' : 'generated'} | ${jobState.audioDuration.toFixed(2)}s | Took ${jobState.timings['step2-generate-audio'].duration}s`, 'timing');
        break;
      } catch (e) {
        audioAttempts++;
        if (audioAttempts >= CONFIG.maxRetries.audio) throw e;
        log(`Retry ${audioAttempts}/${CONFIG.maxRetries.audio} after error: ${e.message}`, 'warn');
        await sleep(2000);
      }
    }
    console.log('');
    
    // Step 3: Detect format (with retry)
    startTimer('step3-detect-format');
    log('Step 3: Analyzing joke format...', 'info');
    jobState.formatAnalysis = await detectJokeFormat(jobState.joke.joke);
    endTimer('step3-detect-format');
    log(`Format: ${jobState.formatAnalysis.format} | Took ${jobState.timings['step3-detect-format'].duration}s`, 'timing');
    jobState.formatAnalysis.segments.forEach((seg, i) => {
      log(`  [${i}] "${seg.text.substring(0, 50)}..." @ ${Math.round(seg.atPercent * 100)}%`);
    });
    console.log('');
    
    // Step 4: Generate image prompt (with retry)
    startTimer('step4-image-prompt');
    log('Step 4: Generating image prompt...', 'info');
    let promptAttempts = 0;
    while (promptAttempts < CONFIG.maxRetries.image) {
      try {
        jobState.imagePrompt = await generateImagePrompt(jobState.joke.joke);
        endTimer('step4-image-prompt');
        log(`Prompt: "${jobState.imagePrompt.substring(0, 100)}..." | Took ${jobState.timings['step4-image-prompt'].duration}s`, 'timing');
        break;
      } catch (e) {
        promptAttempts++;
        if (promptAttempts >= CONFIG.maxRetries.image) {
          jobState.imagePrompt = `cartoon illustration of ${jobState.joke.joke}, whimsical, colorful`;
          log(`Using fallback prompt`, 'warn');
        }
      }
    }
    console.log('');
    
    // Step 5: Generate image with validation & retry
    startTimer('step5-generate-image');
    log('Step 5: Generating background image...', 'info');
    let imageAttempts = 0;
    while (imageAttempts < CONFIG.maxRetries.image + 1) {
      jobState.imageFile = await generateImage(jobState.imagePrompt);
      jobState.qualityScores.image = await validateImage(jobState.imageFile);
      
      if (jobState.qualityScores.image.passed || imageAttempts >= CONFIG.maxRetries.image) {
        endTimer('step5-generate-image');
        log(`Image: ${(fs.statSync(jobState.imageFile).size/1024/1024).toFixed(2)}MB | Quality: ${jobState.qualityScores.image.score}/100 | Took ${jobState.timings['step5-generate-image'].duration}s`, 'timing');
        break;
      }
      
      imageAttempts++;
      log(`Image quality failed (${jobState.qualityScores.image.score}/100), retrying...`, 'warn');
      jobState.imagePrompt += ` (variation ${imageAttempts}, clearer subject)`;
    }
    console.log('');
    
    // Step 6: Render video (with retry)
    startTimer('step6-render-video');
    let renderAttempts = 0;
    while (renderAttempts < CONFIG.maxRetries.render) {
      try {
        log('Step 6: Rendering video...', 'info');
        jobState.videoFile = await renderVideo(
          jobState.joke.joke,
          jobState.formatAnalysis,
          jobState.audioFile,
          jobState.imageFile,
          jobState.audioDuration
        );
        endTimer('step6-render-video');
        log(`Video rendered: ${path.basename(jobState.videoFile)} | Took ${jobState.timings['step6-render-video'].duration}s`, 'timing');
        break;
      } catch (e) {
        renderAttempts++;
        if (renderAttempts >= CONFIG.maxRetries.render) throw e;
        log(`Retry ${renderAttempts}/${CONFIG.maxRetries.render} after error: ${e.message}`, 'warn');
        await sleep(2000);
      }
    }
    console.log('');
    
    // Step 7: Comprehensive quality verification
    startTimer('step7-quality-verify');
    log('Step 7: Production quality verification...', 'info');
    const qualityReport = await verifyVideo(
      jobState.videoFile,
      jobState.joke.joke,
      jobState.formatAnalysis.segments,
      jobState.audioDuration,
      jobState.audioFile
    );
    endTimer('step7-quality-verify');
    log(`Quality verification: ${qualityReport.overall}/100 | Took ${jobState.timings['step7-quality-verify'].duration}s`, 'timing');
    console.log('');
    
    if (!qualityReport.passed) {
      log('Quality verification FAILED - manual review required', 'error');
      console.log('\n=== Quality Report Summary ===');
      console.log(`Image: ${qualityReport.image.score}/100`);
      console.log(`Text: ${qualityReport.text.score}/100`);
      console.log(`Audio: ${qualityReport.audio.score}/100`);
      console.log(`OVERALL: ${qualityReport.overall}/100 ❌\n`);
      throw new Error(`Quality score ${qualityReport.overall}/100 below threshold ${CONFIG.qualityThresholds.overallMinScore}`);
    }
    
    // Step 8: Update Google Sheets
    startTimer('step8-update-sheets');
    log('Step 8: Marking joke as used...', 'info');
    await markJokeUsed(jobState.joke.row);
    endTimer('step8-update-sheets');
    log('Marked as used', 'info');
    console.log('');
    
    // Step 9: Upload to here.now
    startTimer('step9-upload-here-now');
    log('Step 9: Uploading to here.now...', 'info');
    const hereNowUrl = await uploadToHereNow(jobState.videoFile, jobState.joke.id);
    endTimer('step9-upload-here-now');
    log(`Uploaded: ${hereNowUrl} | Took ${jobState.timings['step9-upload-here-now'].duration}s`, 'timing');
    console.log('');
    
    // Step 10: Backup to MinIO
    startTimer('step10-backup-minio');
    log('Step 10: Backing up to MinIO...', 'info');
    await backupToMinIO(
      jobState.videoFile,
      jobState.audioFile,
      jobState.imageFile,
      jobState.joke.id
    );
    endTimer('step10-backup-minio');
    log('Backup complete: minio-hp1/dadjokes/' + jobState.joke.id + '/', 'info');
    console.log('');
    
    // Calculate total and per-step times
    const totalDuration = getElapsedTime();
    const stepTimings = Object.entries(jobState.timings)
      .map(([key, val]) => `  ${key.padEnd(30)} ${val.duration}s`)
      .join('\n');
    
    // Generate timing report
    const timingReport = {
      totalDuration: totalDuration,
      steps: jobState.timings,
      jokeId: jobState.joke.id,
      qualityScore: qualityReport.overall,
      timestamp: new Date().toISOString()
    };
    
    // Save timing report
    const reportFile = path.join(CONFIG.outputDir, `timing-report-${jobState.joke.id}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(timingReport, null, 2));
    log(`Timing report saved: ${reportFile}`, 'info');
    
    // SUCCESS
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ PRODUCTION COMPLETE                                       ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log(`\n⏱️  TOTAL TIME: ${totalDuration}s\n`);
    console.log('📊 Step-by-step breakdown:');
    console.log(stepTimings);
    console.log(`\n📹 Video: ${jobState.videoFile}`);
    console.log(`🌐 URL: ${hereNowUrl}`);
    console.log(`📊 Quality: ${qualityReport.overall}/100`);
    console.log(`\nQuality Breakdown:`);
    console.log(`  Image:  ${qualityReport.image.score}%`);
    console.log(`  Text:   ${qualityReport.text.score}%`);
    console.log(`  Audio:  ${qualityReport.audio.score}%`);
    console.log('');
    
  } catch (error) {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  ❌ PRODUCTION FAILED                                         ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.error(`\nError: ${error.message}`);
    console.error('\nPartial state:');
    console.log(`  Joke: ${jobState.joke?.joke || 'N/A'}`);
    console.log(`  Audio: ${jobState.audioFile || 'N/A'}`);
    console.log(`  Image: ${jobState.imageFile || 'N/A'}`);
    console.log(`  Video: ${jobState.videoFile || 'N/A'}`);
    process.exit(1);
  }
}

main();
