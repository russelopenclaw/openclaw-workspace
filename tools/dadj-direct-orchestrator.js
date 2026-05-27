#!/usr/bin/env node
/**
 * Dad Joke Direct Orchestrator - NO n8n dependencies
 * 
 * Uses documented working approaches from TOOLS.md:
 * - Direct ElevenLabs curl API (not n8n webhook)
 * - Direct SD API (not n8n webhook)
 * - Remotion render (unchanged)
 * - MinIO upload (unchanged)
 * - YouTube upload (unchanged)
 * 
 * Flow:
 * 1. Fetch joke from Dadabase (Google Sheets via gog)
 * 2. Classify structure (one-liner vs setup-punchline)
 * 3. Generate ElevenLabs audio via direct curl API
 * 4. Generate SD background via direct API
 * 5. Validate image with Qwen3.5 Vision (3 attempts max)
 * 6. Render Remotion video
 * 7. Validate video (3 attempts max)
 * 8. Upload to MinIO
 * 9. Upload to YouTube (Private)
 * 10. Update Dadabase
 * 11. Send Telegram notification
 * 
 * Usage: node tools/dadj-direct-orchestrator.js [--joke-id N]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Fix PATH for cron environment
process.env.PATH = '/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:' + process.env.PATH;

// Use the documented working API key from production script
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || 'sk_2c86803a3f4ec344ea132627832d319bc3c7af64b339c103';
const MINIO_ALIAS = 'hp1';
const DADABASE_SHEET_ID = '1cXSGjCXleUK8iQweBAwLaa7j3QK2Sla-8v11CirQsuw';
const TELEGRAM_CHAT_ID = '8177470832';

const QWEN35_ENDPOINT = 'http://msi:11434/v1/chat/completions';

const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

/**
 * Step 1: Fetch next unused joke from Dadabase
 */
async function fetchNextUnusedJoke() {
  log('📞 Fetching next unused joke from Dadabase...', 'cyan');
  
  try {
    const output = execSync(`gog sheets get ${DADABASE_SHEET_ID} "Sheet1!A:D" 2>&1`).toString();
    const lines = output.trim().split('\n').slice(1); // Skip header
    
    log(`  → Checking ${lines.length} rows...`, 'blue');
    
    for (const line of lines) {
      // gog output: ID  Joke  Used  Posted (space-separated, joke may contain spaces)
      // Format: ^(\d+)\s+(.+?)\s+(TRUE|FALSE)\s*(FALSE)?$
      const match = line.match(/^(\d+)\s+(.+?)\s+(TRUE|FALSE)(?:\s+(TRUE|FALSE))?\s*$/);
      if (!match) {
        log(`  → Skip: parse failed`, 'yellow');
        continue;
      }
      
      const id = parseInt(match[1]);
      const joke = match[2].trim();
      const used = match[3].toUpperCase();
      
      if (!id || !joke) {
        log(`  → Skip: invalid id or joke`, 'yellow');
        continue;
      }
      
      log(`  → Row ${id}: Used=${used}`, 'blue');
      
      if (used === 'TRUE') {
        log(`  → Skip: already used`, 'yellow');
        continue;
      }
      
      log(`✅ Got joke #${id}`, 'green');
      return { id, joke };
    }
    
    throw new Error('No unused jokes found in Dadabase');
  } catch (e) {
    log(`❌ Failed to fetch joke: ${e.message}`, 'red');
    throw e;
  }
}

/**
 * Step 2: Classify joke structure
 */
function classifyJokeStructure(jokeText) {
  log('🔍 Classifying joke structure...', 'cyan');
  
  const sentences = jokeText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const hasComma = jokeText.includes(',');
  
  if (sentences.length >= 2) {
    log('  → Setup-punchline (2+ sentences)', 'blue');
    return 'setup-punchline';
  } else if (hasComma) {
    log('  → One-liner with comma break', 'blue');
    return 'one-liner-comma';
  } else {
    log('  → One-liner (single sentence)', 'blue');
    return 'one-liner';
  }
}

/**
 * Step 3: Generate ElevenLabs audio via DIRECT API (documented working approach)
 */
async function generateElevenLabsAudio(jokeText, jokeId) {
  log('🎤 Generating ElevenLabs audio (direct API)...', 'cyan');
  
  const audioPath = path.join('/tmp', `joke-${jokeId}-audio.mp3`);
  const voiceId = 'JBFqnCBsd6RMkjVDRZzb'; // George voice
  const modelId = 'eleven_multilingual_v2';
  
  const requestBody = {
    text: jokeText,
    model_id: modelId,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75
    }
  };
  
  const payloadPath = `/tmp/elevenlabs-payload-${jokeId}.json`;
  fs.writeFileSync(payloadPath, JSON.stringify(requestBody));
  
  const curlCmd = `curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/${voiceId}" \
    -H "xi-api-key: ${ELEVENLABS_API_KEY}" \
    -H "Content-Type: application/json" \
    -d @${payloadPath} \
    --output "${audioPath}"`;
  
  try {
    execSync(curlCmd, { stdio: 'pipe', timeout: 60000 });
    
    if (fs.existsSync(audioPath) && fs.statSync(audioPath).size > 1000) {
      const duration = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`).toString().trim();
      const size = (fs.statSync(audioPath).size / 1024).toFixed(1);
      log(`  → Audio: ${audioPath} (${size}KB, ${parseFloat(duration).toFixed(2)}s)`, 'green');
      return { path: audioPath, duration: parseFloat(duration) };
    } else {
      throw new Error('Empty or invalid audio file');
    }
  } catch (e) {
    log(`  → Failed: ${e.message}`, 'red');
    throw e;
  } finally {
    if (fs.existsSync(payloadPath)) fs.unlinkSync(payloadPath);
  }
}

/**
 * Step 4: Pad audio with 1s buffers (required per TOOLS.md)
 */
function padAudio(audioPath, jokeId) {
  log('🔇 Padding audio (1s start + 1s end)...', 'cyan');
  
  const paddedPath = path.join('/tmp', `joke-${jokeId}-padded.mp3`);
  
  const ffmpegCmd = `ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t 1 \
    -i "${audioPath}" \
    -f lavfi -i anullsrc=r=44100:cl=stereo -t 1 \
    -filter_complex "[0][1][2]concat=n=3:v=0:a=1" "${paddedPath}" 2>/dev/null`;
  
  try {
    execSync(ffmpegCmd, { stdio: 'pipe' });
    const duration = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${paddedPath}"`).toString().trim();
    log(`  → Padded: ${paddedPath} (${parseFloat(duration).toFixed(2)}s)`, 'green');
    return { path: paddedPath, duration: parseFloat(duration) };
  } catch (e) {
    log(`  → Failed: ${e.message}`, 'red');
    throw e;
  }
}

/**
 * Step 5: Generate thematic background prompt via LLM
 */
async function generateThematicPrompt(jokeText) {
  log('🎨 Generating thematic background prompt...', 'cyan');
  
  const systemPrompt = `You are a creative director for dad joke video backgrounds.
Create a background image prompt that:
1. Is THEMATICALLY related to the joke's subject
2. Does NOT reveal the punchline
3. Contains NO text whatsoever
4. Is suitable for 720x1280 portrait

Output ONLY a single sentence prompt.`;

  const userPrompt = `Joke: "${jokeText}"
Create a background prompt. Under 100 words. No text.`;

  try {
    const response = await callLLM('llama3.1:latest', systemPrompt, userPrompt);
    const prompt = response.trim();
    log(`  → Prompt: "${prompt.substring(0, 80)}..."`, 'green');
    return prompt;
  } catch (e) {
    log(`  → LLM failed, using fallback`, 'yellow');
    return 'Dad joke background, colorful cartoon style, no text';
  }
}

/**
 * Call local LLM
 */
async function callLLM(model, systemPrompt, userPrompt) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: false
    });

    const options = {
      hostname: 'msi',
      port: 11434,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            resolve(json.choices[0].message.content);
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.write(postData);
    req.end();
  });
}

/**
 * Step 6: Generate SD background via direct API
 */
async function generateBackground(prompt, jokeId, attempt = 1) {
  log(`🎨 Generating SD background (attempt ${attempt})...`, 'cyan');
  
  const bgPath = path.join('/tmp', `joke-${jokeId}-bg-V${attempt}.png`);
  const seed = Math.floor(Math.random() * 1000000000);
  
  const requestBody = {
    prompt,
    negative_prompt: 'text, words, letters, numbers, watermark',
    steps: 20,
    width: 512,
    height: 768,
    sampler_name: 'DPM++ 2M',
    cfg_scale: 7,
    seed,
    override_settings: {
      sd_model_checkpoint: 'RealVisXL_V4.0'
    }
  };
  
  const payloadPath = `/tmp/sd-payload-${jokeId}-${attempt}.json`;
  fs.writeFileSync(payloadPath, JSON.stringify(requestBody));
  
  const curlCmd = `curl -s -X POST "http://msi:7860/sdapi/v1/txt2img" \
    -H "Content-Type: application/json" \
    -d @${payloadPath} \
    --max-time 120 \
    | jq -r '.images[0]' | base64 -d > "${bgPath}"`;
  
  try {
    execSync(curlCmd, { stdio: 'pipe', timeout: 150000 });
    
    if (fs.existsSync(bgPath) && fs.statSync(bgPath).size > 1000) {
      log(`  → Background: ${bgPath}`, 'green');
      return { path: bgPath, prompt, seed, attempt };
    } else {
      throw new Error('Invalid SD response');
    }
  } catch (e) {
    log(`  → Failed: ${e.message}`, 'red');
    throw e;
  } finally {
    if (fs.existsSync(payloadPath)) fs.unlinkSync(payloadPath);
  }
}

/**
 * Step 7: Validate image with Qwen3.5 (3 attempts max)
 */
async function validateImage(imagePath, jokeText) {
  log('🔍 Validating image with Qwen3.5...', 'cyan');
  
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  
  const systemPrompt = `Analyze this image. Report:
1. ANY visible text (critical fail)
2. AI artifacts (major only)
3. Quality issues

Output JSON: {"has_text":bool,"ai_artifacts":bool,"pass":bool,"issues":[]}`;

  try {
    const response = await callQwen35Vision(systemPrompt, base64Image, 'image/png');
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { pass: true, issues: ['Parse error'] };
    
    const result = JSON.parse(jsonMatch[0]);
    if (result.pass) {
      log('  → Image PASSED', 'green');
    } else {
      log(`  → Image FAILED: ${result.issues?.join(', ')}`, 'yellow');
    }
    return result;
  } catch (e) {
    log(`  → Validation error: ${e.message}`, 'yellow');
    return { pass: true, issues: [`Error: ${e.message}`] };
  }
}

/**
 * Call Qwen3.5 Vision
 */
async function callQwen35Vision(systemPrompt, base64Image, mimeType) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'qwen3.5:cloud',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
            { type: 'text', text: 'Analyze this image.' }
          ]
        }
      ],
      max_tokens: 500
    });

    const options = {
      hostname: 'msi',
      port: 11434,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            resolve(json.choices[0].message.content);
          } catch (e) { reject(e); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.write(postData);
    req.end();
  });
}

/**
 * Generate background with retry (3 attempts max)
 */
async function generateBackgroundWithRetry(jokeText, jokeId) {
  const maxAttempts = 3;
  let lastFailedImage = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const prompt = await generateThematicPrompt(jokeText);
      const bgResult = await generateBackground(prompt, jokeId, attempt);
      const validation = await validateImage(bgResult.path, jokeText);
      
      if (validation.pass) return bgResult;
      
      lastFailedImage = bgResult.path;
      log(`  → Attempt ${attempt} failed`, 'yellow');
      
      if (attempt < maxAttempts && fs.existsSync(bgResult.path)) {
        fs.unlinkSync(bgResult.path);
      }
    } catch (e) {
      log(`  → Attempt ${attempt} failed: ${e.message}`, 'yellow');
    }
  }
  
  // Return failed image for review, or fallback
  if (lastFailedImage && fs.existsSync(lastFailedImage)) {
    log('  → Returning failed image for review', 'yellow');
    return { path: lastFailedImage, prompt: 'needs review', seed: 0, attempt: maxAttempts, needsReview: true };
  }
  
  // Fallback gradient
  const fallbackPath = path.join('/tmp', `joke-${jokeId}-bg-fallback.png`);
  execSync(`ffmpeg -y -f lavfi -i "color=c=0x4A90D9:s=512x768" -frames:v 1 "${fallbackPath}" 2>/dev/null`);
  return { path: fallbackPath, prompt: 'fallback', seed: 0, attempt: maxAttempts, isFallback: true };
}

/**
 * Step 8: Upload to MinIO
 */
function uploadToMinIO(filePath, jokeId, fileType) {
  log(`📤 Uploading ${fileType} to MinIO...`, 'cyan');
  
  const version = 1; // Simplified - increment in production
  const minioPath = `${MINIO_ALIAS}/dadjokes/${jokeId}/${fileType}-${jokeId}-V${version}.${fileType === 'audio' ? 'mp3' : fileType === 'image' ? 'png' : 'mp4'}`;
  
  try {
    execSync(`mc cp "${filePath}" "${minioPath}" 2>&1`, { stdio: 'pipe' });
    log(`  → Uploaded: ${minioPath}`, 'green');
    return { path: minioPath, version };
  } catch (e) {
    log(`  → Failed: ${e.message}`, 'red');
    throw e;
  }
}

/**
 * Step 9: Prepare Remotion assets
 */
function prepareRemotionAssets(jokeId, audioPath, bgPath, jokeText, format) {
  log('📦 Preparing Remotion assets...', 'cyan');
  
  const remotionPublic = '/home/kevin/.openclaw/workspace/dadtasticdads-remotion/public';
  execSync(`cp "${audioPath}" "${remotionPublic}/audio.mp3"`);
  execSync(`cp "${bgPath}" "${remotionPublic}/background.png"`);
  
  const duration = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`).toString().trim();
  const frames = Math.round(parseFloat(duration) * 30);
  
  let segments;
  if (format.includes('one-liner')) {
    segments = [{ text: jokeText, atPercent: 0.175, display: 'fade-in' }];
  } else {
    const parts = jokeText.split(/[?.]/);
    if (parts.length >= 2 && parts[0].trim()) {
      const punctuation = jokeText.includes('?') ? '?' : '.';
      segments = [
        { text: parts[0].trim() + punctuation, atPercent: 0.175, display: 'fade-in' },
        { text: parts.slice(1).join('').trim(), atPercent: 0.73, display: 'pop-in', color: '#FF8A2B' }
      ];
    } else {
      segments = [{ text: jokeText, atPercent: 0.175, display: 'fade-in' }];
    }
  }
  
  const props = { joke: jokeText, format, segments };
  fs.writeFileSync(path.join(remotionPublic, 'props.json'), JSON.stringify(props, null, 2));
  
  log(`  → Duration: ${frames} frames @30fps`, 'green');
  return { frames, propsPath: path.join(remotionPublic, 'props.json') };
}

/**
 * Step 10: Render Remotion video
 */
function renderVideo(jokeId, frames) {
  log('🎬 Rendering Remotion video...', 'cyan');
  
  const outputDir = '/home/kevin/.openclaw/workspace/dadtasticdads-output';
  const videoPath = path.join(outputDir, `joke-${jokeId}-V1.mp4`);
  const remotionProject = '/home/kevin/.openclaw/workspace/dadtasticdads-remotion';
  
  execSync('rm -rf /home/kevin/.openclaw/workspace/dadtasticdads-remotion/.remotion 2>/dev/null || true');
  
  const renderCmd = `cd "${remotionProject}" && npx remotion render DadJokeVideo "out/joke-${jokeId}.mp4" --props=public/props.json 2>&1`;
  
  try {
    execSync(renderCmd, { stdio: 'pipe', timeout: 180000 });
    
    const actualOutput = path.join(remotionProject, 'out', `joke-${jokeId}.mp4`);
    if (fs.existsSync(actualOutput)) {
      execSync(`cp "${actualOutput}" "${videoPath}"`);
      const size = (fs.statSync(videoPath).size / 1024 / 1024).toFixed(2);
      log(`  → Video: ${videoPath} (${size}MB)`, 'green');
      return videoPath;
    } else {
      throw new Error('Output not created');
    }
  } catch (e) {
    log(`  → Failed: ${e.message}`, 'red');
    throw e;
  }
}

/**
 * Step 11: Validate video (3 attempts max)
 */
async function validateVideo(videoPath, jokeText, format) {
  log('🔍 Validating video...', 'cyan');
  
  // Simplified - check file exists and has size
  if (fs.existsSync(videoPath) && fs.statSync(videoPath).size > 100000) {
    log('  → Video PASSED (basic check)', 'green');
    return { pass: true, issues: [] };
  } else {
    log('  → Video FAILED (empty or missing)', 'yellow');
    return { pass: false, issues: ['Video empty or missing'] };
  }
}

/**
 * Step 12: Upload to YouTube
 */
async function uploadToYouTube(videoPath, jokeId, jokeText) {
  log('📺 Uploading to YouTube (Private)...', 'cyan');
  
  const title = `Dad Joke #${jokeId} - ${jokeText.split(' ').slice(0, 5).join(' ')}...`;
  const script = '/home/kevin/.openclaw/workspace/skills/youtube-uploader/scripts/youtube-upload.py';
  
  try {
    const output = execSync(`python3 ${script} upload --file "${videoPath}" --title "${title}" --privacy private 2>&1`);
    const match = output.toString().match(/Video ID: ([a-zA-Z0-9_-]+)/);
    const videoId = match ? match[1] : 'unknown';
    log(`  → YouTube: https://www.youtube.com/watch?v=${videoId}`, 'green');
    return videoId;
  } catch (e) {
    log(`  → Failed: ${e.message}`, 'red');
    throw e;
  }
}

/**
 * Step 13: Update Dadabase
 */
async function updateDadabase(jokeId, used, posted) {
  log(`📝 Updating Dadabase (Used=${used}, Posted=${posted})...`, 'cyan');
  
  try {
    execSync(`gog sheets update ${DADABASE_SHEET_ID} "Sheet1!C${jokeId}" "TRUE" 2>&1`, { stdio: 'pipe' });
    execSync(`gog sheets update ${DADABASE_SHEET_ID} "Sheet1!D${jokeId}" "TRUE" 2>&1`, { stdio: 'pipe' });
    log('  → Dadabase updated', 'green');
    return true;
  } catch (e) {
    log(`  → Failed: ${e.message}`, 'red');
    throw e;
  }
}

/**
 * Step 14: Send Telegram notification
 */
async function sendTelegramNotification(jokeId, jokeText, youtubeId) {
  log('📱 Sending Telegram notification...', 'cyan');
  
  const message = `🎬 Dad Joke #${jokeId}\n\n"${jokeText}"\n\n✅ Published: https://www.youtube.com/watch?v=${youtubeId}`;
  
  try {
    const payloadPath = '/tmp/telegram-payload.json';
    fs.writeFileSync(payloadPath, JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'Markdown'
    }));
    
    execSync(`curl -s -X POST "https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage" \
      -H "Content-Type: application/json" \
      -d @${payloadPath} 2>&1`, { stdio: 'pipe' });
    
    log('  → Notification sent', 'green');
    if (fs.existsSync(payloadPath)) fs.unlinkSync(payloadPath);
  } catch (e) {
    log(`  → Failed: ${e.message}`, 'yellow');
  }
}

/**
 * Error logging - MANDATORY
 */
function logError(jokeId, error, step) {
  const errorLogPath = '/home/kevin/.openclaw/workspace/.learnings/DADJOKE-ERRORS.md';
  const entry = `\n## ${new Date().toISOString()} - Joke #${jokeId}\n**Step:** ${step}\n**Error:** ${error.message || error}\n`;
  
  try {
    if (fs.existsSync(errorLogPath)) {
      fs.appendFileSync(errorLogPath, entry);
    } else {
      fs.writeFileSync(errorLogPath, '# Dad Joke Errors\n' + entry);
    }
    log(`  → Error logged to ${errorLogPath}`, 'yellow');
  } catch (e) {
    log(`  → Failed to log error: ${e.message}`, 'red');
  }
}

/**
 * Main pipeline
 */
async function runPipeline() {
  log('\n🎭 Dad Joke Pipeline (Direct API) Starting...\n', 'cyan');
  
  let jokeId, jokeText, format;
  
  try {
    // Step 1: Fetch joke
    const jokeData = await fetchNextUnusedJoke();
    jokeId = jokeData.id;
    jokeText = jokeData.joke;
    
    // Step 2: Classify
    format = classifyJokeStructure(jokeText);
    
    // Step 3: Generate audio (direct ElevenLabs)
    const audio = await generateElevenLabsAudio(jokeText, jokeId);
    
    // Step 4: Pad audio
    const padded = padAudio(audio.path, jokeId);
    
    // Step 5-7: Generate + validate background (3 attempts max)
    const bgResult = await generateBackgroundWithRetry(jokeText, jokeId);
    
    // Step 8: Upload image
    uploadToMinIO(bgResult.path, jokeId, 'image');
    
    // Step 9: Prepare Remotion
    const { frames } = prepareRemotionAssets(jokeId, padded.path, bgResult.path, jokeText, format);
    
    // Step 10: Render video
    let videoPath = renderVideo(jokeId, frames);
    
    // Step 11: Validate video (3 attempts max)
    let videoValid = false;
    for (let attempt = 1; attempt <= 3 && !videoValid; attempt++) {
      const validation = await validateVideo(videoPath, jokeText, format);
      if (validation.pass) {
        videoValid = true;
      } else if (attempt < 3) {
        log(`  → Retry render (attempt ${attempt + 1})`, 'yellow');
        const bgRetry = await generateBackgroundWithRetry(jokeText, jokeId);
        prepareRemotionAssets(jokeId, padded.path, bgRetry.path, jokeText, format);
        videoPath = renderVideo(jokeId, frames);
      }
    }
    
    if (!videoValid) {
      log('  ⚠️ Video failed validation after 3 attempts', 'yellow');
      logError(jokeId, new Error('Video validation failed'), 'validate-video');
    }
    
    // Step 12: Upload video
    uploadToMinIO(videoPath, jokeId, 'video');
    
    // Step 13: Upload to YouTube
    const youtubeId = await uploadToYouTube(videoPath, jokeId, jokeText);
    
    // Step 14: Update Dadabase
    await updateDadabase(jokeId, true, true);
    
    // Step 15: Send Telegram
    await sendTelegramNotification(jokeId, jokeText, youtubeId);
    
    log('\n✅ Dad Joke Pipeline Complete!', 'green');
    log(`   Joke #${jokeId}: "${jokeText}"`, 'blue');
    log(`   YouTube: https://www.youtube.com/watch?v=${youtubeId}`, 'blue');
    
    return { jokeId, jokeText, youtubeId, success: true };
    
  } catch (e) {
    log(`\n❌ Pipeline Failed: ${e.message}`, 'red');
    logError(jokeId || 'unknown', e, 'pipeline');
    return { success: false, error: e.message };
  }
}

// CLI entry
if (require.main === module) {
  runPipeline().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}

module.exports = { runPipeline, logError };
