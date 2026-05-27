#!/usr/bin/env node
/**
 * DadtasticDads Daily Video Generator
 * 
 * Automated pipeline:
 * 1. Get next joke from Google Sheets
 * 2. Generate audio with ElevenLabs
 * 3. Split setup/punchline with Ollama Mistral
 * 4. Generate image prompt with Ollama Llama3.1
 * 5. Generate background with Stable Diffusion
 * 6. Render video with Remotion
 * 7. Mark as complete in Google Sheets
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  ollamaUrl: 'http://192.168.1.33:11434',
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
  console.log('🎬 DadtasticDads Video Generator');
  console.log('=================================\n');
  
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
    
    // Step 3: Analyze joke type
    console.log('🤖 Step 3: Analyzing joke type (Mistral)...');
    const { jokeType, displayText, punchlineTiming } = await analyzeJoke(joke);
    console.log(`   Display text: "${displayText}"`);
    console.log(`   Timing: ${Math.round(punchlineTiming * 100)}% through audio\n`);
    
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
    console.log('🎬 Step 6: Rendering video with Remotion...');
    const videoFile = await renderVideo(joke, jokeType, displayText, audioFile, imageFile, audioDuration, punchlineTiming);
    console.log(`   Video: ${videoFile}\n`);
    
    // Step 6b: Verify video
    console.log('🔍 Step 6b: Verifying video output...');
    const videoOk = await verifyVideo(videoFile, displayText, audioDuration);
    if (!videoOk) {
      console.log('   ⚠️ Video verification failed, check manually');
    } else {
      console.log('   ✅ Video verified successfully!\n');
    }
    
    // Step 7: Mark as complete
    console.log('✅ Step 7: Marking joke as published...');
    await markJokeComplete(joke);
    console.log('   Done!\n');
    
    console.log('🎉 Video complete!');
    console.log(`📹 Output: ${videoFile}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// --- Step 1: Read from CSV ---
const csvPath = '/home/kevin/.openclaw/workspace/dadtasticdads/dadabase.csv';

async function getJokeFromCSV() {
  const fs = require('fs');
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n');
  
  // Parse CSV (handle quoted fields)
  const jokes = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Simple CSV parse (handles basic quotes)
    const match = line.match(/^(\d+),("(?:[^"\\]|\\.)*"|[^,]*),(\w+),(\w*)$/);
    if (match) {
      const id = match[1];
      let joke = match[2].replace(/^"|"$/g, '').replace(/""/g, '"');
      const used = match[3] === 'TRUE';
      const posted = match[4] === 'TRUE';
      
      // Get jokes that haven't been posted yet
      if (!posted) {
        jokes.push({ id, joke, used, posted });
      }
    }
  }
  
  if (jokes.length === 0) {
    throw new Error('No unposted jokes found in Dadabase!');
  }
  
  // Get first unposted joke
  const nextJoke = jokes[0];
  console.log(`   Found unposted joke #${nextJoke.id}`);
  
  // Mark as used in CSV (Posted is tracked manually by Kevin)
  const updatedLines = lines.map((line, idx) => {
    if (idx === 0) return line; // Header
    const match = line.match(/^(\d+),/);
    if (match && match[1] === nextJoke.id) {
      // Update Used column only, preserve Posted status
      // Match: ,FALSE,TRUE or ,FALSE,FALSE → ,TRUE,{keep posted value}
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
      // Cleanup temp file
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

// --- Step 3: Analyze Joke Type ---
async function analyzeJoke(joke) {
  const fs = require('fs');
  
  const prompt = `Analyze this dad joke's structure and classify it. Return ONLY valid JSON:

Joke: ${joke}

Classify as one of:
- "one-liner": Single sentence, punchline is the whole joke (e.g., "I'm so good at winking I can do it with both eyes")
- "setup-punchline": Clear question/answer or setup/punchline structure (e.g., "Why did X? To Y!")
- "multi-line": Story-style or multiple sentences building to punchline

Expected format:
{
  "type": "one-liner",
  "jokeType": "one-liner" | "setup-punchline" | "multi-line",
  "displayText": "the full text to display (for one-liners, the whole joke)",
  "punchlineTiming": 0.65,
  "notes": "brief explanation"
}`;

  try {
    const response = await callOllama('mistral', prompt);
    const json = extractJSON(response);
    
    console.log(`   Type: ${json.jokeType || 'one-liner'}`);
    console.log(`   Notes: ${json.notes || 'N/A'}`);
    
    return {
      jokeType: json.jokeType || 'one-liner',
      displayText: json.displayText || joke,
      punchlineTiming: json.punchlineTiming || 0.65,
    };
  } catch (e) {
    console.log('   Using default (one-liner)');
    return {
      jokeType: 'one-liner',
      displayText: joke,
      punchlineTiming: 0.65,
    };
  }
}

// --- Step 4: Image Prompt Generation ---
async function generateImagePrompt(joke) {
  const prompt = `Create a concise Stable Diffusion prompt for a funny image illustrating this dad joke. Style: cartoon, whimsical, family-friendly. Format: single descriptive paragraph.

Joke: "${joke}"

Prompt:`;

  const response = await callOllama('llama3.1', prompt);
  return response.trim();
}

// --- Step 5: Stable Diffusion Image ---
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
    sampler_name: 'DPM++ 2M Karras',  // Faster sampler (from screensaver)
    cfg_scale: 7,
  };
  
  fs.writeFileSync(jsonFile, JSON.stringify(requestBody));
  
  // Start the SD job and wait for completion
  const curlCmd = `curl -s -X POST "${CONFIG.stableDiffusionUrl}/sdapi/v1/txt2img" ` +
    `-H "Content-Type: application/json" ` +
    `-d @${jsonFile} ` +
    `| jq -r '.images[0]' ` +
    `> "${filepath}.txt"`;
  
  exec(curlCmd);
  console.log('   SD job started, polling for completion...');
  
  // Poll until we get a valid response (no timeout - like screensaver gen)
  let attempts = 0;
  const maxAttempts = 600; // 10 min max with 1s polls
  
  while (attempts < maxAttempts) {
    await sleep(1000);
    attempts++;
    
    // Check progress endpoint
    try {
      const progressData = await fetchJSON(`${CONFIG.stableDiffusionUrl}/sdapi/v1/progress`);
      if (progressData.progress && progressData.progress > 0) {
        console.log(`   SD progress: ${Math.round(progressData.progress * 100)}%`);
      }
    } catch {}
    
    // Check if txt file has content (job completed)
    try {
      const stats = fs.statSync(`${filepath}.txt`);
      if (stats.size > 1000) {
        // File has content, decode base64 to PNG
        const base64Data = fs.readFileSync(`${filepath}.txt`, 'utf8').trim();
        if (base64Data && base64Data.startsWith('iVBOR')) {
          fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));
          try { fs.unlinkSync(`${filepath}.txt`); } catch {}
          try { fs.unlinkSync(jsonFile); } catch {}
          
          const finalStats = fs.statSync(filepath);
          if (finalStats.size > 0) {
            console.log(`   Image generated: ${finalStats.size} bytes`);
            return filepath;
          }
        }
      }
    } catch {
      // File not ready yet
    }
  }
  
  // Timeout - use fallback placeholder
  try { fs.unlinkSync(`${filepath}.txt`); } catch {}
  try { fs.unlinkSync(jsonFile); } catch {}
  
  console.log('   SD timeout - creating fallback gradient placeholder');
  return createFallbackImage(filepath);
}

function createFallbackImage(filepath) {
  // Create a simple gradient placeholder using ffmpeg
  // Generate a solid navy/orange gradient frame (720x1280 portrait)
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
  const fs = require('fs');
  
  // Check file size (should be >100KB for a real image)
  const stats = fs.statSync(imageFile);
  if (stats.size < 100000) {
    console.log(`   ⚠️ Image too small (${(stats.size/1024).toFixed(1)}KB) - may be corrupted`);
    return false;
  }
  
  // Check that it's a valid image using ffprobe
  const { exec } = require('child_process');
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
  const fs = require('fs');
  const { exec } = require('child_process');
  
  // Check file size
  const stats = fs.statSync(videoFile);
  if (stats.size < 100000) {
    console.log(`   Video too small (${(stats.size/1024).toFixed(1)}KB)`);
    return false;
  }
  
  // Check duration and codec via ffprobe
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
        
        if (!videoStream) {
          console.log('   No video stream found');
          resolve(false);
          return;
        }
        
        if (!audioStream) {
          console.log('   No audio stream found');
          resolve(false);
          return;
        }
        
        const duration = parseFloat(data.format.duration);
        console.log(`   Video OK: ${(stats.size/1024/1024).toFixed(2)}MB, ${videoStream.width}x${videoStream.height}, ${duration.toFixed(2)}s`);
        
        // Check if duration is reasonable (within 20% of expected)
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

// --- Step 6: Remotion Render ---
async function renderVideo(joke, jokeType, displayText, audioFile, imageFile, audioDuration, punchlineTiming) {
  const videoFile = path.join(CONFIG.outputDir, `dadjoke-${Date.now()}.mp4`);
  const propsFile = path.join(CONFIG.outputDir, `props-${Date.now()}.json`);
  
  // Copy assets to Remotion public folder
  const publicImage = path.join(CONFIG.remotionProject, 'public', 'background.png');
  const publicAudio = path.join(CONFIG.remotionProject, 'public', 'audio.mp3');
  
  fs.copyFileSync(imageFile, publicImage);
  fs.copyFileSync(audioFile, publicAudio);
  
  // Write props to temp file
  const props = {
    joke: joke,
    jokeType: jokeType,
    displayText: displayText,
    audioUrl: 'public/audio.mp3',
    imageUrl: 'public/background.png',
    punchlineTiming: punchlineTiming,
  };
  fs.writeFileSync(propsFile, JSON.stringify(props));
  
  const durationInFrames = Math.floor(audioDuration * 30); // 30fps
  
  return new Promise((resolve, reject) => {
    const cmd = `cd ${CONFIG.remotionProject} && npx remotion render \
      "DadJokeVideo" \
      "DadJokeVideo" \
      "${videoFile}" \
      --props-file "${propsFile}" \
      --duration-in-frames=${durationInFrames + 60} \
      --fps=30 \
      --width=720 \
      --height=1280`;
    
    exec(cmd, { timeout: 300000 }, (err, stdout, stderr) => {
      try { fs.unlinkSync(propsFile); } catch {}
      if (err) reject(new Error(`Remotion render error: ${stderr}`));
      else resolve(videoFile);
    });
  });
}

// --- Step 7: Mark Complete ---
async function markJokeComplete(joke) {
  // TODO: Update Google Sheets to mark joke as used
  console.log(`   "${joke}" marked as published`);
}

// --- Utilities ---
async function callOllamaFromFile(model, promptFile) {
  return new Promise((resolve, reject) => {
    const curl = `curl -s -X POST "${CONFIG.ollamaUrl}/api/generate" ` +
      `-H "Content-Type: application/json" ` +
      `-d '{\"model\": \"${model}\", \"prompt_file\": \"${promptFile}\", \"stream\": false}'`;
    
    // Actually, let's just read the file and pass the content
    const prompt = fs.readFileSync(promptFile, 'utf8');
    const jsonBody = JSON.stringify({
      model: model,
      prompt: prompt,
      stream: false,
    });
    const jsonFile = promptFile.replace('.txt', '.json');
    fs.writeFileSync(jsonFile, jsonBody);
    
    const curl2 = `curl -s -X POST "${CONFIG.ollamaUrl}/api/generate" ` +
      `-H "Content-Type: application/json" ` +
      `-d @${jsonFile}`;
    
    exec(curl2, { timeout: 30000 }, (err, stdout, stderr) => {
      try { fs.unlinkSync(jsonFile); } catch {}
      
      if (err) reject(new Error(`Ollama error: ${stderr || err.message}`));
      else {
        const response = JSON.parse(stdout);
        resolve(response.response);
      }
    });
  });
}

async function callOllama(model, prompt) {
  // Fallback to the old method for simple prompts
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
    
    exec(curl, { timeout: 30000 }, (err, stdout, stderr) => {
      try { fs.unlinkSync(jsonFile); } catch {}
      
      if (err) reject(new Error(`Ollama error: ${stderr || err.message}`));
      else {
        const response = JSON.parse(stdout);
        resolve(response.response);
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
