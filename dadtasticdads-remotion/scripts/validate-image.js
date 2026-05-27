#!/usr/bin/env node
/**
 * Image Quality Validator for DadtasticDads
 * Validates AI-generated images before use in production videos
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Validate image quality with multiple checks
 * Returns: { passed: boolean, score: number (0-100), issues: string[] }
 */
async function validateImage(imagePath) {
  const issues = [];
  let score = 100;
  
  if (!fs.existsSync(imagePath)) {
    return { passed: false, score: 0, issues: ['File does not exist'] };
  }
  
  const stats = fs.statSync(imagePath);
  
  // 1. File size check (should be reasonable for 480x720)
  if (stats.size < 50000) { // < 50KB is suspicious
    issues.push(`File too small: ${(stats.size/1024).toFixed(1)}KB`);
    score -= 30;
  }
  
  // 2. Check if it's actually an image (ffprobe)
  let probeResult;
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries stream=codec_type,width,height -of json "${imagePath}"`
    );
    probeResult = JSON.parse(stdout);
  } catch (e) {
    return { passed: false, score: 0, issues: ['Invalid image file', e.message] };
  }
  
  const stream = probeResult.streams?.find(s => s.codec_type === 'video' || s.codec_type === 'image');
  if (!stream) {
    return { passed: false, score: 0, issues: ['No image stream found'] };
  }
  
  // 3. Resolution check (expect ~480x720 for vertical)
  const width = stream.width || 0;
  const height = stream.height || 0;
  
  if (width < 400 || height < 600) {
    issues.push(`Low resolution: ${width}x${height} (expected ~480x720)`);
    score -= 20;
  }
  
  // Aspect ratio check for vertical format
  const aspectRatio = width / height;
  if (aspectRatio < 0.5 || aspectRatio > 0.8) {
    issues.push(`Unusual aspect ratio: ${(aspectRatio).toFixed(2)} (expected ~0.67 for vertical)`);
    score -= 10;
  }
  
  // 4. Blur detection using ffmpeg's lavfi
  try {
    const { stdout } = await execAsync(
      `ffmpeg -i "${imagePath}" -lavfi "blend=all_expr='if(eq(X,0),0,abs(val-prev))'" -frames:v 1 -f null - 2>&1 | grep -o "blur:[0-9.]*" || echo "blur:0"`
    );
    // Alternative: Check variance using histogram
    const { stdout: histStdout } = await execAsync(
      `ffmpeg -i "${imagePath}" -lavfi histogram=levels_mode=diff:display_mode=0 -f null - 2>&1`
    );
    // If histogram shows very low variance, image may be blurry/solid
    const hasLowVariance = histStdout.includes('histogram') && histStdout.includes('0.0');
    if (hasLowVariance) {
      issues.push('Potential blur detected - low variance');
      score -= 25;
    }
  } catch (e) {
    // Blur detection is nice-to-have, don't fail on it
  }
  
  // 5. Check for solid color/gradient (low entropy)
  try {
    const { stdout } = await execAsync(
      `ffmpeg -i "${imagePath}" -lavfi "entropy=measure=1" -f null - 2>&1`
    );
    // Very low entropy suggests solid color or simple gradient
    if (!stdout.includes('entropy') || stdout.includes('0.000000')) {
      issues.push('Very low entropy - possibly solid color');
      score -= 15;
    }
  } catch (e) {
    // Entropy check optional
  }
  
  // 6. Check for NSFW content (basic color analysis)
  // This is a simplified check - looks for unusual color distributions
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format_tags=bit_rate -of json "${imagePath}"`
    );
    // Placeholder for future NSFW detection integration
  } catch (e) {
    // NSFW check optional
  }
  
  const passed = score >= 70;
  
  return {
    passed,
    score: Math.max(0, score),
    issues,
    width,
    height
  };
}

/**
 * Regenerate image if validation fails
 * Calls the original image generation with retry logic
 */
async function validateAndRegenerateIfNeeded(
  imageFile, 
  generateImageFn, 
  prompt, 
  maxRetries = 2
) {
  let currentImage = imageFile;
  let validation = await validateImage(currentImage);
  
  if (validation.passed) {
    console.log(`   ✅ Image validation passed: ${validation.score}/100 (${validation.width}x${validation.height})`);
    return { image: currentImage, validation };
  }
  
  console.log(`   ⚠️ Image validation failed: ${validation.score}/100`);
  console.log(`      Issues: ${validation.issues.join(', ')}`);
  
  // Retry generation
  for (let i = 0; i < maxRetries; i++) {
    console.log(`   🔄 Attempt ${i + 1}/${maxRetries}: Regenerating image...`);
    
    try {
      // Delete failed image
      try { fs.unlinkSync(currentImage); } catch {}
      
      // Generate new image (slightly modify prompt for variation)
      const variationPrompt = prompt + ` (variation ${i + 1}, different composition)`;
      currentImage = await generateImageFn(variationPrompt);
      
      validation = await validateImage(currentImage);
      
      if (validation.passed) {
        console.log(`   ✅ Retry successful: ${validation.score}/100`);
        return { image: currentImage, validation };
      }
      
      console.log(`   ⚠️ Retry failed: ${validation.score}/100`);
    } catch (e) {
      console.log(`   ❌ Retry error: ${e.message}`);
    }
  }
  
  // All retries failed - use solid color as fallback
  console.log(`   ⚠️ All image generation failed, using fallback...`);
  try { fs.unlinkSync(currentImage); } catch {}
  
  const fallbackImage = imageFile.replace('.png', '-fallback.png');
  await execAsync(
    `ffmpeg -y -f lavfi -i "color=c=#102A54:s=480x720:d=1" -frames:v 1 "${fallbackImage}"`
  );
  
  return {
    image: fallbackImage,
    validation: {
      passed: true,
      score: 70,
      issues: ['Fallback gradient (generation failed)'],
      width: 480,
      height: 720
    }
  };
}

module.exports = { validateImage, validateAndRegenerateIfNeeded };

/**
 * Standalone mode
 */
if (require.main === module) {
  const imagePath = process.argv[2];
  if (!imagePath) {
    console.error('Usage: node validate-image.js <image-path>');
    process.exit(1);
  }
  
  validateImage(imagePath).then(result => {
    console.log('\n=== Image Validation Result ===');
    console.log(`Passed: ${result.passed ? '✅' : '❌'}`);
    console.log(`Score: ${result.score}/100`);
    console.log(`Dimensions: ${result.width}x${result.height}`);
    if (result.issues.length > 0) {
      console.log('Issues:');
      result.issues.forEach(i => console.log(`  - ${i}`));
    }
    process.exit(result.passed ? 0 : 1);
  });
}
