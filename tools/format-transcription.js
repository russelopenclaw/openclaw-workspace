#!/usr/bin/env node
/**
 * Transcription Formatter - Converts raw Whisper output to readable formats
 * 
 * Automatically detects content type and formats accordingly:
 * - Interview/Podcast: Dialogue with speaker labels
 * - Meeting: Multi-speaker with turn markers
 * - Monologue/Lecture: Clean paragraphs with timestamps
 * 
 * Usage:
 *   node format-transcription.js <input.txt> [--format auto|script|summary|markdown|readable]
 *   [--type interview|meeting|monologue] [--output file.md]
 */

const fs = require('fs');
const path = require('path');

// ====== Speaker Detection ======

function detectSpeakers(segments) {
  if (!segments || segments.length === 0) return segments;

  const SPEAKER_CHANGE_PAUSE = 1.5;
  const ACKNOWLEDGMENT_PATTERNS = /^(yeah|yes|right|exactly|sure|okay|mm-hmm|uh-huh|correct|wow|got it|interesting|cool|gotcha|absolutely|agreed|true|for sure|no doubt|100%|totally|hundred percent)/i;
  
  const labeled = [];
  let currentSpeaker = 'A';
  let lastEnd = 0;
  let lastSpeaker = 'A';

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const gap = seg.start - lastEnd;
    const text = seg.text.trim();
    
    let speakerChange = false;

    if (i > 0 && gap >= SPEAKER_CHANGE_PAUSE) {
      speakerChange = true;
    }
    
    if (i > 0 && ACKNOWLEDGMENT_PATTERNS.test(text) && text.length < 80) {
      if (!speakerChange) speakerChange = true;
    }

    if (speakerChange) {
      currentSpeaker = lastSpeaker === 'A' ? 'B' : 'A';
    }

    labeled.push({ ...seg, speaker: currentSpeaker });
    lastEnd = seg.end;
    lastSpeaker = currentSpeaker;
  }

  return labeled;
}

function countSpeakers(segments) {
  return [...new Set(segments.map(s => s.speaker))].length;
}

// ====== Format Detection ======

function detectContentType(segments) {
  if (!segments || segments.length === 0) return 'monologue';
  
  const numSpeakers = countSpeakers(segments);
  if (numSpeakers <= 1) return 'monologue';
  
  // Check for interview pattern: alternating long/short turns
  const speakerLengths = {};
  for (const seg of segments) {
    if (!speakerLengths[seg.speaker]) speakerLengths[seg.speaker] = [];
    speakerLengths[seg.speaker].push(seg.text.length);
  }
  
  const speakerAvgLens = {};
  for (const [sp, lens] of Object.entries(speakerLengths)) {
    speakerAvgLens[sp] = lens.reduce((a, b) => a + b, 0) / lens.length;
  }
  
  const avgLens = Object.values(speakerAvgLens);
  if (avgLens.length >= 2) {
    const ratio = Math.max(...avgLens) / Math.min(...avgLens);
    if (ratio > 1.5) return 'interview'; // One speaker gives longer answers
  }
  
  if (numSpeakers <= 3) return 'interview';
  return 'meeting';
}

// ====== Formatters ======

function formatReadable(segments, title, contentType) {
  const lines = [];
  lines.push(`# ${title}`);
  lines.push('');
  
  if (contentType === 'interview') {
    lines.push('_Formatted as dialogue. Speaker labels estimated from pause patterns and context._');
  } else if (contentType === 'meeting') {
    lines.push(`_Meeting transcription with ${countSpeakers(segments)} speakers. Labels estimated from pause patterns._`);
  } else {
    lines.push('_Single-speaker transcription._');
  }
  lines.push('');

  // Merge consecutive segments from same speaker
  const merged = mergeConsecutive(segments);
  
  // Format based on content type
  if (contentType === 'interview') {
    return formatInterview(merged, lines);
  } else if (contentType === 'meeting') {
    return formatMeeting(merged, lines);
  } else {
    return formatMonologue(merged, lines);
  }
}

function mergeConsecutive(segments) {
  const result = [];
  for (const seg of segments) {
    if (result.length > 0 && result[result.length - 1].speaker === seg.speaker) {
      result[result.length - 1].text += ' ' + seg.text;
      result[result.length - 1].end = seg.end;
    } else {
      result.push({ ...seg });
    }
  }
  return result;
}

function formatInterview(segments, lines) {
  // Determine who's who based on speaking patterns
  const speakers = [...new Set(segments.map(s => s.speaker))];
  const labels = {};
  
  if (speakers.length === 2) {
    const a = speakers[0], b = speakers[1];
    const aSegs = segments.filter(s => s.speaker === a);
    const bSegs = segments.filter(s => s.speaker === b);
    const aQuestions = aSegs.filter(s => s.text.trim().endsWith('?')).length / aSegs.length;
    const bQuestions = bSegs.filter(s => s.text.trim().endsWith('?')).length / bSegs.length;
    const aAvgLen = aSegs.reduce((sum, s) => sum + s.text.length, 0) / aSegs.length;
    const bAvgLen = bSegs.reduce((sum, s) => sum + s.text.length, 0) / bSegs.length;
    
    // Host asks more questions, has shorter turns; Guest gives longer answers
    const hostIsA = aQuestions > bQuestions || bAvgLen > aAvgLen;
    labels[a] = hostIsA ? 'Host' : 'Guest';
    labels[b] = hostIsA ? 'Guest' : 'Host';
  } else {
    speakers.forEach((s, i) => { labels[s] = `Speaker ${i + 1}`; });
  }

  for (const seg of segments) {
    const speaker = labels[seg.speaker] || seg.speaker;
    const startMin = Math.floor(seg.start / 60);
    const startSec = Math.floor(seg.start % 60);
    const time = `${startMin}:${String(startSec).padStart(2, '0')}`;
    lines.push(`**${speaker}:** ${seg.text.trim()}`);
    lines.push('');
  }

  return lines.join('\n');
}

function formatMeeting(segments, lines) {
  const speakers = [...new Set(segments.map(s => s.speaker))];
  const speakerLabels = {};
  speakers.forEach((s, i) => { speakerLabels[s] = `Speaker ${i + 1}`; });

  for (const seg of segments) {
    const startMin = Math.floor(seg.start / 60);
    const startSec = Math.floor(seg.start % 60);
    const time = `${startMin}:${String(startSec).padStart(2, '0')}`;
    lines.push(`**[${time}] ${speakerLabels[seg.speaker]}:** ${seg.text.trim()}`);
    lines.push('');
  }

  return lines.join('\n');
}

function formatMonologue(segments, lines) {
  // Group segments into paragraphs by topic breaks (longer pauses)
  const PARAGRAPH_BREAK = 3.0; // seconds
  let currentParagraph = [];
  
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const gap = i > 0 ? seg.start - segments[i-1].end : 0;
    
    if (gap > PARAGRAPH_BREAK && currentParagraph.length > 0) {
      const startMin = Math.floor(currentParagraph[0].start / 60);
      const startSec = Math.floor(currentParagraph[0].start % 60);
      const time = `${startMin}:${String(startSec).padStart(2, '0')}`;
      const text = currentParagraph.map(s => s.text.trim()).join(' ');
      lines.push(`**[${time}]** ${text}`);
      lines.push('');
      currentParagraph = [];
    }
    currentParagraph.push(seg);
  }
  
  // Flush remaining
  if (currentParagraph.length > 0) {
    const startMin = Math.floor(currentParagraph[0].start / 60);
    const startSec = Math.floor(currentParagraph[0].start % 60);
    const time = `${startMin}:${String(startSec).padStart(2, '0')}`;
    const text = currentParagraph.map(s => s.text.trim()).join(' ');
    lines.push(`**[${time}]** ${text}`);
    lines.push('');
  }

  return lines.join('\n');
}

function formatSummary(segments, title, contentType) {
  const lines = [];
  lines.push(`# ${title} — Summary`);
  lines.push('');

  const speakers = [...new Set(segments.map(s => s.speaker))];
  let totalDuration = Math.max(...segments.map(s => s.end));
  
  lines.push(`**Duration:** ${Math.floor(totalDuration / 60)}:${String(Math.floor(totalDuration % 60)).padStart(2, '0')}`);
  lines.push(`**Speakers:** ${speakers.length}`);
  lines.push(`**Type:** ${contentType}`);
  lines.push('');

  // Per-speaker stats
  for (const sp of speakers) {
    const spSegs = segments.filter(s => s.speaker === sp);
    const spTime = spSegs.reduce((sum, s) => sum + (s.end - s.start), 0);
    const pct = Math.round(spTime / totalDuration * 100);
    lines.push(`### ${sp} (${pct}% of conversation, ${spSegs.length} turns)`);
    lines.push(spSegs.map(s => s.text.trim()).join(' '));
    lines.push('');
  }

  return lines.join('\n');
}

function formatMarkdown(segments, title) {
  const lines = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push('| Time | Speaker | Text |');
  lines.push('|------|---------|------|');

  for (const seg of segments) {
    const startMin = Math.floor(seg.start / 60);
    const startSec = Math.floor(seg.start % 60);
    const time = `${startMin}:${String(startSec).padStart(2, '0')}`;
    const text = seg.text.trim().replace(/\|/g, '\\|');
    lines.push(`| ${time} | ${seg.speaker} | ${text} |`);
  }

  return lines.join('\n');
}

// ====== Main ======

function main() {
  const args = process.argv.slice(2);
  let inputFile = null;
  let format = 'readable';
  let contentType = 'auto';
  let outputFile = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--format' && args[i + 1]) {
      format = args[++i];
    } else if (args[i] === '--type' && args[i + 1]) {
      contentType = args[++i];
    } else if (args[i] === '--output' && args[i + 1]) {
      outputFile = args[++i];
    } else if (!args[i].startsWith('--')) {
      inputFile = args[i];
    }
  }

  if (!inputFile) {
    console.error('Usage: node format-transcription.js <input.txt> [--format auto|readable|script|summary|markdown] [--type interview|meeting|monologue] [--output file.md]');
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`Error: File not found: ${inputFile}`);
    process.exit(1);
  }

  const content = fs.readFileSync(inputFile, 'utf-8');
  const lines = content.split('\n');
  
  // Parse header
  let title = path.basename(inputFile, '.txt').replace(/_/g, ' ').replace(/^\d{4}-\d{2}-\d{2}\s*/, '');
  let duration = 0;

  for (const line of lines) {
    if (line.startsWith('Transcription:')) title = line.replace('Transcription:', '').trim();
    if (line.startsWith('Duration:')) {
      const match = line.match(/(\d+)s/);
      if (match) duration = parseInt(match[1]);
    }
  }

  // Parse timestamped segments
  const segments = [];
  const timeRegex = /^\[(\d+):(\d+)\]\s+(.*)$/;
  
  for (const line of lines) {
    const match = line.match(timeRegex);
    if (match) {
      const startSec = parseInt(match[1]) * 60 + parseInt(match[2]);
      segments.push({
        start: startSec,
        end: startSec + 5,
        text: match[3].trim()
      });
    }
  }

  if (segments.length === 0) {
    console.error('Error: No timestamped segments found in transcription file.');
    process.exit(1);
  }

  // Detect speakers and content type
  const labeled = detectSpeakers(segments);
  const detectedType = contentType === 'auto' ? detectContentType(labeled) : contentType;
  
  // Format output
  let output;
  switch (format) {
    case 'summary':
      output = formatSummary(labeled, title, detectedType);
      break;
    case 'markdown':
    case 'md':
      output = formatMarkdown(labeled, title);
      break;
    case 'readable':
    case 'script':
    default:
      output = formatReadable(labeled, title, detectedType);
      break;
  }

  // Write or print
  if (outputFile) {
    fs.writeFileSync(outputFile, output, 'utf-8');
    console.error(`Written to: ${outputFile}`);
  } else {
    console.log(output);
  }

  // Print stats to stderr
  const speakers = [...new Set(labeled.map(s => s.speaker))];
  console.error(`\nContent type: ${detectedType}`);
  console.error(`Speakers detected: ${speakers.join(', ')}`);
  for (const sp of speakers) {
    const count = labeled.filter(s => s.speaker === sp).length;
    console.error(`  ${sp}: ${count} segments`);
  }
}

main();