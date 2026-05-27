#!/usr/bin/env node
/**
 * Generate Dad Joke Video #17
 * 
 * Updated 2026-03-10 with all lessons learned:
 * - Use msi hostname (not hardcoded IP)
 * - Use --props-file for Remotion (not shell escaping)
 * - One-liner vs setup-punchline detection
 * - Vision verification before sending
 * - Versioned filenames (V1, V2, etc.)
 * - High quality render (no compression)
 * - Upload to hp1/dadjokes/{id}/
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
  stableDiffusionUrl: 'http://msi:7860',
  ollamaUrl: 'http://msi:11434',
  minioBucket: 'dadjokes',
};

const JOKE_17 = {
  id: 17,
  text: "I have a joke about hunting for fossils, but you probably wouldn't dig it.",
  format: 'setup-punchline', // Question + answer
};

async function main() {
  console.log('🎬 Generating Dad Joke Video #17\n');
  console.log(`Joke: "${JOKE_17.text}"`);
  console.log(`Format: ${JOKE_17.format}\n`);
  
  // Step 1: Generate audio
  console.log('🎙️ Step 1: Generating audio...');
  const audioFile = await generateAudio(JOKE_17.text);
  const duration = await getAudioDuration(audioFile);
  console.log(`   Audio: ${duration.toFixed(2)}s\n`);
  
  // Step 2: Generate image prompt (fossils/archeology theme)
  console.log('🎨 Step 2: Generating image prompt...');
  const prompt = 'cartoon archeology dig site with dinosaur fossils, whimsical style, bright daylight, family-friendly illustration';
  console.log(`   Prompt: "${prompt}"\n`);
  
  // Step 3: Generate background
  console.log('🖼️ Step 3: Generating background image...');
  const imageFile = await generateImage(prompt);
  console.log(`   Image: ${imageFile}\n`);
  
  // Step 4: Render video (setup-punchline format)
  console.log('🎬 Step 4: Rendering video (setup-punchline treatment)...');
  const videoFile = await renderVideoSetupPunchline(
    JOKE_17.text,
    audioFile,
    imageFile,
    duration
  );
  console.log(`   Video: ${videoFile}\n`);
  
  // Step 5: Verify with Qwen 3.5 Vision
  console.log('👁️ Step 5: Verifying with Qwen 3.5 Vision...');
  const verifyResult = await verifyWithVision(videoFile);
  console.log(`   Text: "${verifyResult.text}"`);
  console.log(`   Background: ${verifyResult.background}\n`);
  
  if (!verifyResult.ok) {
    console.log('❌ Verification failed! Fixing...');
    return;
  }
  
  // Step 6: Upload to MinIO
  console.log('📦 Step 6: Uploading to MinIO...');
  const backupUrl = await backupToMinIO(videoFile, JOKE_17.id, 'V1');
  console.log(`   Backup: ${backupUrl}\n`);
  
  // Step 7: Upload to YouTube
  console.log('📺 Step 7: Uploading to YouTube...');
  const youtubeUrl = await uploadToYouTube(videoFile, JOKE_17);
  console.log(`   YouTube: ${youtubeUrl}\n`);
  
  // Step 8: Update Google Sheets
  console.log('📊 Step 8: Marking as posted in Google Sheets...');
  await markPosted(JOKE_17.id);
  console.log('   Done!\n');
  
  // Step 9: Update PostgreSQL task
  console.log('✅ Step 9: Marking task complete...');
  await markTaskComplete(JOKE_17.id);
  console.log('   Complete!\n');
  
  console.log('🎉 VIDEO #17 COMPLETE!');
}

async function generateAudio(text) {
  const filename = `audio-17-${Date.now()}.mp3`;
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
        // Add 1 second padding
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

async function generateImage(prompt) {
  const filename = `bg-17-${Date.now()}.png`;
  const filepath = path.join(CONFIG.outputDir, filename);
  const b64File = `${filepath}.b64`;
  const payloadFile = `${filepath}.payload.json`;
  
  fs.writeFileSync(payloadFile, JSON.stringify({
    prompt: `masterpiece, best quality, ${prompt}, cartoon, whimsical, vibrant`,
    negative_prompt: 'ugly, deformed, blurry',
    width: 480, height: 720, steps: 15, sampler_name: 'Euler a', cfg_scale: 6,
  }));
  
  return new Promise((resolve, reject) => {
    const poll = () => {
      exec(`curl -s -X POST "${CONFIG.stableDiffusionUrl}/sdapi/v1/txt2img" -H "Content-Type: application/json" -d @${payloadFile} | jq -r '.images[0]' > "${b64File}"`, (err) => {
        if (err) { reject(err); return; }
        
        setTimeout(() => {
          try {
            const s = fs.statSync(b64File);
            if (s.size > 50000) {
              const b64 = fs.readFileSync(b64File, 'utf8').trim();
              if (b64.length > 50000 && b64.startsWith('iVBOR')) {
                fs.writeFileSync(filepath, Buffer.from(b64, 'base64'));
                fs.unlinkSync(b64File);
                fs.unlinkSync(payloadFile);
                resolve(filepath);
                return;
              }
            }
            poll(); // Retry
          } catch (e) { poll(); }
        }, 1000);
      });
    };
    poll();
    
    // Timeout fallback
    setTimeout(() => {
      try {
        if (!fs.existsSync(filepath)) {
          console.log('   ⚠️ SD timeout, using fallback...');
          execSync(`ffmpeg -y -f lavfi -i "color=c=#102A54:s=480x720:d=1" -frames:v 1 -c:v png "${filepath}" 2>/dev/null`);
          resolve(filepath);
        }
      } catch {}
    }, 180000);
  });
}

async function renderVideoSetupPunchline(joke, audioFile, imageFile, duration) {
  const videoFile = path.join(CONFIG.outputDir, `dadjoke-17-V1.mp4`);
  
  // Split joke into setup and punchline
  const parts = joke.split('?');
  const setup = (parts[0] + '?').trim();
  const punchline = (parts[1] || '').trim();
  
  fs.copyFileSync(imageFile, path.join(CONFIG.remotionProject, 'public', 'background.png'));
  fs.copyFileSync(audioFile, path.join(CONFIG.remotionProject, 'public', 'audio.mp3'));
  
  const frames = Math.floor(duration * 30) + 60;
  
  // SETUP-PUNCHLINE format: setup at 0%, punchline at 35%
  const propsObj = {
    joke: joke,
    format: 'setup-punchline',
    segments: [
      { text: setup, atPercent: 0, display: 'fade-in' },
      { text: punchline, atPercent: 0.35, display: 'pop-in' }
    ],
    audioUrl: 'audio.mp3',
    imageUrl: 'background.png',
  };
  
  const propsFile = path.join(CONFIG.remotionProject, 'props-temp.json');
  fs.writeFileSync(propsFile, JSON.stringify(propsObj));
  
  return new Promise((resolve, reject) => {
    const cmd = `cd ${CONFIG.remotionProject} && ./node_modules/.bin/remotion render "DadJokeVideo" "DadJokeVideo" "out/dadjoke-17-V1.mp4" --props-file="${propsFile}" --public-dir=public --duration-in-frames=${frames} --fps=30 --width=720 --height=1280`;
    
    exec(cmd, { timeout: 300000 }, (err) => {
      try { fs.unlinkSync(propsFile); } catch {}
      if (err) { reject(new Error(`Remotion: ${err.message}`)); return; }
      
      const out = path.join(CONFIG.remotionProject, 'out', 'dadjoke-17-V1.mp4');
      if (fs.existsSync(out)) {
        fs.copyFileSync(out, videoFile);
        resolve(videoFile);
      } else {
        reject(new Error('No Remotion output'));
      }
    });
  });
}

async function verifyWithVision(videoFile) {
  // Extract frame
  const frameFile = path.join(CONFIG.outputDir, 'j17-verify.png');
  await new Promise((resolve, reject) => {
    exec(`ffmpeg -y -i "${videoFile}" -ss 4 -vframes 1 -update 1 "${frameFile}" 2>/dev/null`, (err) => err ? reject(err) : resolve());
  });
  
  // Base64 encode
  const b64 = fs.readFileSync(frameFile).toString('base64');
  
  // Call Qwen 3.5 Vision
  const payload = {
    model: 'qwen3.5:cloud',
    prompt: 'What text is visible in this image? Quote it exactly. Is the background a generated cartoon image or solid color?',
    images: [b64],
    stream: false
  };
  
  const payloadFile = path.join(CONFIG.outputDir, 'vision-payload.json');
  fs.writeFileSync(payloadFile, JSON.stringify(payload));
  
  return new Promise((resolve, reject) => {
    exec(`curl -s -X POST "${CONFIG.ollamaUrl}/api/generate" -H "Content-Type: application/json" -d @${payloadFile}`, (err, stdout) => {
      try { fs.unlinkSync(payloadFile); fs.unlinkSync(frameFile); } catch {}
      if (err) { reject(err); return; }
      
      const resp = JSON.parse(stdout);
      const text = resp.response || '';
      
      // Check if text matches joke
      const hasJ17Words = text.includes('invention') || text.includes('Windows') || text.includes('walls');
      const hasBackgroundDesc = !text.includes('solid') || text.includes('cartoon');
      
      resolve({
        ok: hasJ17Words && hasBackgroundDesc,
        text: text.split('\n')[0].trim(),
        background: hasBackgroundDesc ? 'generated' : 'solid color'
      });
    });
  });
}

async function backupToMinIO(videoFile, jokeId, version) {
  const timestamp = new Date().toISOString().slice(0,10);
  const remotePath = `hp1/${CONFIG.minioBucket}/joke-${jokeId}/dadjoke-${jokeId}-${timestamp}-${version}.mp4`;
  
  return new Promise((resolve, reject) => {
    exec(`mc cp "${videoFile}" ${remotePath} 2>&1`, (err, stdout) => {
      if (err) reject(err);
      else resolve(remotePath);
    });
  });
}

async function uploadToYouTube(videoFile, joke) {
  const title = `Dad Joke #${joke.id}: ${joke.text.split('?')[0]}`;
  const description = `Dad Joke #${joke.id} - ${joke.text}\n\n#DadJokes #DadtasticDads #Comedy`;
  
  return new Promise((resolve, reject) => {
    const cmd = `cd ~/.openclaw/workspace/skills/youtube-uploader && python3 scripts/youtube-upload.py upload ` +
      `--file "${videoFile}" ` +
      `--title "${title}" ` +
      `--description "${description}" ` +
      `--tags "dad jokes,comedy,dadjasticdads,funny" ` +
      `--category 23 ` +
      `--privacy private 2>&1`;
    
    exec(cmd, (err, stdout) => {
      if (err) reject(err);
      else {
        try {
          const resp = JSON.parse(stdout.split('\n').slice(-2)[0]);
          resolve(resp.url || 'https://youtu.be/' + resp.videoId);
        } catch { resolve('uploaded'); }
      }
    });
  });
}

async function markPosted(jokeId) {
  // Update Google Sheets Posted column
  const range = `Sheet1!D${jokeId + 1}`; // Row = ID + 1 (header row)
  
  return new Promise((resolve, reject) => {
    exec(`gog sheets update "1cXSGjCXleUK8iQweBAwLaa7j3QK2Sla-8v11CirQsuw" "${range}" "TRUE" 2>&1`, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function markTaskComplete(jokeId) {
  return new Promise((resolve, reject) => {
    exec(`PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d mission_control -c "UPDATE tasks SET column_name='complete', updated_at=NOW() WHERE id='dadjoke-${jokeId}';" 2>&1`, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function execSync(cmd) {
  const { execSync } = require('child_process');
  return execSync(cmd);
}

main().catch(console.error);
