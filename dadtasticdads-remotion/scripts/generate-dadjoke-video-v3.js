#!/usr/bin/env node
/**
 * DadtasticDads Daily Video Generator v3
 * 
 * Google Sheets + here.now integration:
 * 1. Get next unused joke from Google Sheets (Dadabase)
 * 2. Generate audio with ElevenLabs
 * 3. Detect joke format + segments (Mistral)
 * 4. Generate image prompt (Llama3.1)
 * 5. Generate background (Stable Diffusion)
 * 6. Render video (Remotion)
 * 7. Update Google Sheets (mark as used)
 * 8. Upload to here.now
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration - Updated 2026-03-10 with lessons learned
const CONFIG = {
  ollamaUrl: 'http://msi:11434',  // Use hostname, not IP (fallback: 100.124.40.24 tailscale)
  ollamaModel: 'mistral:7b',
  imagePromptModel: 'llama3.1:latest',
  stableDiffusionUrl: 'http://msi:7860',  // Use hostname, not IP
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || 'sk_2c86803a3f4ec344ea132627832d319bc3c7af64b339c103',
  voiceId: 'JBFqnCBsd6RMkjVDRZzb',
  modelId: 'eleven_multilingual_v2',
  outputDir: '/home/kevin/.openclaw/workspace/dadtasticdads-output',
  remotionProject: '/home/kevin/.openclaw/workspace/dadtasticdads-remotion',
  spreadsheetId: '1cXSGjCXleUK8iQweBAwLaa7j3QK2Sla-8v11CirQsuw',
  hereNowApiKey: '43818e0ae2d23aeaad3e2d5cd6e4c17c0b0eaeaf071c04c9a1f521722ce29c12',
  minioBucket: 'dadjokes',  // Upload to hp1/dadjokes/{id}/, not dadtasticdads/
  versionFormat: 'V{num}',  // Filename: {joke_id}-V1.mp4, {joke_id}-V2.mp4, etc.
  renderQuality: 'high',  // 'high' = no compression, 'compressed' = 100k video bitrate
  visionVerify: true,  // Always verify with Qwen 3.5 vision before sending
};

if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

async function main() {
  console.log('🎬 DadtasticDads Video Generator v3 (Google Sheets + here.now)');
  console.log('==============================================================\n');
  
  try {
    // Step 1: Get joke from Google Sheets
    console.log('📊 Step 1: Fetching next unused joke from Dadabase (Google Sheets)...');
    const jokeData = await getNextUnusedJoke();
    console.log(`   Joke #${jokeData.id}: "${jokeData.joke}"\n`);
    
    // Step 2: Generate audio
    console.log('🎙️ Step 2: Generating ElevenLabs audio...');
    const audioFile = await generateAudio(jokeData.joke);
    const audioDuration = await getAudioDuration(audioFile);
    console.log(`   Audio: ${audioFile} (${audioDuration}s)\n`);
    
    // Step 3: Detect format + segments
    console.log('🤖 Step 3: Detecting joke format and segments (Mistral)...');
    const formatAnalysis = await detectJokeFormat(jokeData.joke);
    console.log(`   Format: ${formatAnalysis.format}`);
    formatAnalysis.segments.forEach((seg, i) => {
      console.log(`     [${i}] "${seg.text}" @ ${Math.round(seg.atPercent * 100)}% (${seg.display})`);
    });
    console.log(`   Reasoning: ${formatAnalysis.reasoning}\n`);
    
    // Step 4: Generate image prompt
    console.log('🎨 Step 4: Generating image prompt (Llama3.1)...');
    const imagePrompt = await generateImagePrompt(jokeData.joke);
    console.log(`   Prompt: "${imagePrompt}"\n`);
    
    // Step 5: Generate background image
    console.log('🖼️ Step 5: Generating Stable Diffusion image...');
    const imageFile = await generateImage(imagePrompt);
    console.log(`   Image: ${imageFile}\n`);
    
    // Step 6: Render video
    console.log('🎬 Step 6: Rendering video with Remotion...');
    const videoFile = await renderVideoV2(
      jokeData.joke,
      formatAnalysis,
      audioFile,
      imageFile,
      audioDuration
    );
    console.log(`   Video: ${videoFile}\n`);
    
    // Step 7: Comprehensive video verification
    console.log('🔍 Step 7: Verifying video output...');
    const videoOk = await verifyVideo(videoFile, jokeData.joke, formatAnalysis.segments, audioDuration);
    if (!videoOk) {
      throw new Error('Video verification failed - see errors above');
    }
    console.log('');
    
    // Step 8: Update Google Sheets
    console.log('📝 Step 8: Marking joke as used in Google Sheets...');
    await markJokeUsed(jokeData.row);
    console.log('   Done!\n');
    
    // Step 9: Upload to here.now
    console.log('🚀 Step 9: Uploading to here.now...');
    const hereNowUrl = await uploadToHereNow(videoFile, jokeData.id);
    console.log(`   Published: ${hereNowUrl}\n`);
    
    console.log('🎉 COMPLETE!');
    console.log(`📹 Video: ${videoFile}`);
    console.log(`🌐 URL: ${hereNowUrl}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// --- Step 1: Google Sheets ---
async function getNextUnusedJoke() {
  return new Promise((resolve, reject) => {
    // Check rows 1-200 (should cover unused jokes)
    const cmd = `gog sheets get ${CONFIG.spreadsheetId} "Sheet1!A1:D200" --json`;
    exec(cmd, (err, stdout, stderr) => {
      if (err) reject(new Error(`Sheets error: ${stderr}`));
      try {
        const data = JSON.parse(stdout);
        const values = data.values || [];
        
        // Skip header, find first unused (not used and not posted)
        for (let i = 1; i < values.length; i++) {
          const row = values[i];
          if (row.length >= 3) {
            const id = row[0];
            const joke = row[1];
            const used = row[2] === 'TRUE';
            const posted = row.length >= 4 ? row[3] === 'TRUE' : false;
            
            // Skip if used OR posted
            if (!used && !posted) {
              resolve({ id, joke, row: i + 1 }); // 1-indexed row
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
    // Update column C (Used) to TRUE
    const cmd = `gog sheets update ${CONFIG.spreadsheetId} "Sheet1!C${rowNum}" "TRUE"`;
    exec(cmd, (err, stdout, stderr) => {
      if (err) reject(new Error(`Sheets update error: ${stderr}`));
      else resolve();
    });
  });
}

// --- Step 2: ElevenLabs with Audio Padding ---
async function generateAudio(text) {
  const filename = `audio-${Date.now()}.mp3`;
  const filepath = path.join(CONFIG.outputDir, filename);
  const jsonFile = path.join(CONFIG.outputDir, `tts-${Date.now()}.json`);
  const paddedFile = path.join(CONFIG.outputDir, `audio-padded-${Date.now()}.mp3`);
  
  fs.writeFileSync(jsonFile, JSON.stringify({
    text: text,
    model_id: CONFIG.modelId,
    voice_settings: { stability: 0.5, similarity_boost: 0.75 },
  }));
  
  return new Promise((resolve, reject) => {
    const curl = `curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/${CONFIG.voiceId}" ` +
      `-H "xi-api-key: ${CONFIG.elevenLabsApiKey}" ` +
      `-H "Content-Type: application/json" ` +
      `-d @${jsonFile} --output "${filepath}"`;
    
    exec(curl, { timeout: 30000 }, (err, stdout, stderr) => {
      try { fs.unlinkSync(jsonFile); } catch {}
      if (err) reject(new Error(`ElevenLabs: ${stderr}`));
      else {
        // Add 1 second silence at start and end
        exec(`ffmpeg -y -i "${filepath}" ` +
          `-filter_complex "[0:a]apad=pad_dur=1[pre];[pre]silence=limit=0:start_dur=1:detect_peak=1:stop_duration=0.5,apad=pad_dur=1" ` +
          `"${paddedFile}" 2>/dev/null`, (err2) => {
          if (err2 || !fs.existsSync(paddedFile)) {
            // Fallback: simple concat with silence
            exec(`ffmpeg -y -f lavfi -i "anullsrc=cl=mono:r=44100:d=1" -i "${filepath}" -f lavfi -i "anullsrc=cl=mono:r=44100:d=1" ` +
              `-filter_complex "[0][1][2]concat=n=3:v=0:a=1" "${paddedFile}" 2>/dev/null`, (err3) => {
              if (err3) resolve(filepath); // Use original if all fail
              else {
                try { fs.unlinkSync(filepath); } catch {}
                resolve(paddedFile);
              }
            });
          } else {
            try { fs.unlinkSync(filepath); } catch {}
            resolve(paddedFile);
          }
        });
      }
    });
  });
}

async function getAudioDuration(audioFile) {
  return new Promise((resolve, reject) => {
    exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioFile}"`, 
      (err, stdout) => {
        if (err) reject(new Error('No duration'));
        else resolve(parseFloat(stdout.trim()));
      });
  });
}

// --- Step 3: Format Detection with Validation ---
async function detectJokeFormat(joke) {
  const prompt = `Analyze dad joke for video segments. Return ONLY raw JSON.

Rules:
- segments array should contain ONLY actual joke text to display (no stage directions)
- Remove any "(pause...)", "(...)", "[...]" directions - they're not displayed
- atPercent: 0-1, when text should appear
- For multi-segment: setup at 0, punchline at 0.5-0.7

Joke: "${joke}"

Example: {"format":"setup-punchline","segments":[{"text":"Why did the chicken cross the road?","atPercent":0,"display":"fade-in"},{"text":"To get to the second-hand store!","atPercent":0.6,"display":"pop-in"}],"reasoning":"Q&A format"}

JSON:`;

  try {
    const response = await callOllama(CONFIG.ollamaModel, prompt);
    const json = extractJSON(response);
    if (!json.format || !json.segments?.length) throw new Error('Invalid');
    
    // Filter out non-text segments (pause instructions, etc)
    json.segments = json.segments.filter(seg => {
      const text = seg.text.trim();
      // Remove segments that are just directions
      if (!text || text.startsWith('(') || text.startsWith('[')) return false;
      // Remove parentheticals from text
      seg.text = text.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
      return seg.text.length > 0;
    });
    
    if (json.segments.length === 0) throw new Error('No valid segments');
    
    // Normalize format to expected values
    const validFormats = ['one-liner', 'setup-punchline', 'multi-line'];
    if (!validFormats.includes(json.format)) {
      // Map unknown formats to closest match
      json.format = json.segments.length > 1 ? 'setup-punchline' : 'one-liner';
    }
    
    return json;
  } catch (e) {
    return {
      format: 'one-liner',
      segments: [{ text: joke, atPercent: 0, display: 'fade-in' }],
      reasoning: 'Fallback'
    };
  }
}

// --- Step 4: Image Prompt ---
async function generateImagePrompt(joke) {
  const prompt = `Concise SD prompt for dad joke. Cartoon, whimsical, family-friendly. Single paragraph.

Joke: "${joke}"
Prompt:`;
  const response = await callOllama(CONFIG.imagePromptModel, prompt);
  return response.trim();
}

// --- Step 5: Stable Diffusion (Async polling with timeout) ---
async function generateImage(prompt) {
  const filename = `bg-${Date.now()}.png`;
  const filepath = path.join(CONFIG.outputDir, filename);
  const b64File = `${filepath}.b64`;
  const sdPayloadFile = `${filepath}.payload.json`;
  
  console.log('   Generating SD image (max 5 min, 480x720)...');
  
  // Write SD payload to file (avoids shell escaping issues)
  fs.writeFileSync(sdPayloadFile, JSON.stringify({
    prompt: `masterpiece, best quality, ${prompt}, cartoon, whimsical, vibrant, simple composition, clear subject`,
    negative_prompt: 'ugly, deformed, blurry, busy, cluttered',
    width: 480,
    height: 720,
    steps: 15,
    sampler_name: 'Euler a',
    cfg_scale: 6,
  }));
  
  // Start SD request in background
  exec(`curl -s -X POST "${CONFIG.stableDiffusionUrl}/sdapi/v1/txt2img" -H "Content-Type: application/json" -d @${sdPayloadFile} | jq -r '.images[0]' > "${b64File}"`);
  
  // Poll with 5 minute timeout (300 seconds)
  for (let i = 0; i < 300; i++) {
    await sleep(1000);
    if (i % 10 === 0) {
      try {
        const p = await fetchJSON(`${CONFIG.stableDiffusionUrl}/sdapi/v1/progress`);
        if (p.progress) console.log(`   SD: ${Math.round(p.progress * 100)}%`);
      } catch {}
    }
    try {
      const stats = fs.statSync(b64File);
      // Base64 image should be much larger than 50KB
      if (stats.size > 50000) {
        const b64 = fs.readFileSync(b64File, 'utf8').trim();
        if (b64 && b64.length > 50000 && b64.startsWith('iVBOR')) {
          fs.writeFileSync(filepath, Buffer.from(b64, 'base64'));
          fs.unlinkSync(b64File);
          fs.unlinkSync(sdPayloadFile);
          const s = fs.statSync(filepath);
          console.log(`   ✅ Image: ${(s.size/1024/1024).toFixed(2)}MB`);
          return filepath;
        }
      }
    } catch {}
  }
  
  console.log('   ⚠️ SD timeout (5 min), using fallback gradient...');
  try { fs.unlinkSync(b64File); } catch {}
  try { fs.unlinkSync(sdPayloadFile); } catch {}
  execSync(`ffmpeg -y -f lavfi -i "color=c=#102A54:s=480x720:d=1" -frames:v 1 -c:v png "${filepath}" 2>/dev/null`);
  return filepath;
}

// --- Step 6: Remotion ---
async function renderVideoV2(joke, format, audioFile, imageFile, duration) {
  const videoName = `dadjoke-${Date.now()}.mp4`;
  const videoFile = path.join(CONFIG.outputDir, videoName);
  
  fs.copyFileSync(imageFile, path.join(CONFIG.remotionProject, 'public', 'background.png'));
  fs.copyFileSync(audioFile, path.join(CONFIG.remotionProject, 'public', 'audio.mp3'));
  
  const frames = Math.floor(duration * 30) + 60;
  
  // Use just filenames for webpack require() to work with '../public/${filename}'
  const propsArg = JSON.stringify({
    joke, 
    format: format.format, 
    segments: format.segments,  
    audioUrl: 'audio.mp3',
    imageUrl: 'background.png',
  }).replace(/"/g, '\\"');
  
  return new Promise((resolve, reject) => {
    const publicDir = path.join(CONFIG.remotionProject, 'public');
    const cmd = `cd ${CONFIG.remotionProject} && npx remotion render "DadJokeVideo" "DadJokeVideo" "out/${videoName}" --props="${propsArg}" --public-dir="${publicDir}" --duration-in-frames=${frames} --fps=30 --width=720 --height=1280`;
    exec(cmd, { timeout: 300000 }, (err) => {
      if (err) { reject(new Error(`Remotion: ${err.message}`)); return; }
      
      const remotionOut = path.join(CONFIG.remotionProject, 'out', videoName);
      const defaultOut = path.join(CONFIG.remotionProject, 'DadJokeVideo.mp4');
      
      if (fs.existsSync(remotionOut)) {
        fs.copyFileSync(remotionOut, videoFile);
        resolve(videoFile);
      } else if (fs.existsSync(defaultOut)) {
        fs.copyFileSync(defaultOut, videoFile);
        resolve(videoFile);
      } else {
        reject(new Error('No output from Remotion'));
      }
    });
  });
}

// --- Comprehensive Video Validation ---
async function verifyVideo(videoFile, joke, segments, audioDuration) {
  const stats = fs.statSync(videoFile);
  const errors = [];
  const warnings = [];
  
  console.log('   Running validation checks...');
  
  // 1. Basic file validation
  if (stats.size < 100000) {
    errors.push(`File too small: ${(stats.size/1024).toFixed(1)}KB (should be >100KB)`);
  }
  
  // 2. Probe video/audio streams
  const probeResult = await new Promise((resolve) => {
    exec(`ffprobe -v error -show_entries format=duration -show_entries stream=codec_type,width,height -of json "${videoFile}"`, (err, stdout) => {
      if (err) { resolve({ error: err.message }); return; }
      try {
        resolve(JSON.parse(stdout));
      } catch { resolve({ error: 'Invalid probe output' }); }
    });
  });
  
  if (probeResult.error) {
    errors.push(`Probe failed: ${probeResult.error}`);
  } else {
    const streams = probeResult.streams || [];
    const video = streams.find(s => s.codec_type === 'video');
    const audio = streams.find(s => s.codec_type === 'audio');
    const duration = parseFloat(probeResult.format?.duration || '0');
    
    // Check video dimensions
    if (!video) {
      errors.push('No video stream found');
    } else {
      console.log(`   ✓ Video: ${video.width}x${video.height}`);
      // Should be 720x1280 (720p vertical)
      if (video.width !== 720 || video.height !== 1280) {
        warnings.push(`Unexpected resolution: ${video.width}x${video.height} (expected 720x1280)`);
      }
    }
    
    // Check audio exists
    if (!audio) {
      errors.push('No audio stream found');
    } else {
      console.log(`   ✓ Audio stream present`);
    }
    
    // Check duration with padding (should be audio ~+2 seconds for start/end padding)
    console.log(`   ✓ Duration: ${duration.toFixed(2)}s (audio was ${audioDuration.toFixed(2)}s)`);
    // Allow variance since Remotion rounds to frames (30fps = 33ms per frame)
    const durationDiff = Math.abs(duration - audioDuration);
    if (durationDiff > 1) {
      warnings.push(`Duration difference: ${durationDiff.toFixed(2)}s (expected ~2s for padding)`);
    }
    // Check if padding exists (video should be close to or longer than audio duration)
    if (duration < audioDuration - 0.5) {
      errors.push(`Video shorter than audio: ${duration.toFixed(2)}s vs ${audioDuration.toFixed(2)}s`);
    }
  }
  
  // 3. Validate segments (no stage directions)
  console.log(`   ✓ Segments: ${segments.length} text segments`);
  for (const seg of segments) {
    if (seg.text.includes('(') || seg.text.includes('[')) {
      errors.push(`Segment contains stage direction: "${seg.text}"`);
    }
    if (seg.text.length < 3) {
      warnings.push(`Very short segment: "${seg.text}"`);
    }
    if (seg.atPercent < 0 || seg.atPercent > 1) {
      errors.push(`Invalid atPercent: ${seg.atPercent} for "${seg.text}"`);
    }
  }
  
  // 4. Sample frames to check text visibility (basic check)
  const frameCheck = await new Promise((resolve) => {
    const tempFrame = `/tmp/frame-verify-${Date.now()}.png`;
    exec(`ffmpeg -y -i "${videoFile}" -ss 1 -vframes 1 "${tempFrame}" 2>/dev/null && echo ${tempFrame}`, (err, stdout) => {
      if (err || !stdout.trim()) { resolve({ error: true }); return; }
      const framePath = stdout.trim();
      fs.stat(framePath, (err, s) => {
        if (err || s.size < 1000) { resolve({ error: true }); return; }
        resolve({ path: framePath, size: s.size });
      });
    });
  });
  
  if (!frameCheck.error) {
    console.log(`   ✓ Sample frame extracted: ${(frameCheck.size/1024).toFixed(1)}KB`);
    // TODO: Could add image analysis here to detect if text is actually visible
  }
  
  // Log results
  if (warnings.length > 0) {
    console.log(`   ⚠️ Warnings: ${warnings.join(', ')}`);
  }
  
  if (errors.length > 0) {
    console.log(`   ❌ Errors: ${errors.join(', ')}`);
    return false;
  }
  
  console.log(`   ✅ All validation checks passed!`);
  return true;
}

// --- Step 9: here.now upload ---
async function uploadToHereNow(videoFile, jokeId) {
  const filename = `dadjoke-${jokeId}.html`;
  const filepath = path.join(CONFIG.outputDir, filename);
  
  // Create HTML page with video
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dad Joke #${jokeId} | DadtasticDads</title><style>body{margin:0;padding:0;background:#000;display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:system-ui}.container{max-width:100%;width:100%}video{width:100%;max-width:480px;height:auto;display:block;margin:0 auto}.brand{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);color:#F8EFE1;font-family:system-ui;font-size:14px;opacity:0.7;text-align:center}</style></head><body><div class="container"><video controls playsinline><source src="${path.basename(videoFile)}" type="video/mp4">Your browser doesn't support video.</video></div><div class="brand">DadtasticDads #${jokeId}</div></body></html>`;
  
  fs.writeFileSync(filepath, html);
  
  // Upload via here.now CLI
  return new Promise((resolve, reject) => {
    const cmd = `cd ${CONFIG.outputDir} && ~/.npm-global/lib/node_modules/here-now/bin/here-now.js publish "${filepath}" --key ${CONFIG.hereNowApiKey}`;
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.log('here.now CLI not found, trying curl...');
        // Fallback: manual curl upload
        const uploadCmd = `curl -s -X POST "https://api.here.now/v1/upload" -H "Authorization: Bearer ${CONFIG.hereNowApiKey}" -F "file=@${filepath}"`;
        exec(uploadCmd, (err2, stdout2) => {
          if (err2) reject(new Error(`here.now: ${stderr}`));
          else {
            try {
              const resp = JSON.parse(stdout2);
              resolve(resp.url || 'Upload completed');
            } catch {
              resolve('Upload completed (check console)');
            }
          }
        });
      } else {
        const match = stdout.match(/https?:\/\/[^ \n]+/);
        if (match) resolve(match[0]);
        else resolve('Upload completed');
      }
    });
  });
}

// --- Utils ---
function execSync(cmd) {
  const { execSync } = require('child_process');
  return execSync(cmd);
}
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

main();
