#!/usr/bin/env node
/**
 * Regenerate Joke #19 with improved quality settings
 * Joke: "I used to hate facial hair, but then it grew on me."
 */

const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const execAsync = promisify(exec);

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
  hereNowApiKey: '43818e0ae2d23aeaad3e2d5cd6e4c17c0b0eaeaf071c04c9a1f521722ce29c12',
};

const JOKE_19 = {
  id: '19',
  text: "I used to hate facial hair, but then it grew on me.",
  format: 'one-liner',
  segments: [{ text: "I used to hate facial hair, but then it grew on me.", atPercent: 0, display: 'fade-in' }]
};

function log(message, level = 'info') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function callOllama(model, prompt) {
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

async function generateAudio(text) {
  const audioFile = path.join(CONFIG.outputDir, `audio-joke19.mp3`);
  const cacheFile = path.join(CONFIG.outputDir, 'cache', 'audio-joke19.mp3');
  
  // Check cache
  if (fs.existsSync(cacheFile)) {
    fs.copyFileSync(cacheFile, audioFile);
    const duration = await new Promise((resolve) => {
      exec(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${audioFile}"`, 
        (err, stdout) => resolve(parseFloat(stdout.trim())));
    });
    return { file: audioFile, duration, cached: true };
  }
  
  // Generate via ElevenLabs
  const ttsPayload = {
    text,
    model_id: CONFIG.modelId,
    voice_settings: { stability: 0.5, similarity_boost: 0.75 },
  };
  const payloadFile = `${audioFile}.json`;
  fs.writeFileSync(payloadFile, JSON.stringify(ttsPayload));
  
  await new Promise((resolve, reject) => {
    exec(`curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/${CONFIG.voiceId}" ` +
      `-H "xi-api-key: ${CONFIG.elevenLabsApiKey}" ` +
      `-H "Content-Type: application/json" ` +
      `-d @${payloadFile} -o "${audioFile}"`, 
      (err) => {
        fs.unlinkSync(payloadFile);
        if (err) reject(err);
        else resolve();
      });
  });
  
  // Cache it
  fs.copyFileSync(audioFile, cacheFile);
  
  const duration = await new Promise((resolve) => {
    exec(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${audioFile}"`, 
      (err, stdout) => resolve(parseFloat(stdout.trim())));
  });
  
  return { file: audioFile, duration, cached: false };
}

async function generateImagePrompt(joke) {
  // FIXED: Better prompt engineering - avoid literal pun interpretations
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

async function generateImage(prompt) {
  const filename = `bg-joke19-regen.png`;
  const filepath = path.join(CONFIG.outputDir, filename);
  const b64File = `${filepath}.b64`;
  const sdPayloadFile = `${filepath}.payload.json`;
  
  log('Generating SD image (512x768, 25 steps, DPM++ 2M Karras)...');
  
  // FIXED: Enhanced prompt with negative prompts
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
  
  execSync(`curl -s -X POST "${CONFIG.stableDiffusionUrl}/sdapi/v1/txt2img" -H "Content-Type: application/json" -d @${sdPayloadFile} | jq -r '.images[0]' > "${b64File}"`);
  
  for (let i = 0; i < 300; i++) {
    await sleep(1000);
    if (i % 10 === 0) {
      try {
        const p = await fetch(`${CONFIG.stableDiffusionUrl}/sdapi/v1/progress`).then(r => r.json());
        if (p.progress) log(`   SD: ${Math.round(p.progress * 100)}%`);
      } catch {}
    }
    try {
      const stats = fs.statSync(b64File);
      if (stats.size > 50000) {
        const b64 = fs.readFileSync(b64File, 'utf8').trim();
        if (b64.startsWith('iVBOR')) {
          fs.writeFileSync(filepath, Buffer.from(b64, 'base64'));
          fs.unlinkSync(b64File);
          fs.unlinkSync(sdPayloadFile);
          const s = fs.statSync(filepath);
          log(`Image: ${(s.size/1024/1024).toFixed(2)}MB`);
          return filepath;
        }
      }
    } catch {}
  }
  
  throw new Error('SD timeout');
}

async function renderVideo(joke, format, segments, audioFile, imageFile, duration) {
  const videoName = `DadJokeVideo.mp4`;
  const videoFile = path.join(CONFIG.outputDir, `dadjoke-19-regen.mp4`);
  
  // Clean up any existing output
  try { fs.unlinkSync(path.join(CONFIG.remotionProject, videoName)); } catch {}
  
  fs.copyFileSync(imageFile, path.join(CONFIG.remotionProject, 'public', 'background.png'));
  fs.copyFileSync(audioFile, path.join(CONFIG.remotionProject, 'public', 'audio.mp3'));
  
  const frames = Math.floor(duration * 30) + 60;
  
  const propsArg = JSON.stringify({
    joke, 
    format, 
    segments,  
    audioUrl: 'audio.mp3',
    imageUrl: 'background.png',
  }).replace(/"/g, '\\"');
  
  return new Promise((resolve, reject) => {
    const publicDir = path.join(CONFIG.remotionProject, 'public');
    const cmd = `cd ${CONFIG.remotionProject} && npx remotion render "DadJokeVideo" "DadJokeVideo" "${videoName}" --props="${propsArg}" --public-dir="${publicDir}" --duration-in-frames=${frames} --fps=30 --width=720 --height=1280`;
    
    exec(cmd, { timeout: 300000 }, async (err) => {
      if (err) { reject(new Error(`Remotion: ${err.message}`)); return; }
      
      const remotionOut = path.join(CONFIG.remotionProject, videoName);
      
      for (let i = 0; i < 10; i++) {
        await sleep(500);
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

async function uploadToHereNow(videoFile, jokeId) {
  const filename = `dadjoke-${jokeId}-regen.html`;
  const filepath = path.join(CONFIG.outputDir, filename);
  const videoBasename = path.basename(videoFile);
  
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dad Joke #${jokeId} | DadtasticDads</title><style>body{margin:0;padding:0;background:#000;display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:system-ui}.container{max-width:100%;width:100%}video{width:100%;max-width:480px;height:auto;display:block;margin:0 auto}.brand{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);color:#F8EFE1;font-family:system-ui;font-size:14px;opacity:0.7;text-align:center}</style></head><body><div class="container"><video controls playsinline><source src="${videoBasename}" type="video/mp4">Your browser doesn't support video.</video></div><div class="brand">DadtasticDads #${jokeId} (Regenerated)</div></body></html>`;
  
  fs.writeFileSync(filepath, html);
  
  try {
    log('Init here.now upload...');
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
    
    for (const upload of uploads) {
      const filePath = upload.path === 'index.html' ? filepath : videoFile;
      const fileName = upload.path.split('/').pop();
      
      log(`Uploading ${fileName}...`);
      const fileBuffer = fs.readFileSync(filePath);
      
      const fileRes = await fetch(upload.url, {
        method: 'PUT',
        headers: { ...upload.headers, 'Content-Length': fileBuffer.length.toString() },
        body: fileBuffer
      });
      
      if (!fileRes.ok) throw new Error(`Upload failed for ${fileName}: ${fileRes.status}`);
    }
    
    log('Finalizing upload...');
    const versionId = initData.upload.versionId;
    const finalizeRes = await fetch(finalizeUrl, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versionId })
    });
    if (!finalizeRes.ok) throw new Error(`Finalize failed: ${finalizeRes.status}`);
    
    log(`Upload complete: ${siteUrl}`);
    return siteUrl;
    
  } catch (err) {
    log(`here.now upload error: ${err.message}`, 'warn');
    return 'Upload ready (manual)';
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  REGENERATING JOKE #19 - IMPROVED QUALITY                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  try {
    log('Joke: "' + JOKE_19.text + '"\n');
    
    // Step 1: Audio
    log('Step 1: Generating audio...');
    const audio = await generateAudio(JOKE_19.text);
    log(`Audio: ${audio.duration.toFixed(2)}s (${audio.cached ? 'cached' : 'generated'})\n`);
    
    // Step 2: Image prompt
    log('Step 2: Generating image prompt...');
    const imagePrompt = await generateImagePrompt(JOKE_19.text);
    log(`Prompt: "${imagePrompt}"\n`);
    
    // Step 3: Generate image
    log('Step 3: Generating image...');
    const imageFile = await generateImage(imagePrompt);
    console.log('');
    
    // Step 4: Render video
    log('Step 4: Rendering video...');
    const videoFile = await renderVideo(
      JOKE_19.text,
      JOKE_19.format,
      JOKE_19.segments,
      audio.file,
      imageFile,
      audio.duration
    );
    log(`Video: ${path.basename(videoFile)}\n`);
    
    // Step 5: Upload
    log('Step 5: Uploading to here.now...');
    const url = await uploadToHereNow(videoFile, JOKE_19.id);
    console.log('');
    
    // Success
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ REGENERATION COMPLETE                                    ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log(`\n📹 Video: ${videoFile}`);
    console.log(`🌐 URL: ${url}`);
    console.log('\nQUALITY IMPROVEMENTS:');
    console.log('  ✓ 512x768 resolution (was 480x720)');
    console.log('  ✓ 25 steps (was 15)');
    console.log('  ✓ DPM++ 2M Karras sampler (was Euler a)');
    console.log('  ✓ Better prompt engineering (no literal interpretations)');
    console.log('  ✓ Enhanced negative prompts');
    console.log('');
    
  } catch (error) {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  ❌ REGENERATION FAILED                                      ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.error(`\nError: ${error.message}\n`);
    process.exit(1);
  }
}

main();
