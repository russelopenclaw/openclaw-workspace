#!/usr/bin/env node
/**
 * Step 4: Full Cycle Assembly
 * 
 * Stitches 40 image clips into 20-minute loopable cycle
 * - 40 clips × 27s = 1080s (18 min)
 * - 39 transitions × 3s = 117s
 * - Total: ~20 minutes
 * - Seamless loop: clip_40 → clip_01
 * 
 * Usage:
 *   node tools/screensaver-stitch-cycle.js --theme cherry-blossom
 *   node tools/screensaver-stitch-cycle.js --clips clips/*.mp4 --output cycle.mp4
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const MINIO_REMOTE = 'hp1';

/**
 * Download clips from MinIO to temp directory
 */
function downloadClips(theme) {
  console.log(`📥 Downloading clips for ${theme}...`);
  
  const tempDir = `/tmp/screensaver-${theme}-${Date.now()}`;
  fs.mkdirSync(tempDir, { recursive: true });
  
  try {
    execSync(`mc cp ${MINIO_REMOTE}/screensavers/${theme}/clips/ ${tempDir}/ --recursive`, {
      stdio: 'pipe',
      timeout: 120000
    });
    
    const clips = fs.readdirSync(tempDir)
      .filter(f => f.endsWith('.mp4'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || 0);
        const numB = parseInt(b.match(/\d+/)?.[0] || 0);
        return numA - numB;
      });
    
    if (clips.length !== 40) {
      throw new Error(`Expected 40 clips, found ${clips.length}`);
    }
    
    console.log(`  ✓ Downloaded ${clips.length} clips`);
    return { tempDir, clips: clips.map(c => path.join(tempDir, c)) };
    
  } catch (e) {
    throw new Error(`Failed to download clips: ${e.message}`);
  }
}

/**
 * Build filter_complex for xfade transitions
 * Creates seamless chain with 3s crossfade between each clip
 */
function buildXfadeFilter(clips, duration = 27, transition = 3) {
  const offsets = [];
  let offset = duration;
  
  // Calculate offsets for each transition
  for (let i = 0; i < clips.length - 1; i++) {
    offsets.push(offset - transition); // Overlap by transition duration
    offset += duration - transition;
  }
  
  // For loop: connect last to first
  const loopOffset = offset - transition;
  
  // Build filter_complex
  let inputs = '';
  let filters = '';
  
  for (let i = 0; i < clips.length; i++) {
    inputs += ` -i "${clips[i]}"`;
  }
  
  // Chain xfade transitions
  let currentOut = '[0:v]';
  let outIndex = 0;
  
  for (let i = 0; i < clips.length - 1; i++) {
    const nextIdx = i + 1;
    const nextLabel = i === clips.length - 2 ? '[outv]' : `[v${i}]`;
    
    filters += `${currentOut}[${nextIdx}:v]xfade=transition=fade:duration=${transition}:offset=${offsets[i]}:easing=linear${nextLabel};`;
    currentOut = `[v${i}]`;
    outIndex = i;
  }
  
  // Add loop transition (last → first)
  // Create a short segment that fades from last to first
  filters += `${currentOut}[0:v]xfade=transition=fade:duration=${transition}:offset=${loopOffset}:easing=linear[outv];`;
  
  return { inputs, filters: filters.slice(0, -1) };
}

/**
 * Stitch clips into cycle
 */
function stitchCycle(clips, outputPath, theme) {
  console.log(`🎬 Stitching ${clips.length} clips into cycle...`);
  console.log(`   Effect: 3s crossfade between clips`);
  console.log(`   Loop: clip_${clips.length} → clip_1 seamless`);
  
  const { inputs, filters } = buildXfadeFilter(clips);
  
  const cmd = `ffmpeg -y ${inputs} -filter_complex "${filters}" -map "[outv]" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p "${outputPath}"`;
  
  console.log('   Rendering...');
  
  try {
    execSync(cmd, { stdio: 'pipe', timeout: 300000 });
    console.log(`  ✓ Cycle created: ${outputPath}`);
    return true;
  } catch (e) {
    throw new Error(`Stitching failed: ${e.message}`);
  }
}

/**
 * Validate cycle
 */
function validateCycle(outputPath) {
  console.log('\n🔍 Validating cycle...');
  
  // Check duration
  const duration = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${outputPath}"`,
    { encoding: 'utf8' }
  ).trim();
  
  // Check resolution
  const resolution = execSync(
    `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${outputPath}"`,
    { encoding: 'utf8' }
  ).trim();
  
  // Check file size
  const stats = fs.statSync(outputPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  
  console.log(`   Duration: ${parseFloat(duration).toFixed(2)}s (${(parseFloat(duration)/60).toFixed(1)} min)`);
  console.log(`   Resolution: ${resolution}`);
  console.log(`   Size: ${sizeMB} MB`);
  
  // Target: ~20 min (1200s)
  const dur = parseFloat(duration);
  if (dur < 1140 || dur > 1260) {
    console.log(`   ⚠️  Duration outside expected range (1140-1260s)`);
  } else {
    console.log(`   ✅ Duration within expected range`);
  }
  
  return { duration: dur, resolution, sizeMB };
}

/**
 * Upload to MinIO
 */
function uploadCycle(theme, cyclePath) {
  console.log(`\n☁️ Uploading cycle to MinIO...`);
  
  const dest = `${MINIO_REMOTE}/screensavers/${theme}/cycles/${theme}_20min_cycle.mp4`;
  
  try {
    execSync(`mc cp "${cyclePath}" ${dest}`, { stdio: 'pipe' });
    console.log(`  ✓ Uploaded: ${dest}`);
    return dest;
  } catch (e) {
    throw new Error(`Upload failed: ${e.message}`);
  }
}

/**
 * Main cycle builder
 */
async function buildCycle(options) {
  const { theme, upload = true, cleanup = true } = options;
  
  console.log(`\n🎬 Step 4: Full Cycle Assembly`);
  console.log(`   Theme: ${theme}`);
  console.log(`   Source: ${MINIO_REMOTE}/screensavers/${theme}/clips/`);
  
  // Step 1: Download clips
  const { tempDir, clips } = downloadClips(theme);
  
  try {
    // Step 2: Stitch
    const cyclePath = `${tempDir}/${theme}_20min_cycle.mp4`;
    stitchCycle(clips, cyclePath, theme);
    
    // Step 3: Validate
    const validation = validateCycle(cyclePath);
    
    // Step 4: Upload
    let minioPath = null;
    if (upload) {
      minioPath = uploadCycle(theme, cyclePath);
    }
    
    console.log('\n✅ Cycle assembly complete!');
    
    return {
      success: true,
      localPath: cyclePath,
      minioPath,
      validation,
      tempDir
    };
    
  } catch (e) {
    console.error(`\n❌ Error: ${e.message}`);
    throw e;
    
  } finally {
    // Cleanup
    if (cleanup && fs.existsSync(tempDir)) {
      console.log(`\n🧹 Cleaning up temp directory...`);
      execSync(`rm -rf ${tempDir}`);
    }
  }
}

// CLI
if (require.main === module) {
  const args = require('minimist')(process.argv.slice(2));
  
  if (args.help || args.h) {
    console.log('Step 4: Full Cycle Assembly');
    console.log('');
    console.log('Usage:');
    console.log('  node tools/screensaver-stitch-cycle.js --theme cherry-blossom');
    console.log('');
    console.log('Options:');
    console.log('  --theme <name>     Theme name (required)');
    console.log('  --no-upload        Skip MinIO upload');
    console.log('  --no-cleanup       Keep temp files');
    console.log('  --help, -h         Show this help');
    process.exit(0);
  }
  
  if (!args.theme) {
    console.error('❌ --theme required');
    process.exit(1);
  }
  
  buildCycle({
    theme: args.theme,
    upload: !args['no-upload'],
    cleanup: !args['no-cleanup']
  }).then(result => {
    console.log('\n🎉 Success!');
    console.log(`   Duration: ${result.validation.duration.toFixed(1)}s`);
    console.log(`   Size: ${result.validation.sizeMB} MB`);
    console.log(`   Location: ${result.minioPath || result.localPath}`);
    process.exit(0);
  }).catch(e => {
    console.error(`\n❌ Failed: ${e.message}`);
    process.exit(1);
  });
}

module.exports = { buildCycle, stitchCycle, validateCycle };
