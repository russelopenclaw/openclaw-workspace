#!/usr/bin/env node
/**
 * DadtasticDads Daily Video Generator v2
 * 
 * Enhanced pipeline with joke format detection:
 * 1. Get next joke from CSV
 * 2. Generate audio with ElevenLabs
 * 3. ✨ Detect joke format + segment with timing (Mistral)
 * 4. Generate image prompt with Llama3.1
 * 5. Generate background with Stable Diffusion
 * 6. Render video with Remotion (multi-segment support)
 * 7. Mark as complete
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  ollamaUrl: 'http://192.168.1.33:11434',
  ollamaModel: 'mistral:7b',
  imagePromptModel: 'llama3.1:latest',
  stableDiffusionUrl: 'http://192.168.1.33:7860',
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || 'sk_2c86803a3f4ec344ea132627832d319bc3c7af64b339c103',
  voiceId: 'JBFqnCBsd6RMkjVDRZzb', // George (narrative male)
  modelId: 'eleven_multilingual_v2',
  outputDir: '/home/kevin/.openclaw/workspace/dadtasticdads-output',
  remotionProject: '/home/kevin/.openclaw/workspace/dadtasticdads-remotion',
};

// Ensure output directory exists
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

async function main() {
  console.log('🎬 DadtasticDads Video Generator v2');
  console.log('====================================\n');
  
  try {
    // Step 1: Read from CSV
    console.log('📊 Step 1: Fetching next unused joke from Dadabase...');
    const joke = await getJokeFromCSV();
    console.log(`   Joke: "${joke}"\n`);
    
    // Step 2: Generate audio
    console.log('🎙️ Step 2: Generating ElevenLabs audio...');
    const audioFile = await generateAudio(joke);
    const audioDuration = await getAudioDuration(audioFile);
    console.log(`   Audio: ${audioFile} (${audioDuration}s)\n`);
    
    // Step 3: ✨ Detect joke format + segments
    console.log('🤖 Step 3: Detecting joke format and segments (Mistral)...');
    const formatAnalysis = await detectJokeFormat(joke);
    console.log(`   Format: ${formatAnalysis.format}`);
    console.log(`   Segments: ${formatAnalysis.segments.length}`);
    formatAnalysis.segments.forEach((seg, i) => {
      console.log(`     [${i}] "${seg.text}" @ ${Math.round(seg.atPercent * 100)}% (${seg.display})`);
    });
    console.log(`   Reasoning: ${formatAnalysis.reasoning}\n`);
    
    // Step 4: Generate image prompt
    console.log('🎨 Step 4: Generating image prompt (Llama3.1)...');
    const imagePrompt = await generateImagePrompt(joke);
    console.log(`   Prompt: "${imagePrompt}"\n`);
    
    // Step 5: Generate background image
    console.log('🖼️ Step 5: Generating Stable Diffusion image...');
    const imageFile = await generateImage(imagePrompt);
    console.log(`   Image: ${imageFile}\n`);
    
    // Step 5b: Verify image quality
    console.log('🔍 Step 5b: Verifying image quality...');
    const imageOk = await verifyImage(imageFile, joke);
    if (!imageOk) {
      console.log('   ⚠️ Image verification failed, regenerating...');
      await generateImage(imagePrompt + ', clear and focused composition');
    }
    
    // Step 6: Render video with Remotion
    console.log('🎬 Step 6: Rendering video with Remotion (multi-segment)...');
    const videoFile = await renderVideoV2(
      joke,
      formatAnalysis,
      audioFile,
      imageFile,
      audioDuration
    );
    console.log(`   Video: ${videoFile}\n`);
    
    // Step 6b: Verify video
    console.log('🔍 Step 6b: Verifying video output...');
    const videoOk = await verifyVideo(videoFile, joke, audioDuration);
    if (!videoOk) {
      console.log('   ⚠️ Video verification failed, check manually');
    } else {
      console.log('   ✅ Video verified successfully!\n');
    }
    
    // Step 7: Mark as complete
    console.log('✅ Step 7: Marking joke as used...');
    await markJokeComplete(joke);
    console.log('   Done!\n');
    
    console.log('🎉 Video complete!');
    console.log(`📹 Output: ${videoFile}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// --- Step 1: Read from CSV ---
const csvPath = '/home/kevin/.openclaw/workspace/dadtasticdads/dadabase.csv';

async function getJokeFromCSV() {
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n');
  
  const jokes = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const match = line.match(/^(\d+),("(?:[^"\\]|\\.)*"|[^,]*),(\w+),(\w*)$/);
    if (match) {
      const id = match[1];
      let joke = match[2].replace(/^"|"$/g, '').replace(/""/g, '"');
      const used = match[3] === 'TRUE';
      const posted = match[4] === 'TRUE';
      
      if (!posted) {
        jokes.push({ id, joke, used, posted });
      }
    }
  }
  
  if (jokes.length === 0) {
    throw new Error('No unposted jokes found in Dadabase!');
  }
  
  const nextJoke = jokes[0];
  console.log(`   Found unposted joke #${nextJoke.id}`);
  
  const updatedLines = lines.map((line, idx) => {
    if (idx === 0) return line;
    const match = line.match(/^(\d+),/);
    if (match && match[1] === nextJoke.id) {
      return line.replace(/,FALSE,(TRUE|FALSE)$/, ',TRUE,$1');
    }
    return line;
  });
  
  fs.writeFileSync(csvPath, updatedLines.join('\n'));
  console.log(`   Marked joke #${nextJoke.id} as used`);
  
  return nextJoke.joke;
}

// --- Step 2: ElevenLabs Audio ---
async function generateAudio(text) {
  const filename = `audio-${Date.now()}.mp3`;
  const filepath = path.join(CONFIG.outputDir, filename);
  const jsonFile = path.join(CONFIG.outputDir, `tts-${Date.now()}.json`);
  
  const requestBody = {
    text: text,
    model_id: CONFIG.modelId,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
    },
  };
  
  fs.writeFileSync(jsonFile, JSON.stringify(requestBody));
  
  return new Promise((resolve, reject) => {
    const curl = `curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/${CONFIG.voiceId}" ` +
      `-H "xi-api-key: ${CONFIG.elevenLabsApiKey}" ` +
      `-H "Content-Type: application/json" ` +
      `-d @${jsonFile} ` +
      `--output "${filepath}"`;
    
    exec(curl, { timeout: 30000 }, (err, stdout, stderr) => {
      try { fs.unlinkSync(jsonFile); } catch {}
      if (err) reject(new Error(`ElevenLabs error: ${stderr || err.message}`));
      else resolve(filepath);
    });
  });
}

async function getAudioDuration(audioFile) {
  return new Promise((resolve, reject) => {
    exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioFile}"`, 
      (err, stdout, stderr) => {
        if (err) reject(new Error('Could not get audio duration'));
        else resolve(parseFloat(stdout.trim()));
      });
  });
}

// --- Step 3: ✨ Joke Format Detection ---
async function detectJokeFormat(joke) {
  const prompt = `Analyze this dad joke for video display format.

Joke: "${joke}"

Format types:
- one-liner: Single sentence (e.g., "Waking up was eye-opening")
- setup-punchline: Question→answer (e.g., "Why...? Because...!")
- multi-line: Dialogue or 3+ segments

Return ONLY raw JSON (no markdown, no code blocks):
{"format":"setup-punchline","segments":[{"text":"Setup","atPercent":0.0,"display":"fade-in"},{"text":"Punchline","atPercent":0.65,"display":"pop-in"}],"reasoning":"Has question and answer"}

Joke: "${joke}"
JSON:`;

  try {
    const response = await callOllama(CONFIG.ollamaModel, prompt);
    const json = extractJSON(response);
    
    if (!json.format || !json.segments || json.segments.length === 0) {
      console.log(`   Raw response: ${response.substring(0, 200)}`);
      throw new Error('Invalid format detection response');
    }
    
    json.segments.forEach(seg => {
      if (!seg.text || seg.atPercent === undefined || !seg.display) {
        throw new Error('Segment missing required fields');
      }
    });
    
    return json;
  } catch (e) {
    console.log(`   Fallback: defaulting to one-liner format (${e.message})`);
    return {
      format: 'one-liner',
      segments: [{ text: joke, atPercent: 0.0, display: 'fade-in' }],
      reasoning: 'Fallback due to parsing error'
    };
  }
}

// --- Step 4: Image Prompt Generation ---
async function generateImagePrompt(joke) {
  const prompt = `Create a concise Stable Diffusion prompt for a funny image illustrating this dad joke. Style: cartoon, whimsical, family-friendly. Single paragraph only.

Joke: "${joke}"

Prompt:`;

  const response = await callOllama(CONFIG.imagePromptModel, prompt);
  return response.trim();
}

// --- Step 5: Stable Diffusion Image (Async Polling) ---
async function generateImage(prompt) {
  const filename = `bg-${Date.now()}.png`;
  const filepath = path.join(CONFIG.outputDir, filename);
  const jsonFile = path.join(CONFIG.outputDir, `sd-${Date.now()}.json`);
  
  const requestBody = {
    prompt: `masterpiece, best quality, ${prompt}, cartoon style, whimsical, funny, vibrant colors`,
    negative_prompt: 'ugly, deformed, low quality, blurry',
    width: 720,
    height: 1280,
    steps: 25,
    sampler_name: 'DPM++ 2M Karras',
    cfg_scale: 7,
  };
  
  fs.writeFileSync(jsonFile, JSON.stringify(requestBody));
  
  // Start SD job asynchronously (like screensaver workflow)
  const curlCmd = `curl -s -X POST "${CONFIG.stableDiffusionUrl}/sdapi/v1/txt2img" ` +
    `-H "Content-Type: application/json" ` +
    `-d @${jsonFile} ` +
    `| jq -r '.images[0]' ` +
    `> "${filepath}.txt"`;
  
  exec(curlCmd);
  console.log('   SD job started, polling for completion...');
  
  let attempts = 0;
  const maxAttempts = 300; // 5 min max (was 600 = 10 min)
  
  while (attempts < maxAttempts) {
    await sleep(1000);
    attempts++;
    
    // Check progress every 10 seconds
    if (attempts % 10 === 0) {
      try {
        const progressData = await fetchJSON(`${CONFIG.stableDiffusionUrl}/sdapi/v1/progress`);
        if (progressData.progress && progressData.progress > 0) {
          console.log(`   SD progress: ${Math.round(progressData.progress * 100)}%`);
        }
      } catch {}
    }
    
    // Check if file has content
    try {
      const stats = fs.statSync(`${filepath}.txt`);
      if (stats.size > 1000) {
        const base64Data = fs.readFileSync(`${filepath}.txt`, 'utf8').trim();
        if (base64Data && base64Data.startsWith('iVBOR')) {
          fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));
          try { fs.unlinkSync(`${filepath}.txt`); } catch {}
          try { fs.unlinkSync(jsonFile); } catch {}
          
          const finalStats = fs.statSync(filepath);
          console.log(`   Image generated: ${(finalStats.size/1024/1024).toFixed(2)}MB`);
          return filepath;
        }
      }
    } catch {
      // File not ready yet
    }
  }
  
  // Timeout
  try { fs.unlinkSync(`${filepath}.txt`); } catch {}
  try { fs.unlinkSync(jsonFile); } catch {}
  
  console.log('   SD timeout - creating fallback');
  return createFallbackImage(filepath);
}

function createFallbackImage(filepath) {
  const cmd = `ffmpeg -y -f lavfi -i "color=c=#102A54:s=720x1280:d=1" -frames:v 1 -c:v png "${filepath}" 2>/dev/null`;
  execSync(cmd);
  return filepath;
}

function execSync(cmd) {
  const { execSync: sync } = require('child_process');
  return sync(cmd);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJSON(url) {
  const response = await fetch(url);
  return response.json();
}

// --- Verification Functions ---
async function verifyImage(imageFile, joke) {
  const stats = fs.statSync(imageFile);
  if (stats.size < 100000) {
    console.log(`   ⚠️ Image too small (${(stats.size/1024).toFixed(1)}KB)`);
    return false;
  }
  
  return new Promise((resolve) => {
    exec(`ffprobe -v error -show_entries stream=codec_name,width,height -of json "${imageFile}"`, (err, stdout) => {
      if (err) {
        console.log('   ⚠️ Could not verify image format');
        resolve(false);
        return;
      }
      try {
        const data = JSON.parse(stdout);
        if (data.streams && data.streams.length > 0) {
          const s = data.streams[0];
          console.log(`   ✅ Image OK: ${(stats.size/1024/1024).toFixed(2)}MB, ${s.width}x${s.height}`);
          resolve(true);
        } else {
          console.log('   ⚠️ No image streams found');
          resolve(false);
        }
      } catch {
        console.log('   ⚠️ Could not parse image info');
        resolve(false);
      }
    });
  });
}

async function verifyVideo(videoFile, expectedText, expectedDuration) {
  const stats = fs.statSync(videoFile);
  if (stats.size < 100000) {
    console.log(`   Video too small (${(stats.size/1024).toFixed(1)}KB)`);
    return false;
  }
  
  const probeCmd = `ffprobe -v error -show_entries format=duration -show_entries stream=codec_name,codec_type,width,height -of json "${videoFile}"`;
  
  return new Promise((resolve) => {
    exec(probeCmd, (err, stdout, stderr) => {
      if (err) {
        console.log('   Could not probe video');
        resolve(false);
        return;
      }
      
      try {
        const data = JSON.parse(stdout);
        const videoStream = data.streams.find(s => s.codec_type === 'video');
        const audioStream = data.streams.find(s => s.codec_type === 'audio');
        
        if (!videoStream || !audioStream) {
          console.log('   Missing video or audio stream');
          resolve(false);
          return;
        }
        
        const duration = parseFloat(data.format.duration);
        console.log(`   Video OK: ${(stats.size/1024/1024).toFixed(2)}MB, ${videoStream.width}x${videoStream.height}, ${duration.toFixed(2)}s`);
        
        if (duration < expectedDuration * 0.8) {
          console.log(`   ⚠️ Video shorter than expected (${duration.toFixed(1)}s vs ${expectedDuration.toFixed(1)}s)`);
        }
        
        resolve(true);
      } catch (e) {
        console.log('   Could not parse ffprobe output');
        resolve(false);
      }
    });
  });
}

// --- Step 6: Remotion Render (v2 with segments) ---
async function renderVideoV2(joke, formatAnalysis, audioFile, imageFile, audioDuration) {
  const videoFileName = `dadjoke-${Date.now()}.mp4`;
  const videoFile = path.join(CONFIG.outputDir, videoFileName);
  const propsFile = path.join(CONFIG.outputDir, `props-${Date.now()}.json`);
  
  const publicImage = path.join(CONFIG.remotionProject, 'public', 'background.png');
  const publicAudio = path.join(CONFIG.remotionProject, 'public', 'audio.mp3');
  
  fs.copyFileSync(imageFile, publicImage);
  fs.copyFileSync(audioFile, publicAudio);
  
  const props = {
    joke: joke,
    format: formatAnalysis.format,
    segments: formatAnalysis.segments,
    audioUrl: 'audio.mp3',
    imageUrl: 'background.png',
  };
  fs.writeFileSync(propsFile, JSON.stringify(props));
  
  const durationInFrames = Math.floor(audioDuration * 30) + 60;
  
  return new Promise((resolve, reject) => {
    // Change to Remotion project dir so output goes there, then copy
    const cmd = `cd ${CONFIG.remotionProject} && npx remotion render \
      "DadJokeVideo" \
      "DadJokeVideo" \
      "out/${videoFileName}" \
      --props-file "${propsFile}" \
      --duration-in-frames=${durationInFrames} \
      --fps=30 \
      --width=720 \
      --height=1280`;
    
    exec(cmd, { timeout: 300000 }, (err, stdout, stderr) => {
      try { fs.unlinkSync(propsFile); } catch {}
      
      if (err) {
        reject(new Error(`Remotion render error: ${stderr || err.message}`));
        return;
      }
      
      // Copy output to final location
      const remotionOutput = path.join(CONFIG.remotionProject, 'out', videoFileName);
      if (fs.existsSync(remotionOutput)) {
        fs.copyFileSync(remotionOutput, videoFile);
        resolve(videoFile);
      } else {
        // Try default output name
        const defaultOutput = path.join(CONFIG.remotionProject, 'DadJokeVideo.mp4');
        if (fs.existsSync(defaultOutput)) {
          fs.copyFileSync(defaultOutput, videoFile);
          resolve(videoFile);
        } else {
          reject(new Error('Remotion output file not found'));
        }
      }
    });
  });
}

// --- Step 7: Mark Complete ---
async function markJokeComplete(joke) {
  console.log(`   "${joke}" marked as used`);
}

// --- Utilities ---
async function callOllama(model, prompt) {
  const jsonBody = JSON.stringify({
    model: model,
    prompt: prompt,
    stream: false,
  });
  const jsonFile = path.join(CONFIG.outputDir, `ollama-${Date.now()}.json`);
  fs.writeFileSync(jsonFile, jsonBody);
  
  return new Promise((resolve, reject) => {
    const curl = `curl -s -X POST "${CONFIG.ollamaUrl}/api/generate" ` +
      `-H "Content-Type: application/json" ` +
      `-d @${jsonFile}`;
    
    exec(curl, { timeout: 60000 }, (err, stdout, stderr) => {
      try { fs.unlinkSync(jsonFile); } catch {}
      
      if (err) reject(new Error(`Ollama error: ${stderr || err.message}`));
      else {
        try {
          const response = JSON.parse(stdout);
          if (response.error) {
            reject(new Error(`Ollama API error: ${response.error}`));
          } else {
            resolve(response.response || '');
          }
        } catch (parseErr) {
          reject(new Error(`JSON parse error: ${parseErr.message}`));
        }
      }
    });
  });
}

function extractJSON(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
  return {};
}

// Run main
main();
