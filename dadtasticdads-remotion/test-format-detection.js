const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  ollamaUrl: 'http://192.168.1.33:11434',
  outputDir: '/home/kevin/.openclaw/workspace/dadtasticdads-output',
};

const testJokes = [
  { id: 1, text: "Waking up this morning was an eye opening experience.", expected: "one-liner" },
  { id: 3, text: "Why can't your nose be 12 inches long? Because then it'd be a foot!", expected: "setup-punchline" },
  { id: 10, text: "Doctor you've got to help me, I'm addicted to Twitter. Doctor: I don't follow you.", expected: "multi-line" },
];

async function callOllama(model, prompt) {
  const jsonBody = JSON.stringify({ model, prompt, stream: false });
  const jsonFile = path.join(CONFIG.outputDir, `test-${Date.now()}.json`);
  fs.writeFileSync(jsonFile, jsonBody);
  
  return new Promise((resolve, reject) => {
    const curl = `curl -s -X POST "${CONFIG.ollamaUrl}/api/generate" -H "Content-Type: application/json" -d @${jsonFile}`;
    exec(curl, { timeout: 30000 }, (err, stdout, stderr) => {
      try { fs.unlinkSync(jsonFile); } catch {}
      if (err) reject(new Error(stderr || err.message));
      else {
        const response = JSON.parse(stdout);
        resolve(response.response);
      }
    });
  });
}

function extractJSON(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { return {}; }
  }
  return {};
}

async function detectJokeFormat(joke) {
  const prompt = `Analyze this dad joke and break it into display segments for a vertical video.

Joke: "${joke}"

## Format Types:
1. **one-liner**: Single sentence, punchline is the whole joke
2. **setup-punchline**: Clear question→answer structure  
3. **multi-line**: Story-style, dialogue, or 3+ segments

Return ONLY valid JSON (no markdown, no code blocks):
{
  "format": "one-liner",
  "segments": [{"text": "Full joke", "atPercent": 0.0, "display": "fade-in"}],
  "reasoning": "Why this format"
}

Joke: "${joke}"`;

  const response = await callOllama('mistral', prompt);
  console.log('\n=== Raw Response ===');
  console.log(response.substring(0, 500));
  
  const json = extractJSON(response);
  return json;
}

async function main() {
  console.log('Testing Joke Format Detection\n');
  
  for (const joke of testJokes) {
    console.log(`\n--- Joke #${joke.id} (Expected: ${joke.expected}) ---`);
    console.log(`Text: "${joke.text}"`);
    
    try {
      const result = await detectJokeFormat(joke.text);
      console.log('\nParsed Result:');
      console.log(`  Format: ${result.format || 'MISSING'}`);
      console.log(`  Segments: ${result.segments?.length || 0}`);
      console.log(`  Reasoning: ${result.reasoning || 'MISSING'}`);
      
      if (result.format === joke.expected) {
        console.log('  ✅ CORRECT!');
      } else {
        console.log(`  ❌ WRONG (expected ${joke.expected})`);
      }
    } catch (e) {
      console.log(`  ❌ ERROR: ${e.message}`);
    }
  }
}

main();
