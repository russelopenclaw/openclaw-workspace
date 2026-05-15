#!/usr/bin/env node
/**
 * Whisper transcription wrapper for Alfred
 * Routes audio files to local Whisper API (port 8777) or falls back to OpenAI API
 * 
 * Usage: node whisper-transcribe.js <audio_file> [--model base] [--language en]
 * 
 * Returns transcript text to stdout (JSON to stderr with metadata)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LOCAL_API = 'http://localhost:8777';
const WHISPER_ENV = '/home/kevin/.openclaw/workspace/whisper-env/bin/python3';
const CLI_SCRIPT = '/home/kevin/.openclaw/workspace/tools/whisper-transcribe.py';

async function transcribeLocalAPI(audioPath) {
  const http = require('http');
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
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.error) reject(new Error(result.error));
          else resolve(result);
        } catch (e) {
          reject(new Error(`Parse error: ${body.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(audioData);
    req.end();
  });
}

async function transcribeLocalCLI(audioPath, model = 'base', language = null) {
  const args = [CLI_SCRIPT, audioPath, '--model', model];
  if (language) args.push('--language', language);
  
  const result = execSync(`${WHISPER_ENV} ${args.map(a => `'${a}'`).join(' ')}`, {
    encoding: 'utf-8',
    timeout: 600000 // 10 minute timeout
  });
  
  return result.trim();
}

async function checkLocalAPI() {
  const http = require('http');
  return new Promise((resolve) => {
    const req = http.get(`${LOCAL_API}/health`, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(2000, () => { req.destroy(); resolve(null); });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const audioPath = args.find(a => !a.startsWith('--'));
  const modelIdx = args.indexOf('--model');
  const langIdx = args.indexOf('--language');
  const model = modelIdx >= 0 ? args[modelIdx + 1] : 'base';
  const language = langIdx >= 0 ? args[langIdx + 1] : null;
  
  if (!audioPath) {
    console.error('Usage: node whisper-transcribe.js <audio_file> [--model base|tiny|small|medium|large-v3] [--language en]');
    process.exit(1);
  }
  
  if (!fs.existsSync(audioPath)) {
    console.error(`Error: File not found: ${audioPath}`);
    process.exit(1);
  }
  
  // Try local API first
  const health = await checkLocalAPI();
  if (health && health.status === 'ok') {
    try {
      const result = await transcribeLocalAPI(audioPath);
      console.log(result.text);
      console.error(JSON.stringify(result, null, 2));
      process.exit(0);
    } catch (err) {
      console.error(`Local API failed: ${err.message}, falling back to CLI...`);
    }
  } else {
    console.error('Local API not available, using CLI...');
  }
  
  // Fall back to CLI
  try {
    const text = await transcribeLocalCLI(audioPath, model, language);
    console.log(text);
    process.exit(0);
  } catch (err) {
    console.error(`CLI failed: ${err.message}`);
    process.exit(1);
  }
}

main();