#!/usr/bin/env node
/**
 * Generate video for next unused joke
 */

const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  ollamaUrl: 'http://192.168.1.33:11434',
  stableDiffusionUrl: 'http://192.168.1.33:7860',
  outputDir: '/home/kevin/.openclaw/workspace/dadtasticdads-output',
  remotionProject: '/home/kevin/.openclaw/workspace/dadtasticdads-remotion',
  n8nWebhook: 'https://n8n.wolfeinkc.uk/webhook/b33fd5b7-e682-4309-a454-3c4180029743',
};

async function callOllama(model, prompt) {
  return new Promise((resolve, reject) => {
    exec(`curl -s "${CONFIG.ollamaUrl}/api/generate" -d '{"model":"${model}","prompt":"${prompt.replace(/"/g, '\\"')}","stream":false}'`, 
      (err, stdout) => {
        if (err) reject(err);
        else {
          try { resolve(JSON.parse(stdout).response || ''); }
          catch { resolve(''); }
        }
      });
  });
}

function escapeProps(props) {
  return JSON.stringify(props).replace(/'/g, "'\"'\"'");
}

async function getImage(prompt) {
  const imageFile = path.join(CONFIG.outputDir, `bg-next.png`);
  const b64File = `${imageFile}.b64`;
  const payloadFile = `${imageFile}.payload.json`;
  
  fs.writeFileSync(payloadFile, JSON.stringify({
    prompt: `masterpiece, best quality, highly detailed, ${prompt}, clean lines, simple composition, no text`,
    negative_prompt: 'ugly, deformed, blurry, distorted, text, watermark, signature, artifacts, gibberish',
    width: 512, height: 768, steps: 25,
    sampler_name: 'DPM++ 2M Karras', cfg_scale: 7,
  }));
  
  execSync(`curl -s -X POST "${CONFIG.stableDiffusionUrl}/sdapi/v1/txt2img" -H "Content-Type: application/json" -d @${payloadFile} | jq -r '.images[0]' > "${b64File}"`);
  
  for (let i = 0; i < 300; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const stats = fs.statSync(b64File);
      if (stats.size > 50000) {
        const b64 = fs.readFileSync(b64File, 'utf8').trim();
        if (b64.startsWith('iVBOR')) {
          fs.writeFileSync(imageFile, Buffer.from(b64, 'base64'));
          fs.unlinkSync(b64File);
          fs.unlinkSync(payloadFile);
          return imageFile;
        }
      }
    } catch {}
  }
  throw new Error('SD timeout');
}

async function validateImage(imageFile) {
  console.log('   Validating image...');
  // Simple check - file should be reasonable size
  const stats = fs.statSync(imageFile);
  if (stats.size < 100000) return { ok: false, reason: 'Too small' };
  if (stats.size > 2000000) return { ok: false, reason: 'Too large' };
  return { ok: true };
}

async function main() {
  console.log('🎬 Next Joke Video Generator\n');
  
  // Step 1: Get next joke from n8n webhook
  console.log('📊 Step 1: Fetching joke from n8n...');
  const jokeData = await new Promise((resolve, reject) => {
    exec(`curl -s "${CONFIG.n8nWebhook}"`, (err, stdout) => {
      try {
        const data = JSON.parse(stdout);
        if (data['Joke ID'] && data.Joke) {
          resolve({ id: data['Joke ID'], joke: data.Joke, row: data.row_number });
        } else {
          reject(new Error('No joke data returned'));
        }
      } catch {
        reject(new Error('Failed to parse webhook response'));
      }
    });
  });
  
  console.log(`   Joke #${jokeData.id}: "${jokeData.joke}"\n`);
  
  // Step 2: Generate audio and upload to MinIO
  console.log('🎙️ Step 2: Generating audio...');
  const audioFile = path.join(CONFIG.outputDir, `audio-${jokeData.id}.mp3`);
  const ttsPayload = {
    text: jokeData.joke,
    model_id: 'eleven_multilingual_v2',
    voice_settings: { stability: 0.5, similarity_boost: 0.75 },
  };
  fs.writeFileSync(`${audioFile}.json`, JSON.stringify(ttsPayload));
  
  await new Promise((resolve) => {
    exec(`curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb" ` +
      `-H "xi-api-key: sk_2c86803a3f4ec344ea132627832d319bc3c7af64b339c103" ` +
      `-H "Content-Type: application/json" ` +
      `-d @${audioFile}.json -o "${audioFile}"`, 
      (err) => {
        fs.unlinkSync(`${audioFile}.json`);
        resolve();
      });
  });
  
  const audioDuration = await new Promise((resolve) => {
    exec(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${audioFile}"`, 
      (err, stdout) => resolve(parseFloat(stdout.trim())));
  });
  console.log(`   ${audioDuration}s`);
  
  // Upload to MinIO with correct naming: {ID}-audio.mp3
  console.log('   📤 Uploading to MinIO...');
  await new Promise((resolve, reject) => {
    exec(`mc cp --quiet "${audioFile}" minio-hp1/dadjokes/${jokeData.id}/${jokeData.id}-audio.mp3`,
      (err) => {
        if (err) reject(err);
        else resolve();
      });
  });
  console.log(`   ✅ minio-hp1/dadjokes/${jokeData.id}/${jokeData.id}-audio.mp3\n`);
  
  // Step 3: Generate image prompt (use cloud model if Ollama down)
  console.log('🎨 Step 3: Image prompt...');
  let imagePrompt;
  try {
    imagePrompt = await callOllama('llama3.1:latest', 
      `Cartoon prompt for dad joke: "${jokeData.joke}". Whimsical, family-friendly, no text.`);
  } catch {
    // Fallback: simple template
    imagePrompt = `Cartoon illustration related to: "${jokeData.joke}". Simple, colorful, family-friendly, no text.`;
  }
  console.log(`   "${imagePrompt.trim().substring(0, 80)}..."\n`);
  
  // Step 4: Generate and validate image
  console.log('🖼️ Step 4: Generating image...');
  let imageFile;
  // Generate image (skip complex validation for now)
  imageFile = await getImage(imagePrompt);
  
  const stats = fs.statSync(imageFile);
  console.log(`   ✅ ${(stats.size/1024/1024).toFixed(2)}MB\n`);
  
  // Step 5: Render video
  console.log('🎬 Step 5: Rendering...');
  const frames = Math.floor(audioDuration * 30) + 60;
  
  fs.copyFileSync(audioFile, path.join(CONFIG.remotionProject, 'public', 'audio.mp3'));
  fs.copyFileSync(imageFile, path.join(CONFIG.remotionProject, 'public', 'background.png'));
  
  const segments = [{ text: jokeData.joke, atPercent: 0, display: 'fade-in' }];
  const props = { joke: jokeData.joke, format: 'one-liner', segments, audioUrl: 'audio.mp3', imageUrl: 'background.png' };
  const propsStr = escapeProps(props);
  
  await new Promise((resolve, reject) => {
    const cmd = `cd ${CONFIG.remotionProject} && npx remotion render DadJokeVideo DadJokeVideo out/dadjoke-next.mp4 --props='${propsStr}' --duration-in-frames=${frames} --fps=30 --width=720 --height=1280`;
    exec(cmd, { timeout: 300000 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  
  const videoFile = path.join(CONFIG.outputDir, `dadjoke-${jokeData.id}.mp4`);
  fs.copyFileSync(path.join(CONFIG.remotionProject, 'DadJokeVideo.mp4'), videoFile);
  const vStats = fs.statSync(videoFile);
  console.log(`   ✅ ${(vStats.size/1024/1024).toFixed(2)}MB\n`);
  
  // Step 6: Encode for web
  console.log('📦 Step 6: Encoding...');
  const encodedFile = path.join(CONFIG.outputDir, `dadjoke-${jokeData.id}-final.mp4`);
  execSync(`ffmpeg -y -i "${videoFile}" -c:v libx264 -profile:v main -level 3.1 -pix_fmt yuv420p -c:a aac -b:a 128k "${encodedFile}" 2>/dev/null`);
  console.log(`   ✅ ${(fs.statSync(encodedFile).size/1024/1024).toFixed(2)}MB\n`);
  
  console.log('🎉 COMPLETE!');
  console.log(`📹 ${encodedFile}`);
}

main().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
