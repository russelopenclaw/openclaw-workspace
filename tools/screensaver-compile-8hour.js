#!/usr/bin/env node
/**
 * Step 5: 8-Hour Compilation
 * 
 * Compiles 20-minute cycles into 8-hour video
 * - Loops cycle 24x = 480 min = 8 hours
 * - Adds zen background music (optional)
 * - Final output: 8-hour screensaver
 * 
 * Usage:
 *   node tools/screensaver-compile-8hour.js --theme cherry-blossom
 *   node tools/screensaver-compile-8hour.js --theme cherry-blossom --audio zen.mp3
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const MINIO_REMOTE = 'hp1';

// Open source zen music sources
const ZEN_AUDIO_SOURCES = [
  {
    name: 'Rain on Leaves',
    url: 'https://freesound.org/data/previews/346/346562_5121236-lq.mp3',
    duration: '2:00',
    license: 'CC0'
  },
  {
    name: 'Gentle Stream',
    url: 'https://freesound.org/data/previews/372/372152_5121236-lq.mp3',
    duration: '2:00',
    license: 'CC0'
  },
  {
    name: 'Forest Ambience',
    url: 'https://freesound.org/data/previews/368/368735_5121236-lq.mp3',
    duration: '3:00',
    license: 'CC0'
  }
];

/**
 * Download cycle from MinIO
 */
function downloadCycle(theme) {
  console.log(`📥 Downloading 20-min cycle for ${theme}...`);
  
  const tempDir = `/tmp/screensaver-8h-${theme}-${Date.now()}`;
  fs.mkdirSync(tempDir, { recursive: true });
  
  const cyclePath = `${tempDir}/cycle.mp4`;
  
  try {
    execSync(`mc cp ${MINIO_REMOTE}/screensavers/${theme}/cycles/${theme}_20min_cycle.mp4 ${cyclePath}`, {
      stdio: 'pipe',
      timeout: 120000
    });
    
    // Verify
    const stats = fs.statSync(cyclePath);
    console.log(`  ✓ Downloaded: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
    
    return { tempDir, cyclePath };
    
  } catch (e) {
    throw new Error(`Failed to download cycle: ${e.message}`);
  }
}

/**
 * Loop cycle to 8 hours (24x)
 */
function loopTo8Hours(cyclePath, outputPath, loops = 24) {
  console.log(`\n🔄 Looping ${loops}x to create 8-hour video...`);
  
  // Create concat file
  const concatPath = path.join(path.dirname(cyclePath), 'concat.txt');
  let concatContent = '';
  
  for (let i = 0; i < loops; i++) {
    concatContent += `file '${cyclePath}'\n`;
  }
  
  fs.writeFileSync(concatPath, concatContent);
  
  // Build with ffmpeg (fast, -c copy)
  console.log(`   Concatenating ${loops} cycles...`);
  
  try {
    execSync(
      `ffmpeg -y -f concat -safe 0 -i "${concatPath}" -c copy "${outputPath}"`,
      { stdio: 'pipe', timeout: 600000 }
    );
    
    console.log(`  ✓ Created: ${outputPath}`);
    
    // Cleanup concat file
    fs.unlinkSync(concatPath);
    
    return true;
    
  } catch (e) {
    throw new Error(`Loop failed: ${e.message}`);
  }
}

/**
 * Add zen background music
 */
function addZenAudio(videoPath, outputPath, audioSource = null) {
  console.log('\n🎵 Adding zen background music...');
  
  // Get audio file
  let audioPath = audioSource;
  
  if (!audioPath) {
    // Use default zen audio (need to have local file)
    const localAudio = path.join(__dirname, '..', 'assets', 'zen-ambient.mp3');
    
    if (!fs.existsSync(localAudio)) {
      console.log('   No local zen audio found, downloading ambient track...');
      
      // Create assets dir
      const assetsDir = path.join(__dirname, '..', 'assets');
      fs.mkdirSync(assetsDir, { recursive: true });
      
      // Download first source
      try {
        execSync(`curl -sL "${ZEN_AUDIO_SOURCES[0].url}" -o ${localAudio}`, {
          stdio: 'pipe',
          timeout: 60000
        });
        audioPath = localAudio;
        console.log(`  ✓ Downloaded: ${ZEN_AUDIO_SOURCES[0].name}`);
      } catch (e) {
        console.log(`   ⚠️  Could not download audio, proceeding without`);
        return videoPath; // Return video without audio
      }
    } else {
      audioPath = localAudio;
    }
  }
  
  if (!audioPath || !fs.existsSync(audioPath)) {
    console.log('   ⚠️  No audio available, skipping');
    return videoPath;
  }
  
  // Loop audio to match 8 hours, mix with video
  console.log('   Looping audio and mixing...');
  
  try {
    // Stream copy video, loop audio, lower volume
    execSync(
      `ffmpeg -y -i "${videoPath}" -stream_loop -1 -i "${audioPath}" -shortest ` +
      `-filter_complex "[1:a]volume=0.3[audio];[0:a][audio]amix=inputs=2:duration=first[aout]" ` +
      `-map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k "${outputPath}"`,
      { stdio: 'pipe', timeout: 300000 }
    );
    
    console.log(`  ✓ Added zen audio: ${outputPath}`);
    return outputPath;
    
  } catch (e) {
    console.log(`   ⚠️  Audio mixing failed, using video without audio`);
    return videoPath;
  }
}

/**
 * Validate 8-hour video
 */
function validate8Hour(outputPath) {
  console.log('\n🔍 Validating 8-hour video...');
  
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
  const sizeGB = (stats.size / (1024 * 1024 * 1024)).toFixed(2);
  
  console.log(`   Duration: ${parseFloat(duration).toFixed(0)}s`);
  console.log(`          = ${(parseFloat(duration) / 3600).toFixed(2)} hours`);
  console.log(`   Resolution: ${resolution}`);
  console.log(`   Size: ${sizeGB} GB`);
  
  // Validate: ~8 hours = 28800 seconds
  const dur = parseFloat(duration);
  const hours = dur / 3600;
  
  if (hours < 7.8 || hours > 8.2) {
    console.log(`   ⚠️  Duration outside expected range (7.8-8.2 hours)`);
  } else {
    console.log(`   ✅ Duration within expected range`);
  }
  
  return { duration: dur, hours, resolution, sizeGB };
}

/**
 * Upload to MinIO
 */
function uploadFinal(theme, finalPath) {
  console.log('\n☁️ Uploading final video to MinIO...');
  
  const dest = `${MINIO_REMOTE}/screensavers/${theme}/final/${theme}_8hour.mp4`;
  
  try {
    execSync(`mc cp "${finalPath}" ${dest}`, { stdio: 'pipe' });
    console.log(`  ✓ Uploaded: ${dest}`);
    return dest;
  } catch (e) {
    throw new Error(`Upload failed: ${e.message}`);
  }
}

/**
 * Copy to network storage
 */
function copyToNetwork(theme, finalPath) {
  console.log('\n📁 Copying to network storage...');
  
  const networkPath = `/mnt/openclaw/workspace/screensavers/${theme}/`;
  
  try {
    execSync(`mkdir -p "${networkPath}"`, { stdio: 'pipe' });
    execSync(`cp "${finalPath}" "${networkPath}${theme}_8hour.mp4"`, { stdio: 'pipe' });
    console.log(`  ✓ Copied to: ${networkPath}`);
    return networkPath;
  } catch (e) {
    console.log(`   ⚠️  Network copy failed: ${e.message}`);
    return null;
  }
}

/**
 * Main 8-hour compiler
 */
async function compile8Hour(options) {
  const { theme, audio = null, upload = true, network = true, cleanup = true } = options;
  
  console.log(`\n🎬 Step 5: 8-Hour Compilation`);
  console.log(`   Theme: ${theme}`);
  
  // Step 1: Download cycle
  const { tempDir, cyclePath } = downloadCycle(theme);
  
  let videoWithAudio = null;
  
  try {
    // Step 2: Loop to 8 hours
    const eightHourPath = `${tempDir}/${theme}_8hour_noaudio.mp4`;
    loopTo8Hours(cyclePath, eightHourPath, 24);
    
    // Step 3: Add zen audio (optional)
    const finalPath = audio 
      ? `${tempDir}/${theme}_8hour_zen.mp4`
      : `${tempDir}/${theme}_8hour.mp4`;
    
    videoWithAudio = addZenAudio(eightHourPath, finalPath, audio);
    
    // Step 4: Validate
    const validation = validate8Hour(videoWithAudio);
    
    // Step 5: Upload
    let minioPath = null;
    let networkPath = null;
    
    if (upload) {
      minioPath = uploadFinal(theme, videoWithAudio);
    }
    
    if (network) {
      networkPath = copyToNetwork(theme, videoWithAudio);
    }
    
    console.log('\n✅ 8-hour compilation complete!');
    
    return {
      success: true,
      localPath: videoWithAudio,
      minioPath,
      networkPath,
      validation,
      tempDir
    };
    
  } catch (e) {
    console.error(`\n❌ Error: ${e.message}`);
    throw e;
    
  } finally {
    if (cleanup && fs.existsSync(tempDir)) {
      console.log('\n🧹 Cleaning up...');
      execSync(`rm -rf ${tempDir}`);
    }
  }
}

// CLI
if (require.main === module) {
  const args = require('minimist')(process.argv.slice(2));
  
  if (args.help || args.h) {
    console.log('Step 5: 8-Hour Compilation');
    console.log('');
    console.log('Usage:');
    console.log('  node tools/screensaver-compile-8hour.js --theme cherry-blossom');
    console.log('  node tools/screensaver-compile-8hour.js --theme cherry-blossom --audio rain.mp3');
    console.log('');
    console.log('Options:');
    console.log('  --theme <name>    Theme name (required)');
    console.log('  --audio <path>   Optional zen audio file');
    console.log('  --no-upload       Skip MinIO upload');
    console.log('  --no-network      Skip network storage copy');
    console.log('  --no-cleanup      Keep temp files');
    console.log('  --help, -h        Show this help');
    console.log('');
    console.log('Zen Audio Sources (CC0):');
    ZEN_AUDIO_SOURCES.forEach(s => {
      console.log(`  - ${s.name} (${s.duration})`);
    });
    process.exit(0);
  }
  
  if (!args.theme) {
    console.error('❌ --theme required');
    process.exit(1);
  }
  
  compile8Hour({
    theme: args.theme,
    audio: args.audio,
    upload: !args['no-upload'],
    network: !args['no-network'],
    cleanup: !args['no-cleanup']
  }).then(result => {
    console.log('\n🎉 Success!');
    console.log(`   Duration: ${result.validation.hours.toFixed(2)} hours`);
    console.log(`   Size: ${result.validation.sizeGB} GB`);
    if (result.minioPath) console.log(`   MinIO: ${result.minioPath}`);
    if (result.networkPath) console.log(`   Network: ${result.networkPath}`);
    process.exit(0);
  }).catch(e => {
    console.error(`\n❌ Failed: ${e.message}`);
    process.exit(1);
  });
}

module.exports = { compile8Hour, loopTo8Hours, addZenAudio };
