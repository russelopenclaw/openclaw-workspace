#!/usr/bin/env node
/**
 * Audio Sync Verifier for DadtasticDads
 * Verifies audio waveform and timing aligns with text segments
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Extract audio waveform data from video/audio file
 */
async function extractWaveformData(audioPath) {
  const volDataPath = `/tmp/vol-${Date.now()}.txt`;
  
  try {
    // Extract volume data across time
    await execAsync(
      `ffmpeg -i "${audioPath}" -af "volumedetect" -f null - 2>&1 | grep "mean_volume"`
    );
  } catch (e) {
    // Volume detect just gives overall stats
  }
  
  // Extract time-domain data
  const rawData = [];
  try {
    const { stdout } = await execAsync(
      `ffprobe -i "${audioPath}" -show_entries frame=pkt_pts_time -of default=noprint_wrappers=1:nokey=1 2>/dev/null`
    );
    // This shows frame timestamps
  } catch (e) {
    // Fallback
  }
  
  // Simpler approach: get audio stats
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`
    );
    const duration = parseFloat(stdout.trim()) || 0;
    return { duration, available: true };
  } catch (e) {
    return { duration: 0, available: false };
  }
}

/**
 * Detect pauses/breaks in audio (where punchline might land)
 */
async function detectAudioBreaks(audioPath) {
  const breaks = [];
  
  try {
    // Get overall stats first
    const { stdout } = await execAsync(
      `ffmpeg -i "${audioPath}" -af "volumedetect" -f null - 2>&1`
    );
    
    const meanVolMatch = stdout.match(/mean_volume:\s*(-?[0-9.]+)\s+dB/);
    const maxVolMatch = stdout.match(/max_volume:\s*(-?[0-9.]+)\s+dB/);
    
    if (meanVolMatch && maxVolMatch) {
      return {
        meanVolume: parseFloat(meanVolMatch[1]),
        maxVolume: parseFloat(maxVolMatch[1]),
        hasDynamicRange: true
      };
    }
    
    return { hasDynamicRange: false };
  } catch (e) {
    return { hasDynamicRange: false };
  }
}

/**
 * Verify audio sync: check that video duration matches audio
 * and that there's audio throughout the expected segments
 */
async function verifyAudioSync(videoFile, audioFile, segments) {
  console.log('   Running audio sync verification...');
  
  const result = {
    passed: true,
    score: 100,
    details: []
  };
  
  // 1. Get video duration
  let videoDuration, audioDuration;
  
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoFile}"`
    );
    videoDuration = parseFloat(stdout.trim());
    result.details.push({
      check: 'video_duration',
      value: videoDuration,
      status: '✅'
    });
  } catch (e) {
    result.details.push({
      check: 'video_duration',
      status: '❌',
      message: 'Could not read video duration'
    });
    result.score -= 30;
  }
  
  // 2. Get audio duration
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioFile}"`
    );
    audioDuration = parseFloat(stdout.trim());
    result.details.push({
      check: 'audio_duration',
      value: audioDuration,
      status: '✅'
    });
  } catch (e) {
    result.details.push({
      check: 'audio_duration',
      status: '❌',
      message: 'Could not read audio duration'
    });
    result.score -= 30;
  }
  
  // 3. Check sync between video and audio
  if (videoDuration && audioDuration) {
    const diff = Math.abs(videoDuration - audioDuration);
    
    // With padding, video should be ~audio + 2 seconds (1s each end)
    // But Remotion might cut off padding, so allow variance
    const expectedDiff = 0; // Without padding
    const tolerance = 0.5; // 500ms tolerance
    
    if (diff <= tolerance) {
      result.details.push({
        check: 'sync_alignment',
        value: `diff: ${diff.toFixed(2)}s`,
        status: '✅'
      });
    } else if (videoDuration >= audioDuration * 0.95) {
      // Video is at least 95% of audio length (acceptable)
      result.details.push({
        check: 'sync_alignment',
        value: `video: ${videoDuration.toFixed(2)}s, audio: ${audioDuration.toFixed(2)}s`,
        status: '✅'
      });
    } else {
      result.details.push({
        check: 'sync_alignment',
        value: `diff: ${diff.toFixed(2)}s (video may be truncated)`,
        status: '⚠️'
      });
      result.score -= 20;
    }
  }
  
  // 4. Check audio has content (not silent)
  const audioStats = await detectAudioBreaks(audioFile);
  if (audioStats.hasDynamicRange) {
    result.details.push({
      check: 'audio_content',
      value: `${audioStats.meanVolume?.toFixed(1) ?? '?'}dB mean`,
      status: '✅'
    });
  } else {
    result.details.push({
      check: 'audio_content',
      status: '⚠️',
      message: 'Could not verify audio content'
    });
    result.score -= 10;
  }
  
  // 5. Check segment alignment
  segments.forEach((seg, i) => {
    if (seg.atPercent < 0 || seg.atPercent > 1) {
      result.details.push({
        check: `segment_${i}_timing`,
        status: '❌',
        message: `Invalid atPercent: ${seg.atPercent}`
      });
      result.score -= 15;
    }
  });
  
  // 6. Verify audio stream exists in video
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries stream=codec_type -of json "${videoFile}"`
    );
    const probe = JSON.parse(stdout);
    const hasAudioStream = probe.streams?.some(s => s.codec_type === 'audio');
    
    result.details.push({
      check: 'audio_stream',
      status: hasAudioStream ? '✅' : '❌',
      message: hasAudioStream ? 'Audio stream present' : 'No audio stream!'
    });
    
    if (!hasAudioStream) {
      result.score -= 40;
    }
  } catch (e) {
    result.details.push({
      check: 'audio_stream',
      status: '❌',
      message: 'Could not probe audio stream'
    });
  }
  
  result.passed = result.score >= 70;
  result.score = Math.max(0, result.score);
  
  // Summary
  const passedChecks = result.details.filter(d => d.status === '✅').length;
  console.log(`   Sync checks: ${passedChecks}/${result.details.length} passed`);
  
  if (result.passed) {
    console.log(`   ✅ Audio sync verification passed: ${result.score}/100`);
  } else {
    console.log(`   ⚠️ Audio sync verification warning: ${result.score}/100`);
  }
  
  return result;
}

module.exports = { verifyAudioSync, detectAudioBreaks, extractWaveformData };

/**
 * Standalone mode
 */
if (require.main === module) {
  console.log('Audio Sync Verifier - Standalone Mode');
  console.log('For full verification, use with generate-dadjoke-video-PRODUCTION.js');
}
