#!/usr/bin/env node
/**
 * Whisper transcription with auto-save to Mission Control
 * 
 * Features:
 * - Automatic chunking for long files (>30 min splits into segments)
 * - Saves transcript to /mnt/openclaw/workspace/transcriptions/
 * - Creates .meta.json companion file for MC display
 * - Supports local files AND YouTube URLs
 * 
 * Usage:
 *   node whisper-transcribe-and-save.js <audio_file> [--name "Display Name"]
 *   node whisper-transcribe-and-save.js --youtube <url> [--name "Display Name"]
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync, exec } = require('child_process');

const TRANSCRIPTIONS_DIR = '/mnt/openclaw/workspace/transcriptions';
const LOCAL_API = 'http://localhost:8777';
const CHUNK_DURATION_MINUTES = 15; // Split files longer than this
const MAX_CHUNK_DURATION_MINUTES = 30; // Always split files longer than this

async function transcribeAPI(audioPath) {
  const audioData = fs.readFileSync(audioPath);
  const ext = path.extname(audioPath).toLowerCase();
  const contentTypes = {
    '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4',
    '.ogg': 'audio/ogg', '.webm': 'audio/webm', '.flac': 'audio/flac',
    '.mp4': 'audio/mp4'
  };

  return new Promise((resolve, reject) => {
    const req = http.request(`${LOCAL_API}/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': contentTypes[ext] || 'audio/wav',
        'Content-Length': audioData.length
      },
      timeout: 1800000, // 30 minute timeout for long files
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`Parse error: ${body.substring(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('API request timed out')); });
    req.write(audioData);
    req.end();
  });
}

function getAudioDuration(filePath) {
  try {
    const output = execSync(
      `ffprobe -i "${filePath}" -show_entries format=duration -v quiet -of csv=p=0`,
      { encoding: 'utf-8' }
    );
    return parseFloat(output.trim());
  } catch {
    return null;
  }
}

function chunkAudio(filePath, chunkMinutes) {
  const chunkDir = fs.mkdtempSync('/tmp/whisper-chunks-');
  const chunkDurationSec = chunkMinutes * 60;
  
  try {
    execSync(
      `ffmpeg -i "${filePath}" -f segment -segment_time ${chunkDurationSec} -c copy "${chunkDir}/chunk_%03d${path.extname(filePath)}" -y 2>/dev/null`
    );
  } catch {
    // Try with re-encoding if copy fails (some formats don't support segmenting)
    execSync(
      `ffmpeg -i "${filePath}" -f segment -segment_time ${chunkDurationSec} -ar 16000 -ac 1 "${chunkDir}/chunk_%03d.wav" -y 2>/dev/null`
    );
  }
  
  const chunks = fs.readdirSync(chunkDir)
    .filter(f => f.startsWith('chunk_'))
    .sort()
    .map(f => path.join(chunkDir, f));
  
  return { chunks, chunkDir };
}

async function downloadYouTube(url) {
  const tmpFile = '/tmp/yt-audio.%(ext)s';
  execSync(
    `yt-dlp -x --audio-format mp3 -o "${tmpFile}" "${url}" 2>&1`,
    { encoding: 'utf-8', timeout: 300000 }
  );
  // Find the downloaded file
  const mp3File = '/tmp/yt-audio.mp3';
  if (fs.existsSync(mp3File)) return mp3File;
  
  // Try other extensions
  for (const ext of ['.webm', '.m4a', '.ogg', '.wav']) {
    const f = `/tmp/yt-audio${ext}`;
    if (fs.existsSync(f)) return f;
  }
  throw new Error('Could not find downloaded YouTube audio');
}

async function checkHealth() {
  return new Promise((resolve, reject) => {
    const req = http.get(`${LOCAL_API}/health`, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { resolve(null); }
      });
    });
    req.on('error', () => reject(new Error('Whisper API not running')));
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('Whisper API timeout')); });
  });
}

async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  let audioPath = null;
  let youtubeUrl = null;
  let customName = null;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      customName = args[++i];
    } else if (args[i] === '--youtube' && args[i + 1]) {
      youtubeUrl = args[++i];
    } else if (!args[i].startsWith('--')) {
      audioPath = args[i];
    }
  }
  
  // Download YouTube if needed
  if (youtubeUrl) {
    console.log(`Downloading YouTube audio: ${youtubeUrl}`);
    audioPath = await downloadYouTube(youtubeUrl);
    if (!customName) {
      try {
        customName = execSync(`yt-dlp --get-title "${youtubeUrl}" 2>/dev/null`, { encoding: 'utf-8' }).trim();
      } catch { customName = 'YouTube Video'; }
    }
  }
  
  if (!audioPath || !fs.existsSync(audioPath)) {
    console.error('Usage: node whisper-transcribe-and-save.js <audio_file> [--name "Name"]');
    console.error('   or: node whisper-transcribe-and-save.js --youtube <url> [--name "Name"]');
    process.exit(1);
  }
  
  // Check Whisper API
  try {
    const health = await checkHealth();
    if (!health || health.status !== 'ok') {
      console.error('Whisper API not available. Start it with: systemctl --user start whisper-api');
      process.exit(1);
    }
    console.log(`Whisper API ready (model: ${health.model})`);
  } catch {
    console.error('Whisper API not running. Start it with: systemctl --user start whisper-api');
    process.exit(1);
  }
  
  // Get duration
  const duration = getAudioDuration(audioPath);
  if (duration) {
    console.log(`Audio duration: ${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')} (${Math.round(duration)}s)`);
  }
  
  // Decide: chunk or single?
  const durationMin = duration ? duration / 60 : 0;
  let result;
  let usedChunking = false;
  
  if (duration && durationMin > MAX_CHUNK_DURATION_MINUTES) {
    // Long file: chunk it
    const chunkMin = CHUNK_DURATION_MINUTES;
    console.log(`Long file (${Math.round(durationMin)} min) — splitting into ${chunkMin}-min chunks...`);
    const { chunks, chunkDir } = chunkAudio(audioPath, chunkMin);
    console.log(`Created ${chunks.length} chunks`);
    
    const allSegments = [];
    let fullText = [];
    let totalDuration = 0;
    let totalProcessingTime = 0;
    let detectedLanguage = null;
    let langProb = 0;
    
    for (let i = 0; i < chunks.length; i++) {
      console.log(`Transcribing chunk ${i + 1}/${chunks.length}...`);
      const chunkResult = await transcribeAPI(chunks[i]);
      
      if (chunkResult.error) {
        console.error(`Error on chunk ${i + 1}: ${chunkResult.error}`);
        continue;
      }
      
      // Offset segment times by cumulative duration
      const offset = totalDuration;
      for (const seg of (chunkResult.segments || [])) {
        allSegments.push({
          start: Math.round((seg.start + offset) * 100) / 100,
          end: Math.round((seg.end + offset) * 100) / 100,
          text: seg.text
        });
      }
      
      fullText.push(chunkResult.text);
      totalDuration += chunkResult.duration || 0;
      totalProcessingTime += chunkResult.processing_time || 0;
      if (!detectedLanguage && chunkResult.language) {
        detectedLanguage = chunkResult.language;
        langProb = chunkResult.language_probability || 0;
      }
      
      console.log(`  Chunk ${i + 1} done (${Math.round(chunkResult.duration || 0)}s, speed: ${chunkResult.speed_ratio}x)`);
    }
    
    result = {
      text: fullText.join(' '),
      segments: allSegments,
      language: detectedLanguage || 'en',
      language_probability: langProb,
      duration: totalDuration,
      processing_time: totalProcessingTime,
      speed_ratio: totalProcessingTime > 0 ? Math.round(totalDuration / totalProcessingTime * 100) / 100 : 0,
      model: 'base',
      chunked: true,
      chunk_count: chunks.length
    };
    usedChunking = true;
    
    // Cleanup chunks
    for (const chunk of chunks) {
      try { fs.unlinkSync(chunk); } catch {}
    }
    try { fs.rmdirSync(chunkDir); } catch {}
    
  } else {
    // Short file: transcribe directly
    console.log(`Transcribing: ${audioPath}`);
    result = await transcribeAPI(audioPath);
    
    if (result.error) {
      console.error(`Transcription error: ${result.error}`);
      process.exit(1);
    }
  }
  
  // Generate filename
  const date = new Date().toISOString().split('T')[0];
  const originalBasename = path.basename(audioPath, path.extname(audioPath));
  const safeName = (customName || originalBasename).replace(/[^a-zA-Z0-9_ -]/g, '').substring(0, 80);
  const filename = `${date}_${safeName.replace(/\s+/g, '_')}.txt`;
  const displayName = customName || originalBasename.replace(/[-_]/g, ' ');
  
  // Ensure transcriptions directory exists
  if (!fs.existsSync(TRANSCRIPTIONS_DIR)) {
    fs.mkdirSync(TRANSCRIPTIONS_DIR, { recursive: true });
  }
  
  // Format transcript
  const lines = [
    `Transcription: ${displayName}`,
    `Date: ${new Date().toISOString()}`,
    `Duration: ${Math.floor(result.duration / 60)}:${String(Math.floor(result.duration % 60)).padStart(2, '0')} (${Math.round(result.duration)}s)`,
    `Language: ${result.language} (${(result.language_probability * 100).toFixed(1)}%)`,
    `Model: ${result.model}`,
  ];
  
  if (result.chunked) {
    lines.push(`Chunked: Yes (${result.chunk_count} chunks, ${CHUNK_DURATION_MINUTES}-min segments)`);
  }
  if (result.speed_ratio) {
    lines.push(`Speed: ${result.speed_ratio}x realtime`);
  }
  
  lines.push('='.repeat(60));
  lines.push('');
  
  // Add timestamped transcript if we have segments
  if (result.segments && result.segments.length > 0) {
    for (const seg of result.segments) {
      const startMin = Math.floor(seg.start / 60);
      const startSec = Math.floor(seg.start % 60);
      lines.push(`[${startMin}:${String(startSec).padStart(2, '0')}] ${seg.text}`);
    }
  } else {
    lines.push(result.text);
  }
  
  const txtPath = path.join(TRANSCRIPTIONS_DIR, filename);
  fs.writeFileSync(txtPath, lines.join('\n'), 'utf-8');
  
  // Save metadata
  const metaPath = path.join(TRANSCRIPTIONS_DIR, filename.replace('.txt', '.meta.json'));
  const meta = {
    originalName: path.basename(audioPath),
    displayName,
    createdAt: new Date().toISOString(),
    duration: result.duration,
    language: result.language,
    languageProbability: result.language_probability,
    model: result.model,
    processingTime: result.processing_time,
    speedRatio: result.speed_ratio,
    segmentCount: result.segments?.length || 0,
    chunked: usedChunking,
    chunkCount: result.chunk_count || null,
    chunkDurationMinutes: usedChunking ? CHUNK_DURATION_MINUTES : null,
  };
  if (youtubeUrl) meta.sourceUrl = youtubeUrl;
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  
  // Archive source audio
  const audioDir = path.join(TRANSCRIPTIONS_DIR, 'audio');
  if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
  const audioArchive = path.join(audioDir, filename.replace('.txt', path.extname(audioPath) || '.mp3'));
  try {
    fs.copyFileSync(audioPath, audioArchive);
    console.log(`   Audio archived: ${audioArchive}`);
  } catch (e) {
    console.log(`   Audio archive skipped: ${e.message}`);
  }
  // Update meta with audio file path
  meta.audioFile = path.basename(audioArchive);
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

  // Auto-generate readable format
  const readableFilename = filename.replace('.txt', '_READABLE.md');
  const readablePath = path.join(TRANSCRIPTIONS_DIR, readableFilename);
  try {
    const { execSync } = require('child_process');
    execSync(`node tools/format-transcription.js "${txtPath}" --format readable --type auto --output "${readablePath}"`, {
      cwd: '/home/kevin/.openclaw/workspace',
      encoding: 'utf-8',
      timeout: 30000
    });
    console.log(`   Readable format: ${readablePath}`);
  } catch (e) {
    console.log(`   Readable format skipped: ${e.message}`);
  }
  // Update meta with formats
  meta.formats = {
    raw: filename,
    readable: readableFilename,
    audio: path.basename(audioArchive)
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

  // Cleanup YouTube temp download
  if (youtubeUrl && audioPath.startsWith('/tmp/')) {
    try { fs.unlinkSync(audioPath); } catch {}
  }
  
  console.log(`\n✅ Transcription saved: ${txtPath}`);
  console.log(`   Duration: ${Math.floor(result.duration / 60)}:${String(Math.floor(result.duration % 60)).padStart(2, '0')} | Language: ${result.language} | Speed: ${result.speed_ratio}x realtime`);
  if (usedChunking) {
    console.log(`   Chunked: ${result.chunk_count} segments of ${CHUNK_DURATION_MINUTES} min each`);
  }
  console.log(`\nView at: http://192.168.1.56:8765/transcriptions`);
}

main().catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});