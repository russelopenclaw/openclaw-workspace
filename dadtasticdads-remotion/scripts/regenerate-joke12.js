#!/usr/bin/env node
/**
 * Regenerate video for Joke #12 (Dog Bike)
 */

const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  ollamaUrl: 'http://192.168.1.33:11434',
  stableDiffusionUrl: 'http://192.168.1.33:7860',
  outputDir: '/home/kevin/.openclaw/workspace/dadtasticdads-output',
  remotionProject: '/home/kevin/.openclaw/workspace/dadtasticdads-remotion',
  jokeId: '12',
  joke: "My dog used to chase people on a bike a lot. It got so bad I had to take his bike away.",
  audioFile: '/home/kevin/.openclaw/workspace/dadtasticdads-output/audio-1772494535845.mp3',
};

async function callOllama(model, prompt) {
  return new Promise((resolve, reject) => {
    exec(`curl -s "${CONFIG.ollamaUrl}/api/generate" -d '{"model":"${model}","prompt":"${prompt.replace(/"/g, '\\"')}","stream":false}'`, 
      (err, stdout) => {
        if (err) reject(err);
        else {
          try { 
            const data = JSON.parse(stdout);
            resolve(data.response || 'cartoon dog with bike, whimsical, colorful'); 
          } catch { resolve('cartoon dog with bike, whimsical, colorful'); }
        }
      });
  });
}

function escapeProps(props) {
  // Convert to JSON but use single quotes for shell
  return JSON.stringify(props).replace(/'/g, "'\"'\"'");
}

async function main() {
  console.log('🎬 Regenerating Joke #12 (Dog Bike)\n');
  
  // Step 1: Get audio duration
  console.log('📊 Step 1: Audio...');
  const audioDuration = await new Promise((resolve) => {
    exec(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${CONFIG.audioFile}"`, 
      (err, stdout) => resolve(parseFloat(stdout.trim())));
  });
  console.log(`   ${audioDuration}s\n`);
  
  // Step 2: Generate image prompt
  console.log('🎨 Step 2: Image prompt...');
  const imagePrompt = await callOllama('llama3.1:latest', 
    `Cartoon prompt for: "${CONFIG.joke}". Whimsical, family-friendly.`);
  console.log(`   "${imagePrompt.trim()}"\n`);
  
  // Step 3: Generate SD image
  console.log('🖼️ Step 3: SD image (480x720, 15 steps)...');
  const imageFile = path.join(CONFIG.outputDir, `bg-joke${CONFIG.jokeId}.png`);
  const b64File = `${imageFile}.b64`;
  const payloadFile = `${imageFile}.payload.json`;
  
  fs.writeFileSync(payloadFile, JSON.stringify({
    prompt: `masterpiece, best quality, highly detailed, ${imagePrompt}, clean lines, simple composition, clear subject, no text`,
    negative_prompt: 'ugly, deformed, blurry, distorted, extra limbs, bad anatomy, text, watermark, signature, artifacts, noisy, messy, cluttered',
    width: 512, height: 768, steps: 25,
    sampler_name: 'DPM++ 2M Karras', cfg_scale: 7,
  }));
  
  execSync(`curl -s -X POST "${CONFIG.stableDiffusionUrl}/sdapi/v1/txt2img" ` +
    `-H "Content-Type: application/json" -d @${payloadFile} | jq -r '.images[0]' > "${b64File}"`);
  
  for (let i = 0; i < 300; i++) {
    await new Promise(r => setTimeout(r, 1000));
    if (i % 10 === 0) {
      try {
        const p = await fetch(`${CONFIG.stableDiffusionUrl}/sdapi/v1/progress`).then(r => r.json());
        if (p.progress) console.log(`   SD: ${Math.round(p.progress * 100)}%`);
      } catch {}
    }
    try {
      const stats = fs.statSync(b64File);
      if (stats.size > 50000) {
        const b64 = fs.readFileSync(b64File, 'utf8').trim();
        if (b64.startsWith('iVBOR')) {
          fs.writeFileSync(imageFile, Buffer.from(b64, 'base64'));
          fs.unlinkSync(b64File);
          fs.unlinkSync(payloadFile);
          const s = fs.statSync(imageFile);
          console.log(`   ✅ ${s.size/1024/1024}MB\n`);
          break;
        }
      }
    } catch {}
  }
  
  // Step 4: Render video
  console.log('🎬 Step 4: Rendering...');
  const videoFile = path.join(CONFIG.outputDir, `dadjoke-${CONFIG.jokeId}-final.mp4`);
  const frames = Math.floor(audioDuration * 30) + 60;
  
  fs.copyFileSync(CONFIG.audioFile, path.join(CONFIG.remotionProject, 'public', 'audio.mp3'));
  fs.copyFileSync(imageFile, path.join(CONFIG.remotionProject, 'public', 'background.png'));
  
  // Use single quotes for shell
  const props = {
    joke: CONFIG.joke,
    format: 'setup-punchline',
    segments: [
      { text: "My dog used to chase people on a bike a lot.", atPercent: 0, display: "fade-in" },
      { text: "It got so bad I had to take his bike away.", atPercent: 0.65, display: "pop-in" }
    ],
    audioUrl: 'audio.mp3',
    imageUrl: 'background.png',
  };
  
  const propsStr = escapeProps(props);
  
  await new Promise((resolve, reject) => {
    const cmd = `cd ${CONFIG.remotionProject} && npx remotion render DadJokeVideo DadJokeVideo out/dadjoke-12-final.mp4 --props='${propsStr}' --duration-in-frames=${frames} --fps=30 --width=720 --height=1280`;
    exec(cmd, { timeout: 300000 }, (err) => {
      if (err) reject(err);
      else {
        const out = path.join(CONFIG.remotionProject, 'out', 'dadjoke-12-final.mp4');
        if (fs.existsSync(out)) {
          fs.copyFileSync(out, videoFile);
          resolve();
        } else reject(new Error('No output'));
      }
    });
  });
  
  const stats = fs.statSync(videoFile);
  console.log(`   ✅ ${(stats.size/1024/1024).toFixed(2)}MB\n`);
  
  // Step 5: Upload to MinIO
  console.log('☁️ Step 5: MinIO upload...');
  execSync(`mc cp --quiet "${videoFile}" minio-hp1/dadjokes/${CONFIG.jokeId}/video.mp4`);
  execSync(`mc cp --quiet "${imageFile}" minio-hp1/dadjokes/${CONFIG.jokeId}/background.png`);
  execSync(`mc cp --quiet "${CONFIG.audioFile}" minio-hp1/dadjokes/${CONFIG.jokeId}/audio.mp3`);
  console.log(`   ✅ minio-hp1/dadjokes/${CONFIG.jokeId}/\n`);
  
  console.log('🎉 COMPLETE!');
  console.log(`📹 ${videoFile}`);
  console.log(`☁️ minio-hp1/dadjokes/${CONFIG.jokeId}/`);
}

main().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
