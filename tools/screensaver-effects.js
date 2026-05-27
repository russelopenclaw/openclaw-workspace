#!/usr/bin/env node
/**
 * Screensaver Video Effects Generator
 * 
 * Creates relaxing Ken Burns-style videos from still images using ffmpeg.
 * Supports: zoom_in, zoom_out, pan_left, pan_right, custom effects
 * 
 * Usage:
 *   node tools/screensaver-effects.js --input image.png --effect zoom_in --output video.mp4
 *   node tools/screensaver-effects.js --input image.png --effect pan_right --duration 30 --output video.mp4
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Generate video with Ken Burns effect
 * @param {string} input - Input image path
 * @param {string} output - Output video path
 * @param {string} effect - Effect type: zoom_in, zoom_out, pan_left, pan_right, none
 * @param {number} duration - Duration in seconds (default: 24)
 * @param {string} audio - Optional audio track path
 * @param {number} audioVolume - Audio volume 0.0-1.0 (default: 0.5)
 * @param {boolean} verbose - Show ffmpeg output
 */
function generateVideo({ input, output, effect = 'zoom_in', duration = 24, audio = null, audioVolume = 0.5, verbose = false }) {
  if (!fs.existsSync(input)) {
    throw new Error(`Input image not found: ${input}`);
  }

  // Ensure output directory exists
  const outputDir = path.dirname(output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Build ffmpeg filter based on effect
  let filter = '';
  const fps = 30;
  const totalFrames = duration * fps;

  switch (effect) {
    case 'zoom_in':
      // Slow zoom in (1.0 → 1.15 over duration)
      filter = `zoompan=z='min(zoom+0.0015,1.15)':d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080`;
      break;

    case 'zoom_out':
      // Slow zoom out (1.15 → 1.0 over duration)
      filter = `zoompan=z='max(zoom-0.0015,1.0)':d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080`;
      break;

    case 'pan_left':
      // Slow pan from right to left (crop 90%, move across)
      filter = `crop=iw*0.9:ih*0.9:x='if(gte(t,0),iw*0.1*(t/${duration}),0)':y=ih*0.05,scale=1920:1080`;
      break;

    case 'pan_right':
      // Slow pan from left to right
      filter = `crop=iw*0.9:ih*0.9:x='if(gte(t,0),iw*0.1*(1-t/${duration}),0)':y=ih*0.05,scale=1920:1080`;
      break;

    case 'pan_up':
      // Slow pan from bottom to top
      filter = `crop=iw*0.9:ih*0.9:x=iw*0.05:y='if(gte(t,0),ih*0.1*(1-t/${duration}),0)',scale=1920:1080`;
      break;

    case 'pan_down':
      // Slow pan from top to bottom
      filter = `crop=iw*0.9:ih*0.9:x=iw*0.05:y='if(gte(t,0),ih*0.1*(t/${duration}),0)',scale=1920:1080`;
      break;

    case 'zoom_in_pan_right':
      // Combined effect: zoom in while panning right
      filter = `zoompan=z='min(zoom+0.001,1.1)':d=${totalFrames}:x='iw/2-(iw/zoom/2)+iw*0.05*(t/${duration})':y='ih/2-(ih/zoom/2)':s=1920x1080`;
      break;

    case 'none':
      // Static image, no movement
      filter = `scale=1920:1080`;
      break;

    default:
      throw new Error(`Unknown effect: ${effect}. Use: zoom_in, zoom_out, pan_left, pan_right, pan_up, pan_down, zoom_in_pan_right, none`);
  }

  // Add fade in/out for smooth transitions
  const fadeFilter = `fade=t=in:st=0:d=2,fade=t=out:st=${duration - 2}:d=2`;
  const fullFilter = `${filter},${fadeFilter}`;

  // Build ffmpeg command
  let cmd = `ffmpeg -y -loop 1 -i "${input}" -vf "${fullFilter}" -c:v libx264 -preset slow -crf 18 -t ${duration} -pix_fmt yuv420p`;

  // Add audio if provided
  if (audio && fs.existsSync(audio)) {
    cmd += ` -i "${audio}" -c:a aac -b:a 192k -shortest -filter:a "volume=${audioVolume}"`;
  }

  cmd += ` "${output}"`;

  console.log(`🎬 Generating ${effect} video (${duration}s)...`);
  console.log(`   Input: ${path.basename(input)}`);
  console.log(`   Output: ${path.basename(output)}`);
  if (audio) {
    console.log(`   Audio: ${path.basename(audio)} (vol: ${audioVolume})`);
  }

  try {
    const options = { stdio: verbose ? 'inherit' : 'pipe', timeout: 120000 };
    execSync(cmd, options);
    console.log(`✅ Video created: ${output}`);
    return { success: true, output, duration, effect };
  } catch (e) {
    console.error(`❌ Failed to generate video: ${e.message}`);
    if (e.stdout) console.error(e.stdout.toString());
    if (e.stderr) console.error(e.stderr.toString());
    return { success: false, error: e.message };
  }
}

/**
 * Batch generate videos for all 4 directions from one image
 */
function generateAllEffects({ input, outputDir, duration = 24, audio = null, audioVolume = 0.5 }) {
  const baseName = path.basename(input, path.extname(input));
  const results = [];

  const effects = ['zoom_in', 'zoom_out', 'pan_left', 'pan_right'];

  for (const effect of effects) {
    const output = path.join(outputDir, `${baseName}-${effect}.mp4`);
    const result = generateVideo({ input, output, effect, duration, audio, audioVolume });
    results.push({ effect, ...result });
  }

  return results;
}

/**
 * Get recommended effect based on image characteristics
 */
function recommendEffect(imagePath) {
  // Simple heuristics - could be enhanced with AI analysis
  const filename = path.basename(imagePath).toLowerCase();

  if (filename.includes('cherry') || filename.includes('blossom') || filename.includes('tree')) {
    return 'zoom_in'; // Draw viewer into the scene
  }

  if (filename.includes('ocean') || filename.includes('lake') || filename.includes('water')) {
    return 'pan_left'; // Mimic horizon movement
  }

  if (filename.includes('mountain') || filename.includes('forest')) {
    return 'zoom_out'; // Reveal the landscape
  }

  if (filename.includes('path') || filename.includes('garden')) {
    return 'pan_right'; // Follow the path
  }

  // Default: subtle zoom in
  return 'zoom_in';
}

// CLI mode
if (require.main === module) {
  const args = process.argv.slice(2);
  const argMap = {};
  args.forEach((arg, i) => {
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1];
      argMap[key] = value;
    }
  });

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log('Usage: node tools/screensaver-effects.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --input <path>      Input image path (required for generation)');
    console.log('  --output <path>     Output video path (required for generation)');
    console.log('  --effect <type>     Effect: zoom_in, zoom_out, pan_left, pan_right, pan_up, pan_down, none');
    console.log('  --duration <sec>    Duration in seconds (default: 24)');
    console.log('  --audio <path>      Optional audio track');
    console.log('  --volume <0-1>      Audio volume (default: 0.5)');
    console.log('  --all               Generate all 4 effects from one image');
    console.log('  --output-dir <dir>  Output directory for --all mode');
    console.log('  --recommend         Suggest best effect for this image');
    console.log('  --verbose           Show ffmpeg output');
    console.log('  --help, -h          Show this help');
    console.log('');
    console.log('Examples:');
    console.log('  node tools/screensaver-effects.js --input image.png --effect zoom_in --output video.mp4');
    console.log('  node tools/screensaver-effects.js --input image.png --all --output-dir ./videos/');
    console.log('  node tools/screensaver-effects.js --input image.png --recommend');
    process.exit(0);
  }

  if (argMap.recommend) {
    if (!argMap.input) {
      console.error('❌ --input required for --recommend');
      process.exit(1);
    }
    const recommended = recommendEffect(argMap.input);
    console.log(`📊 Recommended effect for ${path.basename(argMap.input)}: ${recommended}`);
    process.exit(0);
  }

  if (argMap.all) {
    if (!argMap.input) {
      console.error('❌ --input required for --all');
      process.exit(1);
    }
    const outputDir = argMap['output-dir'] || path.dirname(argMap.input);
    const results = generateAllEffects({
      input: argMap.input,
      outputDir,
      duration: parseInt(argMap.duration) || 24,
      audio: argMap.audio,
      audioVolume: parseFloat(argMap.volume) || 0.5
    });
    console.log('\n📊 Results:');
    results.forEach(r => {
      console.log(`  ${r.effect}: ${r.success ? '✅' : '❌'} ${r.output || r.error}`);
    });
    process.exit(0);
  }

  if (!argMap.input || !argMap.output) {
    console.error('❌ --input and --output required');
    console.log('Use --help for usage');
    process.exit(1);
  }

  generateVideo({
    input: argMap.input,
    output: argMap.output,
    effect: argMap.effect || 'zoom_in',
    duration: parseInt(argMap.duration) || 24,
    audio: argMap.audio,
    audioVolume: parseFloat(argMap.volume) || 0.5,
    verbose: argMap.verbose
  });
}

module.exports = { generateVideo, generateAllEffects, recommendEffect };
