#!/usr/bin/env node
/**
 * Update screensaver_prompts table with:
 * - effect_duration: 27 seconds
 * - effect_type: random, but not same as previous prompt
 */

const { Pool } = require('pg');

const EFFECTS = ['zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'pan_up', 'pan_down'];

// Database config
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'mission_control',
  user: 'alfred',
  password: 'AlfredDB2026Secure'
});

function getRandomEffect(excludeEffect) {
  const available = EFFECTS.filter(e => e !== excludeEffect);
  const randomIndex = Math.floor(Math.random() * available.length);
  return available[randomIndex];
}

async function updateEffects() {
  console.log('🎬 Updating screensaver_prompts with random effects...\n');
  
  // Get all prompts ordered by video_number, prompt_number
  const query = `
    SELECT id, video_number, prompt_number, effect_type
    FROM screensaver_prompts
    ORDER BY video_number, prompt_number
  `;
  
  const result = await pool.query(query);
  const rows = result.rows;
  
  console.log(`📊 Found ${rows.length} prompts to update\n`);
  
  let previousEffect = null;
  let updateCount = 0;
  let sameAsPreviousCount = 0;
  
  // Build batch update
  const updates = [];
  
  for (const row of rows) {
    const newEffect = getRandomEffect(previousEffect);
    
    if (newEffect === previousEffect) {
      console.error(`❌ ERROR: Same effect as previous for ${row.id}`);
      sameAsPreviousCount++;
    }
    
    updates.push({
      id: row.id,
      effect_type: newEffect,
      effect_duration: 27
    });
    
    // Debug: log first 5
    if (updateCount < 5) {
      console.log(`  ${row.id}: ${newEffect} (prev: ${previousEffect})`);
    }
    
    previousEffect = newEffect;
    updateCount++;
    
    if (updateCount % 50 === 0) {
      console.log(`⏳ Processed ${updateCount}/${rows.length}...`);
    }
  }
  
  console.log(`\nFirst 5 updates:`, updates.slice(0, 5));
  
  console.log(`\n🔧 Applying ${updates.length} updates...\n`);
  
  // Execute individual updates (simpler, avoids UNNEST type issues)
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const u of updates) {
      await client.query(
        'UPDATE screensaver_prompts SET effect_type = $1, effect_duration = $2, updated_at = NOW() WHERE id = $3',
        [u.effect_type, u.effect_duration, u.id]
      );
    }
    
    await client.query('COMMIT');
    console.log('✅ Transaction committed');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  
  console.log(`✅ Successfully updated ${updateCount} prompts`);
  console.log(`   - effect_duration: 27 seconds`);
  console.log(`   - effect_type: randomized (no consecutive repeats)`);
  
  // Verify the update
  const verifyQuery = `
    SELECT 
      video_number,
      prompt_number,
      effect_type,
      effect_duration,
      LAG(effect_type) OVER (ORDER BY video_number, prompt_number) as prev_effect
    FROM screensaver_prompts
    WHERE video_number <= 2
    ORDER BY video_number, prompt_number
    LIMIT 20
  `;
  
  const verify = await pool.query(verifyQuery);
  
  console.log('\n📋 Sample verification (first 20 rows):\n');
  console.log('Video | Prompt | Effect      | Duration | Previous Effect');
  console.log('------|--------|-------------|----------|----------------');
  
  verify.rows.forEach(row => {
    const sameAsPrev = row.effect_type === row.prev_effect ? ' ⚠️ SAME!' : ' ✓';
    console.log(`${row.video_number.toString().padStart(5)} | ${row.prompt_number.toString().padStart(6)} | ${row.effect_type.padEnd(11)} | ${row.effect_duration.toString().padStart(8)} | ${row.prev_effect || 'N/A'}${sameAsPrev}`);
  });
  
  await pool.end();
}

// Run
updateEffects().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
