#!/usr/bin/env node
/**
 * Step 3: Image → Video N8N Flow
 * 
 * Creates 27-second Ken Burns-style videos from still images.
 * Called by n8n webhook for each validated image.
 * 
 * Webhook: POST https://n8n.wolfeinkc.uk/webhook/screensaver-image-video
 * 
 * Input (JSON):
 * {
 *   "theme": "cherry-blossom",
 *   "clip_number": 1,
 *   "image_path": "hp1/screensavers/cherry-blossom/raw/img_01.png",
 *   "effect_type": "zoom_in",
 *   "effect_duration": 27,
 *   "output_path": "hp1/screensavers/cherry-blossom/clips/clip_01.mp4"
 * }
 * 
 * Output (JSON):
 * {
 *   "success": true,
 *   "clip_path": "hp1/screensavers/cherry-blossom/clips/clip_01.mp4",
 *   "duration": 27.0,
 *   "resolution": "1920x1080",
 *   "size_mb": 12.5
 * }
 */

const http = require('http');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const MINIO_REMOTE = 'hp1';
const PORT = process.env.SCREENSAVER_VIDEO_PORT || 3456;

/**
 * Ken Burns effect ffmpeg filter
 */
function getEffectFilter(effect, duration = 27) {
  const fps = 30;
  const totalFrames = duration * fps;
  
  const filters = {
    zoom_in: `zoompan=z='min(zoom+0.0011,1.10)':d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080`,
    zoom_out: `zoompan=z='max(zoom-0.0011,1.0)':d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080`,
    pan_left: `crop=iw*0.9:ih*0.9:x='if(gte(t,0),iw*0.1*(t/${duration}),0)':y=ih*0.05,scale=1920:1080`,
    pan_right: `crop=iw*0.9:ih*0.9:x='if(gte(t,0),iw*0.1*(1-t/${duration}),0)':y=ih*0.05,scale=1920:1080`,
    pan_up: `crop=iw*0.9:ih*0.9:x=iw*0.05:y='if(gte(t,0),ih*0.1*(1-t/${duration}),0)',scale=1920:1080`,
    pan_down: `crop=iw*0.9:ih*0.9:x=iw*0.05:y='if(gte(t,0),ih*0.1*(t/${duration}),0)',scale=1920:1080`,
    zoom_in_pan_right: `zoompan=z='min(zoom+0.001,1.1)':d=${totalFrames}:x='iw/2-(iw/zoom/2)+iw*0.05*(t/${duration})':y='ih/2-(ih/zoom/2)':s=1920x1080`,
    none: `scale=1920:1080`
  };
  
  const baseFilter = filters[effect] || filters.zoom_in;
  
  // Add fade in/out for smooth transitions (0.5s each)
  const fadeFilter = `fade=t=in:st=0:d=0.5,fade=t=out:st=${duration - 0.5}:d=0.5`;
  
  return `${baseFilter},${fadeFilter}`;
}

/**
 * Download image from MinIO
 */
function downloadImage(imagePath, tempPath) {
  console.log(`  📥 Downloading: ${imagePath}`);
  
  try {
    execSync(`mc cp ${MINIO_REMOTE}/${imagePath} "${tempPath}"`, {
      stdio: 'pipe',
      timeout: 60000
    });
    
    const stats = fs.statSync(tempPath);
    console.log(`     Size: ${(stats.size / 1024).toFixed(2)} KB`);
    
    return true;
  } catch (e) {
    throw new Error(`Download failed: ${e.message}`);
  }
}

/**
 * Generate 27-second clip with Ken Burns effect
 */
function generateClip(imagePath, outputPath, effect, duration = 27) {
  console.log(`  🎬 Generating ${effect} video (${duration}s)...`);
  
  const filter = getEffectFilter(effect, duration);
  
  const cmd = `ffmpeg -y -loop 1 -i "${imagePath}" -vf "${filter}" ` +
    `-c:v libx264 -preset fast -crf 23 -t ${duration} -pix_fmt yuv420p "${outputPath}"`;
  
  try {
    execSync(cmd, { stdio: 'pipe', timeout: 180000 });
    
    const stats = fs.statSync(outputPath);
    console.log(`     Created: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
    
    return true;
  } catch (e) {
    throw new Error(`Video generation failed: ${e.message}`);
  }
}

/**
 * Validate clip
 */
function validateClip(clipPath) {
  console.log(`  🔍 Validating clip...`);
  
  const duration = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${clipPath}"`,
    { encoding: 'utf8' }
  ).trim();
  
  const resolution = execSync(
    `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${clipPath}"`,
    { encoding: 'utf8' }
  ).trim();
  
  console.log(`     Duration: ${parseFloat(duration).toFixed(2)}s`);
  console.log(`     Resolution: ${resolution}`);
  
  return {
    duration: parseFloat(duration),
    resolution,
    valid: Math.abs(parseFloat(duration) - 27) < 1.0 && resolution.includes('1920')
  };
}

/**
 * Upload clip to MinIO
 */
function uploadClip(clipPath, destPath) {
  console.log(`  ☁️ Uploading to MinIO: ${destPath}`);
  
  try {
    execSync(`mc cp "${clipPath}" ${MINIO_REMOTE}/${destPath}`, {
      stdio: 'pipe',
      timeout: 120000
    });
    
    console.log(`     ✓ Uploaded`);
    return true;
  } catch (e) {
    throw new Error(`Upload failed: ${e.message}`);
  }
}

/**
 * Process image→video request
 */
async function processImageVideo(requestBody) {
  const { theme, clip_number, image_path, effect_type, effect_duration = 27, output_path } = requestBody;
  
  if (!theme || !clip_number || !image_path || !effect_type) {
    throw new Error('Missing required fields: theme, clip_number, image_path, effect_type');
  }
  
  console.log(`\n🎬 Step 3: Image → Video`);
  console.log(`   Theme: ${theme}`);
  console.log(`   Clip: ${clip_number}`);
  console.log(`   Effect: ${effect_type}`);
  
  // Create temp directory
  const tempDir = `/tmp/screensaver-clip-${theme}-${Date.now()}`;
  fs.mkdirSync(tempDir, { recursive: true });
  
  const tempImage = path.join(tempDir, 'input.png');
  const tempClip = path.join(tempDir, 'clip.mp4');
  
  try {
    // Step 1: Download image
    downloadImage(image_path, tempImage);
    
    // Step 2: Generate clip
    generateClip(tempImage, tempClip, effect_type, effect_duration);
    
    // Step 3: Validate
    const validation = validateClip(tempClip);
    
    if (!validation.valid) {
      throw new Error(`Validation failed: duration=${validation.duration}, resolution=${validation.resolution}`);
    }
    
    // Step 4: Upload
    uploadClip(tempClip, output_path);
    
    // Step 5: Return result
    const stats = fs.statSync(tempClip);
    
    return {
      success: true,
      clip_path: output_path,
      duration: validation.duration,
      resolution: validation.resolution,
      size_mb: (stats.size / (1024 * 1024)).toFixed(2)
    };
    
  } catch (e) {
    console.error(`  ❌ Error: ${e.message}`);
    throw e;
    
  } finally {
    // Cleanup
    if (fs.existsSync(tempDir)) {
      execSync(`rm -rf ${tempDir}`);
    }
  }
}

/**
 * HTTP server for n8n webhook
 */
const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end('Method not allowed');
    return;
  }
  
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const requestBody = JSON.parse(body);
      const result = await processImageVideo(requestBody);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      
    } catch (e) {
      console.error('Request failed:', e.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
  });
});

// Start server
if (require.main === module) {
  console.log('🎬 Step 3: Image → Video N8N Flow');
  console.log('   Listening on port', PORT);
  console.log('   Webhook: POST /screensaver-image-video');
  console.log('');
  console.log('Test with:');
  console.log('curl -X POST http://localhost:' + PORT + '/screensaver-image-video \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'{"theme":"cherry-blossom","clip_number":1,"image_path":"hp1/screensavers/cherry-blossom/raw/img_01.png","effect_type":"zoom_in","output_path":"hp1/screensavers/cherry-blossom/clips/clip_01.mp4"}\'');
  
  server.listen(PORT, () => {
    console.log('\n✅ Server ready');
  });
}

module.exports = { processImageVideo, getEffectFilter };
