#!/usr/bin/env node
/**
 * Regenerate Joke #15 as One-Liner
 * 
 * Fixes the video to display text once (no repetition),
 * with continuous audio and no pause.
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  outputDir: '/home/kevin/.openclaw/workspace/dadtasticdads-output',
  remotionProject: '/home/kevin/.openclaw/workspace/dadtasticdads-remotion',
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || 'sk_2c86803a3f4ec344ea132627832d319bc3c7af64b339c103',
  voiceId: 'JBFqnCBsd6RMkjVDRZzb',
  modelId: 'eleven_multilingual_v2',
  stableDiffusionUrl: 'http://msi:7860',  // Use hostname, not IP (falls back to 100.124.40.24 if needed)
  ollamaUrl: 'http://msi:11434',
  versionFormat: 'V{num}',  // e.g., 15-V1.mp4, 15-V2.mp4
};

const JOKE_15 = "I'm so good at sleeping I can do it with my eyes closed!";

async function main() {
  console.log('🎬 Regenerating Joke #15 as One-Liner...\n');
  
  // Step 1: Regenerate audio (one-liner, no extra pause needed beyond padding)
  console.log('🎙️ Step 1: Generating audio...');
  const audioFile = await generateAudio(JOKE_15);
  const duration = await getAudioDuration(audioFile);
  console.log(`   Audio: ${duration.toFixed(2)}s\n`);
  
  // Step 2: Generate image prompt
  console.log('🎨 Step 2: Generating image prompt...');
  const prompt = await generateImagePrompt(JOKE_15);
  console.log(`   Prompt: "${prompt}"\n`);
  
  // Step 3: Generate background
  console.log('🖼️ Step 3: Generating background image...');
  const imageFile = await generateImage(prompt);
  console.log(`   Image: ${imageFile}\n`);
  
  // Step 4: Render video with ONE-LINER format
  console.log('🎬 Step 4: Rendering video (one-liner treatment)...');
  const videoFile = await renderVideoOneLiner(
    JOKE_15,
    audioFile,
    imageFile,
    duration
  );
  console.log(`   Video: ${videoFile}\n`);
  
  // Step 5: Backup to MinIO
  console.log('📦 Step 5: Backing up to MinIO...');
  const backupUrl = await backupToMinIO(videoFile, 15);
  console.log(`   Backup: ${backupUrl}\n`);
  
  // Step 6: Send to Kevin via Telegram
  console.log('📤 Step 6: Sending to Telegram...');
  await sendToTelegram(videoFile);
  console.log('   Sent!\n');
  
  console.log('✅ COMPLETE!');
}

async function generateAudio(text) {
  const filename = `audio-15-${Date.now()}.mp3`;
  const filepath = path.join(CONFIG.outputDir, filename);
  const jsonFile = path.join(CONFIG.outputDir, `tts-${Date.now()}.json`);
  
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
        // Add 1 second padding (standard for one-liner, no internal pause)
        exec(`ffmpeg -y -f lavfi -i "anullsrc=cl=mono:r=44100:d=1" -i "${filepath}" -f lavfi -i "anullsrc=cl=mono:r=44100:d=1" ` +
          `-filter_complex "[0][1][2]concat=n=3:v=0:a=1" "${filepath}.padded.mp3" 2>/dev/null`, (err2) => {
          if (err2) resolve(filepath);
          else {
            fs.renameSync(`${filepath}.padded.mp3`, filepath);
            resolve(filepath);
          }
        });
      }
    });
  });
}

async function getAudioDuration(file) {
  return new Promise((resolve, reject) => {
    exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file}"`, 
      (err, stdout) => err ? reject(err) : resolve(parseFloat(stdout.trim())));
  });
}

async function generateImagePrompt(joke) {
  // Simple hardcoded prompt for sleeping joke - no LLM needed
  return "cartoon bedroom scene, person sleeping peacefully in bed, whimsical style, soft lighting, cozy atmosphere, family-friendly illustration";
}

async function generateImage(prompt) {
  const filename = `bg-15-${Date.now()}.png`;
  const filepath = path.join(CONFIG.outputDir, filename);
  const b64File = `${filepath}.b64`;
  const payloadFile = `${filepath}.payload.json`;
  
  fs.writeFileSync(payloadFile, JSON.stringify({
    prompt: `masterpiece, best quality, ${prompt}, cartoon, whimsical, vibrant`,
    negative_prompt: 'ugly, deformed, blurry',
    width: 480, height: 720, steps: 15, sampler_name: 'Euler a', cfg_scale: 6,
  }));
  
  exec(`curl -s -X POST "${CONFIG.stableDiffusionUrl}/sdapi/v1/txt2img" -H "Content-Type: application/json" -d @${payloadFile} | jq -r '.images[0]' > "${b64File}"`);
  
  for (let i = 0; i < 180; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const s = fs.statSync(b64File);
      if (s.size > 50000) {
        const b64 = fs.readFileSync(b64File, 'utf8').trim();
        if (b64.length > 50000 && b64.startsWith('iVBOR')) {
          fs.writeFileSync(filepath, Buffer.from(b64, 'base64'));
          fs.unlinkSync(b64File);
          fs.unlinkSync(payloadFile);
          return filepath;
        }
      }
    } catch {}
  }
  
  console.log('   ⚠️ SD timeout, using fallback...');
  execSync(`ffmpeg -y -f lavfi -i "color=c=#102A54:s=480x720:d=1" -frames:v 1 -c:v png "${filepath}" 2>/dev/null`);
  return filepath;
}

async function renderVideoOneLiner(joke, audioFile, imageFile, duration) {
  const videoFile = path.join(CONFIG.outputDir, `dadjoke-15-REGO-${Date.now()}.mp4`);
  
  // Copy files to Remotion public folder (Remotion uses relative paths)
  const publicDir = path.join(CONFIG.remotionProject, 'public');
  fs.copyFileSync(imageFile, path.join(publicDir, 'background.png'));
  fs.copyFileSync(audioFile, path.join(publicDir, 'audio.mp3'));
  
  const frames = Math.floor(duration * 30) + 60;
  
  // ONE-LINER format: single segment, appears at 0, stays till end
  // Use relative paths (Remotion resolves them from public dir)
  const propsObj = {
    joke: joke,
    format: 'one-liner',
    segments: [{ text: joke, atPercent: 0, display: 'fade-in' }],
    audioUrl: 'audio.mp3',
    imageUrl: 'background.png',
  };
  const propsJson = JSON.stringify(propsObj);
  
  return new Promise((resolve, reject) => {
    // Write props to file in project dir, then read as shell argument
    const propsFile = path.join(CONFIG.remotionProject, 'props-temp.json');
    fs.writeFileSync(propsFile, propsJson);
    
    const cmd = `cd ${CONFIG.remotionProject} && npx remotion render "DadJokeVideo" "DadJokeVideo" "out/dadjoke-15-regen.mp4" --props-file="${propsFile}" --public-dir="${publicDir}" --duration-in-frames=${frames} --fps=30 --width=720 --height=1280`;
    
    exec(cmd, { timeout: 300000 }, (err) => {
      try { fs.unlinkSync(propsFile); } catch {}
      if (err) { reject(new Error(`Remotion: ${err.message}`)); return; }
      
      const out = path.join(CONFIG.remotionProject, 'out', 'test.mp4');
      if (fs.existsSync(out)) {
        fs.copyFileSync(out, videoFile);
        resolve(videoFile);
      } else {
        reject(new Error('No Remotion output'));
      }
    });
  });
}

async function backupToMinIO(videoFile, jokeId) {
  const timestamp = new Date().toISOString().slice(0,10);
  const remotePath = `hp1/dadtasticdads/joke-${jokeId}/dadjoke-${jokeId}-${timestamp}-regen.mp4`;
  
  return new Promise((resolve, reject) => {
    exec(`mc cp "${videoFile}" ${remotePath} --json`, (err, stdout) => {
      if (err) reject(err);
      else {
        const resp = JSON.parse(stdout);
        resolve(resp.target || remotePath);
      }
    });
  });
}

async function sendToTelegram(videoFile) {
  return new Promise((resolve, reject) => {
    const cmd = `node /home/kevin/.npm-global/lib/node_modules/openclaw/dist/index.js message send ` +
      `--channel telegram --target 8177470832 ` +
      `--message "**Dad Joke Video #15** (REGENERATED - One-Liner Fix)\\n\\n"${JOKE_15}"\\n\\nThis version displays text once (no repetition)."` +
      ` --media "${videoFile}"`;
    
    exec(cmd, (err, stdout, stderr) => {
      if (err) reject(new Error(`Telegram: ${stderr}`));
      else resolve();
    });
  });
}

function execSync(cmd) {
  const { execSync } = require('child_process');
  return execSync(cmd);
}

main().catch(console.error);
