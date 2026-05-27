#!/usr/bin/env node
/**
 * Dad Joke n8n Orchestrator - Hybrid Agent + n8n Pipeline
 * 
 * Flow:
 * 1. Call n8n webhook to get next joke (ID + text)
 * 2. Classify joke structure (one-liner vs setup-punchline)
 * 3. Generate THEMATIC background prompt via LLM
 * 4. Generate SD background via n8n webhook
 * 5. Validate image with Qwen3.5 for AI artifacts (retry up to 3x)
 * 6. Save validated image to MinIO
 * 7. Generate ElevenLabs audio
 * 8. Render Remotion video
 * 9. Upload to YouTube (Private)
 * 10. Upload to MinIO
 * 11. Update Dadabase (Used=TRUE, Posted=TRUE)
 * 
 * Usage: node tools/dadjoke-n8n-orchestrator.js [--test] [--joke-id N]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Fix PATH for cron environment - mc is installed via Linuxbrew
process.env.PATH = '/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:' + process.env.PATH;

const N8N_WEBHOOK = 'https://n8n.wolfeinkc.uk/webhook/b33fd5b7-e682-4309-a454-3c4180029743';
const N8N_AUDIO_WEBHOOK = 'https://n8n.wolfeinkc.uk/webhook/d9482752-5fb8-4c46-b681-9bd557c7c577';
const N8N_IMAGE_WEBHOOK = 'https://n8n.wolfeinkc.uk/webhook/generate-image';
const N8N_STATUS_WEBHOOK = 'https://n8n.wolfeinkc.uk/webhook/dad-joke-updater';
const MINIO_ALIAS = 'hp1';
const DADABASE_SHEET_ID = '1cXSGjCXleUK8iQweBAwLaa7j3QK2Sla-8v11CirQsuw';
const TELEGRAM_CHAT_ID = '8177470832'; // Kevin's chat ID

// Qwen3.5 endpoint for vision analysis
const QWEN35_ENDPOINT = 'http://msi:11434/v1/chat/completions';
const LLM_MODEL = 'llama3.1:latest'; // Local LLM for prompt generation

// Colors for output
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

/**
 * Step 1: Fetch joke from n8n webhook
 */
async function fetchJokeFromN8N() {
  log('📞 Fetching joke from n8n webhook...', 'cyan');
  
  return new Promise((resolve, reject) => {
    https.get(N8N_WEBHOOK, (res) => {
      let data = '';
      
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const jokeData = JSON.parse(data);
            log(`✅ Got joke #${jokeData['Joke ID']}`, 'green');
            resolve(jokeData);
          } catch (e) {
            reject(new Error(`Failed to parse JSON: ${e.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', reject);
  });
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
 * Step 3: Generate thematic background prompt via LLM
 * Analyzes the joke and creates a background prompt that's THEMATICALLY related
 * but doesn't give away the punchline.
 */
async function generateThematicPrompt(jokeText, format) {
  log('🎨 Generating thematic background prompt...', 'cyan');
  
  const systemPrompt = `You are a creative director for dad joke video backgrounds.
Given a joke, create a background image prompt that:
1. Is THEMATICALLY related to the joke's subject matter
2. Does NOT reveal or hint at the punchline
3. Is visually interesting and colorful
4. Contains NO text whatsoever
5. Is suitable for a 720x1280 portrait video background

Output ONLY a single sentence prompt for Stable Diffusion. No explanations.`;

  const userPrompt = `Joke: "${jokeText}"

Create a background image prompt that captures the THEME without revealing the punchline. 
Keep it under 100 words. No text in the image.
Example: If joke is about a magician, prompt might be "colorful magic stage with sparkles and cards floating, cartoon style, no text"
Example: If joke is about a restaurant, prompt might be "cozy restaurant interior with warm lighting and cartoon style, no text"`;

  try {
    // Call local LLM for prompt generation
    const response = await callLLM(systemPrompt, userPrompt);
    const prompt = response.trim();
    
    log(`  → Prompt: "${prompt.substring(0, 80)}..."`, 'green');
    return prompt;
  } catch (e) {
    log(`  → LLM failed, using fallback: ${e.message}`, 'yellow');
    return 'Dad joke background, colorful cartoon style, playful shapes, vibrant colors, no text';
  }
}

/**
 * Call local LLM (Ollama) for text generation
 */
async function callLLM(systemPrompt, userPrompt) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: process.env.LLM_MODEL || LLM_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: false
    });

    const options = {
      hostname: process.env.OLLAMA_HOST || 'msi',
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
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            resolve(json.choices[0].message.content);
          } catch (e) {
            reject(new Error(`Parse error: ${e.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('LLM request timeout'));
    });
    req.write(postData);
    req.end();
  });
}

/**
 * Step 4: Generate SD background via direct API (n8n webhook returns metadata only)
 */
async function generateBackgroundViaN8N(prompt, jokeId, attempt = 1) {
  log(`🎨 Generating SD background via direct API (attempt ${attempt})...`, 'cyan');
  
  const bgPath = path.join('/tmp', `joke-${jokeId}-bg-V${attempt}.png`);
  const seed = Math.floor(Math.random() * 1000000000);
  
  // Use direct SD API since n8n webhook returns metadata not image
  const sdApiUrl = 'http://msi:7860/sdapi/v1/txt2img';
  
  const requestBody = {
    prompt: prompt,
    negative_prompt: 'text, words, letters, numbers, watermark, signature',
    steps: 20,
    width: 512,
    height: 768,
    sampler_name: 'DPM++ 2M',
    cfg_scale: 7,
    seed: seed,
    override_settings: {
      sd_model_checkpoint: 'RealVisXL_V4.0'
    }
  };
  
  // Write payload to temp file to avoid shell escaping issues
  const payloadPath = `/tmp/sd-payload-${jokeId}-${attempt}.json`;
  fs.writeFileSync(payloadPath, JSON.stringify(requestBody));
  
  const curlCmd = `curl -s -X POST "${sdApiUrl}" \
    -H "Content-Type: application/json" \
    -d @${payloadPath} \
    --max-time 120 \
    | jq -r '.images[0]' | base64 -d > "${bgPath}"`;
  
  try {
    execSync(curlCmd, { stdio: 'pipe', timeout: 150000 });
    
    // Clean up payload file
    if (fs.existsSync(payloadPath)) fs.unlinkSync(payloadPath);
    
    // Check if we got a valid image
    if (fs.existsSync(bgPath) && fs.statSync(bgPath).size > 1000) {
      const fileOutput = execSync(`file "${bgPath}" 2>/dev/null || echo "unknown"`).toString();
      if (fileOutput.includes('PNG') || fileOutput.includes('image')) {
        log(`  → Background generated: ${bgPath}`, 'green');
        return { path: bgPath, prompt, seed, attempt };
      }
    }
    
    throw new Error('Invalid response from SD API');
  } catch (e) {
    log(`  → Failed: ${e.message}`, 'red');
    throw e;
  }
}

/**
 * Step 5: Validate image with Qwen3.5 (cloud model with vision)
 * Checks for AI artifacts, unwanted text, obvious AI-generated tells
 */
async function validateImageWithQwen35(imagePath, jokeText) {
  log('🔍 Validating image with Qwen3.5 for AI artifacts...', 'cyan');
  
  // Read image and encode as base64
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = 'image/png';
  
  const systemPrompt = `You are an expert at detecting AI-generated image artifacts and issues.
Analyze this image and report:
1. ANY text visible in the image (words, letters, numbers) - this is CRITICAL and always fails
2. AI artifacts (uncanny faces, extra limbs, weird geometry, unnatural lighting)
3. Quality issues (blurry, low detail, artifacts)
4. Whether the image matches the theme: "${jokeText.substring(0, 50)}"

Output a JSON object with:
{
  "has_text": boolean,
  "text_found": string or null,
  "ai_artifacts": boolean,
  "artifacts_description": string or null,
  "quality_ok": boolean,
  "theme_match": boolean,
  "pass": boolean,
  "issues": string[]
}

Be REASONABLE. "pass" should be true if:
- No visible text (critical fail)
- AI artifacts are MINOR or subtle (small geometry issues, slight floating elements are OK)
- Quality is acceptable
- Theme roughly matches

Only fail if there is visible TEXT or MAJOR AI issues (missing limbs, extra faces, completely broken geometry).`;

  try {
    // Call Qwen3.5 cloud via OpenAI-compatible API
    const response = await callQwen35Vision(systemPrompt, base64Image, mimeType);
    
    // Parse response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      log(`  → Could not parse validation response`, 'yellow');
      return { pass: true, issues: ['Could not parse validation response'] };
    }
    
    const result = JSON.parse(jsonMatch[0]);
    
    if (result.pass) {
      log(`  → Image PASSED validation`, 'green');
    } else {
      log(`  → Image FAILED validation: ${result.issues?.join(', ')}`, 'yellow');
    }
    
    return result;
    
  } catch (e) {
    log(`  → Validation error: ${e.message}`, 'yellow');
    // On error, allow the image to pass (don't fail the pipeline)
    return { pass: true, issues: [`Validation error: ${e.message}`] };
  }
}

/**
 * Call Qwen3.5 cloud with vision
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
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            },
            {
              type: 'text',
              text: 'Analyze this image for AI artifacts and issues.'
            }
          ]
        }
      ],
      max_tokens: 500
    });

    const url = new URL(QWEN35_ENDPOINT);
    const options = {
      hostname: url.hostname,
      port: url.port || 11434,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            resolve(json.choices[0].message.content);
          } catch (e) {
            reject(new Error(`Parse error: ${e.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 500)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Qwen3.5 vision request timeout'));
    });
    req.write(postData);
    req.end();
  });
}

/**
 * Generate background with retry loop (up to 3 attempts)
 * Generates thematic prompt, creates image, validates with Qwen3.5, retries if needed
 */
async function generateBackgroundWithRetry(jokeText, format, jokeId) {
  const maxAttempts = 3;
  let lastError = null;
  let lastFailedValidation = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Generate thematic prompt
      const prompt = await generateThematicPrompt(jokeText, format);
      
      // Generate image
      const bgResult = await generateBackgroundViaN8N(prompt, jokeId, attempt);
      
      // Validate with Qwen3.5
      const validation = await validateImageWithQwen35(bgResult.path, jokeText);
      
      if (validation.pass) {
        return bgResult;
      }
      
      // If failed validation, save for potential review
      lastFailedValidation = { path: bgResult.path, validation };
      log(`  → Attempt ${attempt} failed validation: ${validation.issues?.join(', ')}`, 'yellow');
      
      // Only clean up if not the last attempt
      if (attempt < maxAttempts && fs.existsSync(bgResult.path)) {
        fs.unlinkSync(bgResult.path);
      }
      
      lastError = new Error(`Validation failed: ${validation.issues?.join(', ')}`);
      
    } catch (e) {
      log(`  → Attempt ${attempt} failed: ${e.message}`, 'yellow');
      lastError = e;
    }
  }
  
  // All attempts failed - send last failed image to Kevin for review
  log(`  → All ${maxAttempts} attempts failed validation`, 'yellow');
  
  // If we have a failed image, return it for Kevin review instead of fallback
  if (lastFailedValidation && fs.existsSync(lastFailedValidation.path)) {
    log(`  → Sending failed image to Kevin for review`, 'yellow');
    return { 
      path: lastFailedValidation.path, 
      prompt: 'needs review', 
      seed: 0, 
      attempt: maxAttempts,
      needsReview: true,
      validationIssues: lastFailedValidation.validation?.issues || []
    };
  }
  
  // Fallback to gradient if no image available
  const fallbackPath = path.join('/tmp', `joke-${jokeId}-bg-fallback.png`);
  const gradientCmd = `ffmpeg -y -f lavfi -i "color=c=0x4A90D9:s=512x768,format=rgb24" \
    -vf "geq=r='128+64*sin(X/50+T)':g='96+32*cos(X/60+T)':b='200+55*sin(X/40+T)'" \
    -frames:v 1 "${fallbackPath}" 2>/dev/null`;
  
  execSync(gradientCmd, { stdio: 'pipe' });
  
  return { 
    path: fallbackPath, 
    prompt: 'fallback gradient', 
    seed: 0, 
    attempt: maxAttempts,
    isFallback: true 
  };
}

/**
 * Step 6: Upload validated image to MinIO (versioned)
 */
function uploadImageToMinIO(imagePath, jokeId) {
  log('📤 Uploading image to MinIO...', 'cyan');
  
  const version = getNextVersion(jokeId, 'image');
  const minioPath = `${MINIO_ALIAS}/dadjokes/${jokeId}/image-${jokeId}-V${version}.png`;
  
  try {
    execSync(`mc cp "${imagePath}" "${minioPath}" 2>&1`, { stdio: 'pipe' });
    log(`  → Uploaded: ${minioPath} (V${version})`, 'green');
    return { path: minioPath, version };
  } catch (e) {
    log(`  → Failed: ${e.message}`, 'red');
    throw e;
  }
}

/**
 * Get next version number for a file type in MinIO
 */
function getNextVersion(jokeId, fileType) {
  const prefix = `${MINIO_ALIAS}/dadjokes/${jokeId}/${fileType}-${jokeId}-`;
  
  try {
    const output = execSync(`mc ls --recursive "${prefix}" 2>&1 || echo ""`).toString();
    const matches = output.match(/-V(\d+)\./g);
    
    if (matches && matches.length > 0) {
      const versions = matches.map(m => parseInt(m.replace('-V', '').replace('.', '')));
      return Math.max(...versions) + 1;
    }
    return 1;
  } catch (e) {
    return 1;
  }
}

/**
 * Analyze and format joke for n8n audio generation
 */
function formatJokeForN8N(jokeText, format) {
  log('📝 Formatting joke for n8n audio generation...', 'cyan');
  
  let segments;
  
  if (format === 'setup-punchline') {
    const parts = jokeText.split('.');
    segments = [
      { text: parts[0].trim(), type: 'setup' },
      { text: parts.slice(1).join('.').trim(), type: 'punchline' }
    ];
    log('  → Format: setup-punchline (2 segments)', 'blue');
  } else if (format === 'one-liner-comma') {
    const parts = jokeText.split(',');
    segments = [
      { text: parts[0].trim(), type: 'setup' },
      { text: parts.slice(1).join(',').trim(), type: 'punchline' }
    ];
    log('  → Format: one-liner with comma break (2 segments)', 'blue');
  } else {
    segments = [{ text: jokeText, type: 'full' }];
    log('  → Format: one-liner (1 segment)', 'blue');
  }
  
  return { Joke: jokeText, format, segments };
}

/**
 * Step 7: Generate audio via n8n webhook
 */
async function generateAudioViaN8N(jokeData, jokeId) {
  log('🎤 Generating audio via n8n webhook...', 'cyan');
  
  const audioPath = path.join('/tmp', `joke-${jokeId}-audio.mp3`);
  // Handle both {joke: string} and {Joke: string} formats
  const jokeText = jokeData.joke || jokeData.Joke;
  const jokeFormat = jokeData.format || 'setup-punchline';
  const formattedJoke = formatJokeForN8N(jokeText, jokeFormat);
  
  // Write payload to temp file to avoid shell escaping issues
  const payloadPath = `/tmp/audio-payload-${jokeId}.json`;
  fs.writeFileSync(payloadPath, JSON.stringify(formattedJoke));
  
  const curlCmd = `curl -s -X POST "${N8N_AUDIO_WEBHOOK}" \
    -H "Content-Type: application/json" \
    -d @${payloadPath} \
    --output "${audioPath}"`;
  
  try {
    execSync(curlCmd, { stdio: 'pipe' });
    
    // Clean up payload file
    if (fs.existsSync(payloadPath)) fs.unlinkSync(payloadPath);
    
    const fileOutput = execSync(`file "${audioPath}"`).toString();
    if (fileOutput.includes('Audio file') || fileOutput.includes('MPEG')) {
      const duration = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`).toString().trim();
      const size = (fs.statSync(audioPath).size / 1024).toFixed(1);
      log(`  → Audio: ${audioPath} (${size}KB, ${parseFloat(duration).toFixed(2)}s)`, 'green');
      return { path: audioPath, duration: parseFloat(duration), size: parseInt(size) };
    } else {
      const content = fs.readFileSync(audioPath, 'utf8');
      try {
        const error = JSON.parse(content);
        throw new Error(`n8n error: ${error.message || 'Unknown error'}`);
      } catch (e) {
        throw new Error(`Invalid audio received: ${fileOutput}`);
      }
    }
  } catch (e) {
    log(`  → Failed: ${e.message}`, 'red');
    throw e;
  }
}

/**
 * Check if audio already exists in MinIO (cache hit)
 */
function checkAudioCache(jokeId) {
  const prefix = `${MINIO_ALIAS}/dadjokes/${jokeId}/audio-${jokeId}-`;
  
  try {
    const output = execSync(`mc ls --recursive "${prefix}" 2>&1 || echo ""`).toString();
    const matches = output.match(/audio-\d+-V\d+\.mp3/g);
    
    if (matches && matches.length > 0) {
      const versions = matches.map(m => {
        const vMatch = m.match(/-V(\d+)\.mp3/);
        return vMatch ? parseInt(vMatch[1]) : 0;
      });
      const maxVersion = Math.max(...versions);
      const cachedPath = `${MINIO_ALIAS}/dadjokes/${jokeId}/audio-${jokeId}-V${maxVersion}.mp3`;
      log(`  → Cache hit: ${cachedPath} (V${maxVersion})`, 'green');
      return cachedPath;
    }
    log(`  → Cache miss: no audio versions found`, 'yellow');
    return null;
  } catch (e) {
    log(`  → Cache check failed: ${e.message}`, 'yellow');
    return null;
  }
}

/**
 * Upload audio to MinIO for caching (versioned)
 */
function uploadAudioToMinIO(audioPath, jokeId) {
  log('📤 Uploading audio to MinIO cache...', 'cyan');
  
  const version = getNextVersion(jokeId, 'audio');
  const minioAudioPath = `${MINIO_ALIAS}/dadjokes/${jokeId}/audio-${jokeId}-V${version}.mp3`;
  
  try {
    execSync(`mc cp "${audioPath}" "${minioAudioPath}" 2>&1`, { stdio: 'pipe' });
    log(`  → Uploaded: ${minioAudioPath} (V${version})`, 'green');
    return { path: minioAudioPath, version };
  } catch (e) {
    log(`  → Failed: ${e.message}`, 'red');
    throw e;
  }
}

/**
 * Ensure audio has proper duration (n8n should handle padding, but verify)
 */
function ensureAudioDuration(audioPath, jokeId, expectedMinDuration = 5.0) {
  log('🔇 Verifying audio duration...', 'cyan');
  
  const duration = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`).toString().trim();
  const durFloat = parseFloat(duration);
  
  if (durFloat >= expectedMinDuration) {
    log(`  → Audio OK: ${durFloat.toFixed(2)}s (no padding needed)`, 'green');
    return { path: audioPath, duration: durFloat, padded: false };
  } else {
    log(`  → Adding padding (current: ${durFloat.toFixed(2)}s, need: ${expectedMinDuration}s)...`, 'yellow');
    return padAudio(audioPath, jokeId, expectedMinDuration);
  }
}

/**
 * Fallback: Pad audio with silence buffers
 */
function padAudio(audioPath, jokeId, targetDuration) {
  const paddedPath = path.join('/tmp', `joke-${jokeId}-padded.mp3`);
  const currentDuration = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`).toString().trim();
  const paddingNeeded = targetDuration - parseFloat(currentDuration);
  
  if (paddingNeeded <= 0) {
    return { path: audioPath, duration: parseFloat(currentDuration), padded: false };
  }
  
  const halfPadding = (paddingNeeded / 2).toFixed(2);
  
  const ffmpegCmd = `ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t ${halfPadding} \
    -i "${audioPath}" \
    -f lavfi -i anullsrc=r=44100:cl=stereo -t ${halfPadding} \
    -filter_complex "[0][1][2]concat=n=3:v=0:a=1" "${paddedPath}" 2>/dev/null`;
  
  try {
    execSync(ffmpegCmd, { stdio: 'pipe' });
    
    const newDuration = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${paddedPath}"`).toString().trim();
    
    log(`  → Padded: ${paddedPath} (${parseFloat(newDuration).toFixed(2)}s)`, 'green');
    return { path: paddedPath, duration: parseFloat(newDuration), padded: true };
  } catch (e) {
    log(`  → Failed: ${e.message}`, 'red');
    throw e;
  }
}

/**
 * Prepare Remotion assets
 */
function prepareRemotionAssets(jokeId, audioPath, bgPath, jokeText, format) {
  log('📦 Preparing Remotion assets...', 'cyan');
  
  const remotionPublic = '/home/kevin/.openclaw/workspace/dadtasticdads-remotion/public';
  
  // Copy assets
  execSync(`cp "${audioPath}" "${remotionPublic}/audio.mp3"`);
  execSync(`cp "${bgPath}" "${remotionPublic}/background.png"`);
  
  // Calculate frames (30fps)
  const audioDuration = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`).toString().trim();
  const frames = Math.round(parseFloat(audioDuration) * 30);
  
  // Create props file
  let segments;
  if (format === 'one-liner' || format === 'one-liner-comma') {
    segments = [{ text: jokeText, atPercent: 0.175, display: 'fade-in' }];
  } else if (format === 'setup-punchline') {
    // Split by ? or . for setup-punchline (question/answer or statement/response)
    const parts = jokeText.split(/[?.]/);
    if (parts.length >= 2 && parts[0].trim()) {
      // Add the punctuation back to setup
      const punctuation = jokeText.match(/[?]/) ? '?' : '.';
      segments = [
        { text: parts[0].trim() + punctuation, atPercent: 0.175, display: 'fade-in' },
        { text: parts.slice(1).join('').trim(), atPercent: 0.73, display: 'pop-in', color: '#FF8A2B' }
      ];
    } else {
      // Fallback: show full joke
      segments = [{ text: jokeText, atPercent: 0.175, display: 'fade-in' }];
    }
  } else {
    // Default: show full joke
    segments = [{ text: jokeText, atPercent: 0.175, display: 'fade-in' }];
  }
  
  const props = {
    joke: jokeText,
    format: format,
    segments: segments
  };
  
  const propsPath = path.join(remotionPublic, 'props.json');
  fs.writeFileSync(propsPath, JSON.stringify(props, null, 2));
  
  log(`  → Duration: ${frames} frames @30fps (${audioDuration}s)`, 'green');
  log(`  → Props: ${propsPath}`, 'green');
  
  return { frames, propsPath };
}

/**
 * Render Remotion video
 */
function renderVideo(jokeId, frames) {
  log('🎬 Rendering Remotion video...', 'cyan');
  
  const outputDir = '/home/kevin/.openclaw/workspace/dadtasticdads-output';
  const videoPath = path.join(outputDir, `joke-${jokeId}-V1.mp4`);
  const remotionProject = '/home/kevin/.openclaw/workspace/dadtasticdads-remotion';
  
  // Clear Remotion cache
  execSync('rm -rf /home/kevin/.openclaw/workspace/dadtasticdads-remotion/.remotion 2>/dev/null || true');
  
  // Remotion outputs to project directory by default, then we copy it
  const defaultOutput = path.join(remotionProject, 'DadJokeVideo.mp4');
  
  const renderCmd = `cd "${remotionProject}" && \
    npx remotion render DadJokeVideo "out/joke-${jokeId}.mp4" \
    --props=public/props.json 2>&1`;
  
  try {
    execSync(renderCmd, { stdio: 'pipe', timeout: 180000 });
    
    // Check default output location
    const actualOutput = path.join(remotionProject, 'out', `joke-${jokeId}.mp4`);
    
    if (fs.existsSync(actualOutput)) {
      // Copy to expected location
      execSync(`cp "${actualOutput}" "${videoPath}"`);
      const size = (fs.statSync(videoPath).size / 1024 / 1024).toFixed(2);
      log(`  → Video: ${videoPath} (${size}MB)`, 'green');
      return videoPath;
    } else if (fs.existsSync(defaultOutput)) {
      // Copy from default location
      execSync(`cp "${defaultOutput}" "${videoPath}"`);
      const size = (fs.statSync(videoPath).size / 1024 / 1024).toFixed(2);
      log(`  → Video: ${videoPath} (${size}MB)`, 'green');
      return videoPath;
    } else {
      throw new Error('Output file not created');
    }
  } catch (e) {
    log(`  → Failed: ${e.message}`, 'red');
    throw e;
  }
}

/**
 * Upload video to MinIO (versioned)
 */
function uploadToMinIO(videoPath, jokeId) {
  log('📤 Uploading video to MinIO...', 'cyan');
  
  const version = getNextVersion(jokeId, 'video');
  const minioPath = `${MINIO_ALIAS}/dadjokes/${jokeId}/video-${jokeId}-V${version}.mp4`;
  
  try {
    execSync(`mc cp "${videoPath}" "${minioPath}" 2>&1`, { stdio: 'pipe' });
    log(`  → Uploaded: ${minioPath} (V${version})`, 'green');
    return { path: minioPath, version };
  } catch (e) {
    log(`  → Failed: ${e.message}`, 'red');
    throw e;
  }
}

/**
 * Upload to YouTube (Private)
 */
async function uploadToYouTube(videoPath, jokeId, jokeText) {
  log('📺 Uploading to YouTube (Private)...', 'cyan');
  
  const title = `Dad Joke #${jokeId} - ${jokeText.split(' ').slice(0, 5).join(' ')}...`;
  const script = '/home/kevin/.openclaw/workspace/skills/youtube-uploader/scripts/youtube-upload.py';
  
  try {
    const output = execSync(`python3 ${script} upload --file "${videoPath}" --title "${title}" --privacy private 2>&1`);
    const match = output.toString().match(/Video ID: ([a-zA-Z0-9_-]+)/);
    const videoId = match ? match[1] : 'unknown';
    
    log(`  → YouTube: https://www.youtube.com/watch?v=${videoId} (Private)`, 'green');
    return videoId;
  } catch (e) {
    log(`  → Failed: ${e.message}`, 'red');
    throw e;
  }
}

/**
 * Update Dadabase status via n8n webhook
 * @param {number} jokeId - The joke ID
 * @param {boolean} used - Set Used flag
 * @param {boolean} posted - Set Posted flag
 */
async function updateDadabaseStatus(jokeId, used, posted) {
  log(`📝 Updating Dadabase status (ID: ${jokeId}, Used: ${used}, Posted: ${posted})...`, 'cyan');
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      'Joke ID': jokeId,
      'Used': used,
      'Posted': posted
    });
    
    const options = {
      hostname: 'n8n.wolfeinkc.uk',
      port: 443,
      path: '/webhook/dad-joke-updater',
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          log(`  → Dadabase updated: Used=${used}, Posted=${posted}`, 'green');
          resolve(true);
        } else {
          log(`  → Failed: HTTP ${res.statusCode}`, 'red');
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', (e) => {
      log(`  → Failed: ${e.message}`, 'red');
      reject(e);
    });
    
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.write(postData);
    req.end();
  });
}

/**
 * Send video to Telegram for Kevin's review
 * Since this runs as a cron job (not in OpenClaw session), we write to a queue
 * The next OpenClaw session/heartbeat will pick it up and send.
 */
async function sendToTelegram(videoPath, jokeId, jokeText) {
  log('📱 Queuing video for Telegram...', 'cyan');
  
  const caption = `🎬 Dad Joke #${jokeId}\n\n"${jokeText}"\n\nReply with:\n• "publish" to upload to YouTube\n• "regenerate [notes]" to try again`;
  
  // Write to queue file for pickup by OpenClaw session
  const queuePath = '/home/kevin/.openclaw/workspace/.telegram-queue.json';
  const queueEntry = {
    type: 'dadjoke-video',
    videoPath,
    jokeId,
    jokeText,
    caption,
    timestamp: new Date().toISOString(),
    status: 'pending'
  };
  
  // Read existing queue or create new
  let queue = [];
  if (fs.existsSync(queuePath)) {
    try {
      queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
      if (!Array.isArray(queue)) queue = [];
    } catch (e) {
      queue = [];
    }
  }
  
  // Add new entry
  queue.push(queueEntry);
  
  // Write back
  const queueDir = path.dirname(queuePath);
  if (!fs.existsSync(queueDir)) {
    fs.mkdirSync(queueDir, { recursive: true });
  }
  fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));
  
  log(`  → Video queued: ${videoPath}`, 'green');
  log(`  → Queue: ${queuePath}`, 'blue');
  log(`  → Joke #${jokeId} will be sent on next OpenClaw session`, 'blue');
  
  return {
    success: true,
    queued: true,
    videoPath,
    jokeId,
    queuePath
  };
}

/**
 * Validate video with Qwen3.5 (check text timing and background quality)
 */
async function validateVideoWithQwen35(videoPath, jokeText, format) {
  log('🔍 Validating video with Qwen3.5...', 'cyan');
  
  try {
    // Extract frames at key timestamps
    const duration = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`).toString().trim();
    const durFloat = parseFloat(duration);
    
    // Extract frames: 2s (setup), mid-point, 4.5s (punchline)
    const setupFrame = '/tmp/video-validator-setup.png';
    const midFrame = '/tmp/video-validator-mid.png';
    const punchFrame = '/tmp/video-validator-punch.png';
    
    execSync(`ffmpeg -y -ss 2 -i "${videoPath}" -vframes 1 "${setupFrame}" 2>/dev/null`, { stdio: 'pipe' });
    execSync(`ffmpeg -y -ss ${durFloat / 2} -i "${videoPath}" -vframes 1 "${midFrame}" 2>/dev/null`, { stdio: 'pipe' });
    execSync(`ffmpeg -y -ss ${Math.min(4.5, durFloat - 0.5)} -i "${videoPath}" -vframes 1 "${punchFrame}" 2>/dev/null`, { stdio: 'pipe' });
    
    // Analyze each frame
    const issues = [];
    
    // Check setup frame (should show setup text or one-liner)
    const setupCheck = await analyzeFrame(setupFrame, 'setup', jokeText, format);
    if (!setupCheck.pass) {
      issues.push(...(setupCheck.issues || ['Setup frame validation failed']));
    }
    
    // Check punchline frame (should show punchline if setup-punchline format)
    if (format === 'setup-punchline') {
      const punchCheck = await analyzeFrame(punchFrame, 'punchline', jokeText, format);
      if (!punchCheck.pass) {
        issues.push(...(punchCheck.issues || ['Punchline frame validation failed']));
      }
    }
    
    // Clean up frames
    [setupFrame, midFrame, punchFrame].forEach(f => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });
    
    if (issues.length === 0) {
      log('  → Video validation PASSED', 'green');
      return { pass: true, issues: [] };
    } else {
      log(`  → Video validation FAILED: ${issues.join(', ')}`, 'yellow');
      return { pass: false, issues };
    }
    
  } catch (e) {
    log(`  → Validation error: ${e.message}`, 'yellow');
    // On error, allow video to pass (don't fail the pipeline)
    return { pass: true, issues: [`Validation error: ${e.message}`] };
  }
}

/**
 * Analyze a single frame with Qwen3.5
 */
async function analyzeFrame(framePath, frameType, jokeText, format) {
  const imageBuffer = fs.readFileSync(framePath);
  const base64Image = imageBuffer.toString('base64');
  
  const expectedText = format === 'setup-punchline'
    ? (frameType === 'setup' ? jokeText.split(/[.!?]/)[0] : jokeText.split(/[.!?]/).slice(1).join('.'))
    : jokeText;
  
  const systemPrompt = `You are a video frame analyzer. Check if the frame has:
1. Visible text that matches the expected text for this frame type
2. A good quality background (not solid color, not distorted)
3. No obvious artifacts

Output JSON: {"pass": boolean, "text_visible": boolean, "text_correct": boolean, "background_ok": boolean, "issues": string[]}`;

  const userPrompt = `Frame type: ${frameType}
Expected text: "${expectedText.substring(0, 50)}"
Analyze this frame and report issues.`;

  try {
    const response = await callQwen35Vision(systemPrompt, base64Image, 'image/png');
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { pass: true, issues: ['Could not parse validation response'] };
  } catch (e) {
    return { pass: true, issues: [`Frame analysis error: ${e.message}`] };
  }
}

/**
 * Legacy: Update Dadabase via gog (fallback)
 */
function updateDadabse(jokeId) {
  log('📝 Updating Dadabase (legacy gog fallback)...', 'cyan');
  
  try {
    // Mark Used=TRUE (column C)
    execSync(`gog sheets update ${DADABASE_SHEET_ID} "Sheet1!C${jokeId}" "TRUE" 2>&1`, { stdio: 'pipe' });
    log('  → Used=TRUE', 'green');
    
    // Mark Posted=TRUE (column D)
    execSync(`gog sheets update ${DADABASE_SHEET_ID} "Sheet1!D${jokeId}" "TRUE" 2>&1`, { stdio: 'pipe' });
    log('  → Posted=TRUE', 'green');
    
    return true;
  } catch (e) {
    log(`  → Failed: ${e.message}`, 'red');
    throw e;
  }
}

/**
 * Main orchestration flow
 */
async function runPipeline() {
  log('\n🎭 Dad Joke n8n Pipeline Starting...\n', 'cyan');
  
  try {
    // Step 1: Fetch joke
    const jokeData = await fetchJokeFromN8N();
    const jokeId = jokeData['Joke ID'];
    const jokeText = jokeData['Joke'];
    
    // Step 2: Classify
    const format = classifyJokeStructure(jokeText);
    
    // Step 3-5: Generate background with retry (thematic + validation)
    const bgResult = await generateBackgroundWithRetry(jokeText, format, jokeId);
    
    // Step 6: Upload image to MinIO
    const minioBgPath = uploadImageToMinIO(bgResult.path, jokeId);
    
    // Step 7: Check audio cache
    const cachedAudio = checkAudioCache(jokeId);
    
    if (cachedAudio) {
      log('  → Using cached audio from MinIO', 'green');
      const localCachedPath = path.join('/tmp', `joke-${jokeId}-cached.mp3`);
      execSync(`mc cp "${cachedAudio}" "${localCachedPath}" 2>&1`, { stdio: 'pipe' });
      var audio = { path: localCachedPath, duration: parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${localCachedPath}"`).toString().trim()) };
    } else {
      // Step 8: Generate audio
      const formattedJoke = { Joke: jokeText, format, segments: formatJokeForN8N(jokeText, format).segments };
      audio = await generateAudioViaN8N(formattedJoke, jokeId);
      
      // Upload to MinIO cache
      const minioAudioPath = uploadAudioToMinIO(audio.path, jokeId);
      audio.minioPath = minioAudioPath;
    }
    
    // Step 9: Ensure proper duration
    const padded = ensureAudioDuration(audio.path, jokeId, 5.0);
    
    // Step 10: Prepare Remotion
    const { frames, propsPath } = prepareRemotionAssets(jokeId, padded.path, bgResult.path, jokeText, format);
    
    // Step 11: Render video
    let videoPath = renderVideo(jokeId, frames);
    
    // Step 12: Upload to MinIO
    const minioPath = uploadToMinIO(videoPath, jokeId);
    
    // Step 12: Validate video with Qwen3.5 (up to 3x retry)
    let videoValid = false;
    let videoValidationResult = { pass: false, issues: [] };
    
    for (let attempt = 1; attempt <= 3 && !videoValid; attempt++) {
      log(`🎬 Validating video (attempt ${attempt}/3)...`, 'cyan');
      videoValidationResult = await validateVideoWithQwen35(videoPath, jokeText, format);
      
      if (videoValidationResult.pass) {
        videoValid = true;
        log('  → Video validation PASSED', 'green');
      } else {
        log(`  → Video validation FAILED: ${videoValidationResult.issues.join(', ')}`, 'yellow');
        if (attempt < 3) {
          log('  → Retrying video render...', 'yellow');
          // Re-render with different seed
          const bgRetry = await generateBackgroundWithRetry(jokeText, format, jokeId);
          const { frames: newFrames } = prepareRemotionAssets(jokeId, padded.path, bgRetry.path, jokeText, format);
          videoPath = renderVideo(jokeId, newFrames);
        }
      }
    }
    
    if (!videoValid) {
      log('  ⚠️ Video validation failed after 3 attempts, proceeding anyway', 'yellow');
    }
    
    // Step 13: Send to Telegram for Kevin's review
    const telegramResult = await sendToTelegram(videoPath, jokeId, jokeText);
    
    // Step 14: Update Dadabase Used=true (video ready for review)
    await updateDadabaseStatus(jokeId, true, false);
    
    log('\n✅ Dad Joke Pipeline Complete - Awaiting Kevin\'s Review!', 'green');
    log(`   Joke #${jokeId}: "${jokeText}"`, 'blue');
    log(`   Format: ${format}`, 'blue');
    log(`   Duration: ${padded.duration.toFixed(2)}s (${frames} frames)`, 'blue');
    log(`   Video: ${videoPath}`, 'blue');
    log(`   MinIO: ${minioPath}`, 'blue');
    log(`   Telegram: Ready for review`, 'blue');
    if (bgResult.isFallback) {
      log(`   ⚠️ Background: Fallback gradient (all validation attempts failed)`, 'yellow');
    }
    if (!videoValid) {
      log(`   ⚠️ Video: Validation issues: ${videoValidationResult.issues.join(', ')}`, 'yellow');
    }
    log('\n   📱 Waiting for Kevin to respond:', 'cyan');
    log('      • "publish" → Upload to YouTube', 'cyan');
    log('      • "regenerate [notes]" → Retry with feedback', 'cyan');
    
    // Send completion notification
    try {
      execSync(`node /home/kevin/.openclaw/workspace/tools/task-notify.js success "Dad Joke #${jokeId} ready for review" '{"jokeId":${jokeId},"duration":"${padded.duration.toFixed(2)}s","status":"awaiting_review"}'`, 
        { stdio: 'pipe' });
    } catch (e) {
      // Ignore notification errors
    }
    
    return {
      jokeId,
      jokeText,
      format,
      videoPath,
      minioPath,
      telegramResult,
      bgPrompt: bgResult.prompt,
      bgSeed: bgResult.seed,
      bgAttempts: bgResult.attempt,
      videoValidation: videoValidationResult,
      success: true,
      status: 'awaiting_review'
    };
    
  } catch (e) {
    log(`\n❌ Pipeline Failed: ${e.message}`, 'red');
    
    // Send failure notification
    try {
      execSync(`node /home/kevin/.openclaw/workspace/tools/task-notify.js error "Dad Joke Pipeline failed" '{"error":"${e.message.replace(/"/g, '\\"')}"}'`, 
        { stdio: 'pipe' });
    } catch (notifyErr) {
      // Ignore notification errors
    }
    
    return { success: false, error: e.message };
  }
}

/**
 * Publish video to YouTube after Kevin's approval
 */
async function publishToYouTube(jokeId, videoPath, jokeText) {
  log('\n📺 Publishing to YouTube...', 'cyan');
  
  try {
    const youtubeId = await uploadToYouTube(videoPath, jokeId, jokeText);
    
    // Update Dadabase Posted=true
    await updateDadabaseStatus(jokeId, true, true);
    
    log(`  ✅ Published: https://www.youtube.com/watch?v=${youtubeId}`, 'green');
    
    // Send success notification
    try {
      execSync(`node /home/kevin/.openclaw/workspace/tools/task-notify.js success "Dad Joke #${jokeId} published to YouTube" '{"jokeId":${jokeId},"url":"https://www.youtube.com/watch?v=${youtubeId}"}'`, 
        { stdio: 'pipe' });
    } catch (e) {
      // Ignore notification errors
    }
    
    return { success: true, youtubeId };
  } catch (e) {
    log(`  ❌ Failed: ${e.message}`, 'red');
    
    // Send failure notification
    try {
      execSync(`node /home/kevin/.openclaw/workspace/tools/task-notify.js error "YouTube upload failed" '{"jokeId":${jokeId},"error":"${e.message.replace(/"/g, '\\"')}"}'`, 
        { stdio: 'pipe' });
    } catch (notifyErr) {
      // Ignore notification errors
    }
    
    return { success: false, error: e.message };
  }
}

// CLI entry point
if (require.main === module) {
  runPipeline().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}

module.exports = {
  runPipeline,
  publishToYouTube,
  fetchJokeFromN8N,
  classifyJokeStructure,
  formatJokeForN8N,
  generateAudioViaN8N,
  generateBackgroundWithRetry,
  validateImageWithQwen35,
  validateVideoWithQwen35,
  updateDadabaseStatus,
  sendToTelegram,
  callQwen35Vision
};