#!/usr/bin/env node
/**
 * Regenerate Dad Joke #12 with 1-second buffers
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  audioFile: '/home/kevin/.openclaw/workspace/dadtasticdads-output/audio-12.mp3',
  imageFile: '/home/kevin/.openclaw/workspace/dadtasticdads-output/bg-12.png',
  remotionProject: '/home/kevin/.openclaw/workspace/dadtasticdads-remotion',
  outputDir: '/home/kevin/.openclaw/workspace/dadtasticdads-output',
  joke: "My dog used to chase people on a bike a lot. It got so bad I had to take his bike away.",
  segments: [
    { text: "My dog used to chase people on a bike a lot.", atPercent: 0, display: "fade-in" },
    { text: "It got so bad I had to take his bike away.", atPercent: 0.6, display: "pop-in" }
  ]
};

async function main() {
  console.log('🎬 Regenerating Dad Joke #12 with 1-second buffers...\n');
  
  // Copy files to Remotion public folder
  const publicDir = path.join(CONFIG.remotionProject, 'public');
  const audioDest = path.join(publicDir, 'audio.mp3');
  const imageDest = path.join(publicDir, 'background.png');
  
  // Download image from MinIO if not exists
  if (!fs.existsSync(CONFIG.imageFile.replace('bg-12.png', '12-background.png'))) {
    console.log('📥 Downloading image from MinIO...');
    execSync(`mc cp hp1/dadjokes/12/12-background.png ${CONFIG.imageFile}`);
  }
  
  fs.copyFileSync(CONFIG.imageFile.replace('bg-12.png', '12-background.png'), imageDest);
  fs.copyFileSync(CONFIG.audioFile, audioDest);
  
  // Get audio duration
  const audioDuration = await getAudioDuration(CONFIG.audioFile);
  console.log(`📊 Audio duration: ${audioDuration.toFixed(2)}s`);
  
  // Calculate frames: 1 sec buffer + audio + 1 sec buffer (at 30fps)
  const totalDuration = audioDuration + 2; // +2 seconds (1 before, 1 after)
  const frames = Math.floor(totalDuration * 30);
  const punchlineFrame = Math.floor((1 + audioDuration * 0.6) * 30); // Punchline at 60% through audio, offset by 1s buffer
  
  console.log(`📐 Total frames: ${frames} (${totalDuration.toFixed(2)}s)`);
  console.log(`🎯 Punchline frame: ${punchlineFrame} (${(punchlineFrame/30).toFixed(2)}s)\n`);
  
  // Build props
  const propsArg = JSON.stringify({
    joke: CONFIG.joke,
    format: 'setup-punchline',
    segments: CONFIG.segments,
    audioUrl: 'file://' + audioDest,
    imageUrl: 'file://' + imageDest,
    bufferSeconds: 1, // Tell Remotion to add buffers
  }).replace(/"/g, '\\"');
  
  const videoName = 'dadjoke-12-v2.mp4';
  const videoFile = path.join(CONFIG.outputDir, videoName);
  
  console.log('🎥 Rendering with Remotion...');
  
  return new Promise((resolve, reject) => {
    const cmd = `cd ${CONFIG.remotionProject} && npx remotion render "DadJokeVideo" "DadJokeVideo" "out/${videoName}" --props="${propsArg}" --public-dir="${publicDir}" --duration-in-frames=${frames} --fps=30 --width=720 --height=1280`;
    
    exec(cmd, { timeout: 300000 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`Remotion failed: ${err.message}\n${stderr}`));
        return;
      }
      
      const remotionOut = path.join(CONFIG.remotionProject, 'out', videoName);
      if (fs.existsSync(remotionOut)) {
        fs.copyFileSync(remotionOut, videoFile);
        const stats = fs.statSync(videoFile);
        console.log(`\n✅ Render complete!`);
        console.log(`   Output: ${videoFile}`);
        console.log(`   Size: ${(stats.size/1024/1024).toFixed(2)} MB`);
        resolve(videoFile);
      } else {
        reject(new Error('No output from Remotion'));
      }
    });
  });
}

function getAudioDuration(audioFile) {
  return new Promise((resolve, reject) => {
    exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioFile}"`, 
      (err, stdout) => {
        if (err) reject(new Error('No duration'));
        else resolve(parseFloat(stdout.trim()));
      });
  });
}

function execSync(cmd) {
  const { execSync } = require('child_process');
  return execSync(cmd);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
