#!/usr/bin/env node
/**
 * Import Screensaver Prompts from Markdown to PostgreSQL
 * 
 * Parses /home/kevin/Downloads/screensaver_video_prompts.md
 * and inserts all 400 prompts into mission_control.screensaver_prompts table
 * 
 * Usage:
 *   node tools/import-screensaver-prompts.js
 */

const fs = require('fs');
const { execSync } = require('child_process');

const SOURCE_FILE = '/home/kevin/Downloads/screensaver_video_prompts.md';
const DB_CMD = 'PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d mission_control';

/**
 * Parse the markdown file and extract video sections
 */
function parsePromptsFile(content) {
  const videos = [];
  const videoSections = content.split(/^------------------------------------------------------------------------$/m).filter(section => section.trim().length > 100);
  
  for (const section of videoSections) {
    // Extract video title
    const titleMatch = section.match(/^## Video (\d+): (.+)$/m);
    if (!titleMatch) continue;
    
    const videoNumber = parseInt(titleMatch[1]);
    const videoTitle = titleMatch[2].trim();
    
    // Extract model
    const modelMatch = section.match(/^Model:\s+\*\*(\w+)\*\*/m);
    const model = modelMatch ? modelMatch[1] : 'unknown';
    
    // Extract prompts
    const prompts = [];
    const promptLines = section.split('\n').filter(line => /^\d+\.\s+/.test(line));
    
    for (const line of promptLines) {
      const promptNumber = parseInt(line.match(/^\d+\./)[0]);
      const promptText = line.replace(/^\d+\.\s+/, '').trim();
      prompts.push({ promptNumber, promptText });
    }
    
    if (prompts.length === 0) continue;
    
    videos.push({
      videoNumber,
      videoTitle,
      model,
      prompts
    });
  }
  
  return videos;
}

/**
 * Escape single quotes for SQL
 */
function escapeSql(str) {
  return str.replace(/'/g, "''");
}

/**
 * Import prompts to database
 */
async function importPrompts() {
  console.log('📝 Reading prompts file...');
  const content = fs.readFileSync(SOURCE_FILE, 'utf8');
  
  console.log('🔍 Parsing prompts...');
  const videos = parsePromptsFile(content);
  
  console.log(`Found ${videos.length} video sections\n`);
  
  let totalInserted = 0;
  let totalSkipped = 0;
  
  for (const video of videos) {
    console.log(`Video ${video.videoNumber}: ${video.videoTitle}`);
    console.log(`  Model: ${video.model}`);
    console.log(`  Prompts: ${video.prompts.length}`);
    
    for (const prompt of video.prompts) {
      const id = `video-${video.videoNumber}-prompt-${prompt.promptNumber}`;
      const promptText = escapeSql(prompt.promptText);
      const videoTitle = escapeSql(video.videoTitle);
      
      // Check if already exists
      try {
        const checkResult = execSync(
          `${DB_CMD} -t -c "SELECT COUNT(*) FROM screensaver_prompts WHERE id = '${id}';"`,
          { encoding: 'utf8', stdio: 'pipe' }
        );
        
        if (parseInt(checkResult.trim()) > 0) {
          console.log(`  ⚠️  Prompt ${prompt.promptNumber} already exists, skipping`);
          totalSkipped++;
          continue;
        }
      } catch (e) {
        // Ignore, will try insert
      }
      
      // Insert
      const sql = `
        INSERT INTO screensaver_prompts (
          id, video_number, video_title, prompt_number, model, prompt_text, negative_prompt
        ) VALUES (
          '${id}', 
          ${video.videoNumber}, 
          '${videoTitle}', 
          ${prompt.promptNumber}, 
          '${video.model}', 
          '${promptText}', 
          'blurry, low quality, distorted, deformed objects, watermark, text'
        )`;
      
      try {
        execSync(`${DB_CMD} -c "${sql}"`, { stdio: 'pipe' });
        totalInserted++;
      } catch (e) {
        console.error(`  ❌ Failed to insert prompt ${prompt.promptNumber}: ${e.message}`);
      }
    }
    
    console.log('');
  }
  
  console.log('✅ Import complete!');
  console.log(`   Inserted: ${totalInserted}`);
  console.log(`   Skipped: ${totalSkipped}`);
  console.log(`   Total: ${totalInserted + totalSkipped}`);
  
  // Show summary
  console.log('\n📊 Status summary:');
  const summary = execSync(
    `${DB_CMD} -c "SELECT video_title, status, COUNT(*) as count FROM screensaver_prompts GROUP BY video_title, status ORDER BY video_number, prompt_number;"`,
    { encoding: 'utf8' }
  );
  console.log(summary);
}

// Run
importPrompts().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
