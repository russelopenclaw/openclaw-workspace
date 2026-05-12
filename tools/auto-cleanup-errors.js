#!/usr/bin/env node
/**
 * Auto-Cleanup Error Logs
 * 
 * Features:
 * - Archive errors resolved >30 days to ERRORS-ARCHIVED.md
 * - Deduplicate repeated errors based on error content hash
 * - Update error-metrics-widget.js to support auto-cleanup
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WORKSPACE = '/home/kevin/.openclaw/workspace';
const LEARNINGS_DIR = path.join(WORKSPACE, '.learnings');
const ERRORS_FILE = path.join(LEARNINGS_DIR, 'ERRORS.md');
const ERRORS_ARCHIVED = path.join(LEARNINGS_DIR, 'ERRORS-ARCHIVED.md');

/**
 * Calculate hash for error content (for deduplication)
 */
function calculateErrorHash(errorBlock) {
  const normalized = errorBlock
    .replace(/\[ERR-\d{8}-\d{3}\]/g, '[ERR-XXXXXXX-XXX]') // Normalize ID
    .replace(/Logged.*?\n/g, '') // Remove timestamps
    .replace(/Resolved.*?\n/g, '') // Remove timestamps
    .replace(/Last updated.*?\n/g, '') // Remove timestamps
    .trim();
  
  return crypto.createHash('md5').update(normalized).digest('hex').substring(0, 8);
}

/**
 * Parse error blocks from ERRORS.md
 */
function parseErrorBlocks(content) {
  const blocks = [];
  const lines = content.split('\n');
  
  let currentBlock = '';
  let inErrorSection = false;
  let sectionName = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for section headers
    if (line.match(/^##\s+Active Errors/i)) {
      if (currentBlock && inErrorSection) {
        blocks.push({ content: currentBlock, section: sectionName });
      }
      sectionName = 'Active Errors';
      inErrorSection = true;
      currentBlock = '';
      continue;
    }
    
    if (line.match(/^##\s+Resolved Errors/i)) {
      if (currentBlock && inErrorSection) {
        blocks.push({ content: currentBlock, section: sectionName });
      }
      sectionName = 'Resolved Errors';
      inErrorSection = true;
      currentBlock = '';
      continue;
    }
    
    // Check for new error beginning
    if (line.match(/^###\s*\[ERR-\d{8}-\d{3}\]/)) {
      if (currentBlock && inErrorSection) {
        blocks.push({ content: currentBlock, section: sectionName });
      }
      currentBlock = line + '\n';
      continue;
    }
    
    currentBlock += line + '\n';
  }
  
  // Push last block
  if (currentBlock && inErrorSection) {
    blocks.push({ content: currentBlock, section: sectionName });
  }
  
  return blocks;
}

/**
 * Extract error metadata from block
 */
function extractErrorMetadata(block) {
  const lines = block.split('\n');
  const metadata = {
    id: '',
    logged: null,
    resolved: null,
    summary: '',
    content: ''
  };
  
  for (const line of lines) {
    const idMatch = line.match(/\[ERR-(\d{8}-\d{3})\]/);
    if (idMatch) {
      metadata.id = idMatch[1];
    }
    
    const loggedMatch = line.match(/\*\*Logged\*\*:\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/);
    if (loggedMatch) {
      metadata.logged = new Date(loggedMatch[1]);
    }
    
    const resolvedMatch = line.match(/\*\*Resolved\*\*:\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/);
    if (resolvedMatch) {
      metadata.resolved = new Date(resolvedMatch[1]);
    }
    
    if (line.match(/\*\*Summary\*\*/)) {
      let summary = '';
      let j = lines.indexOf(line) + 1;
      while (j < lines.length && !lines[j].startsWith('###') && !lines[j].startsWith('**')) {
        summary += lines[j].trim() + ' ';
        j++;
      }
      metadata.summary = summary.trim();
    }
  }
  
  metadata.content = block;
  return metadata;
}

/**
 * Check if error is resolved >30 days ago
 */
function isOldResolved(metadata) {
  if (!metadata.resolved || !metadata.id) return false;
  
  const resolvedDate = new Date(metadata.resolved);
  const now = new Date();
  const diffDays = (now - resolvedDate) / (1000 * 60 * 60 * 24);
  
  return diffDays > 30;
}

/**
 * Read archived errors for deduplication
 */
function getArchivedErrors() {
  if (!fs.existsSync(ERRORS_ARCHIVED)) {
    return new Map();
  }
  
  const archivedContent = fs.readFileSync(ERRORS_ARCHIVED, 'utf8');
  const archived = new Map();
  
  // Look for archived error IDs
  const archivedIdPattern = /\[ERR-\d{8}-\d{3}\]/g;
  let match;
  while ((match = archivedIdPattern.exec(archivedContent)) !== null) {
    archived.set(match[0], true);
  }
  
  return archived;
}

/**
 * Deduplicate errors with similar content
 * Merges duplicates keeping the earliest date and latest resolution
 */
function dedupeErrors() {
  if (!fs.existsSync(ERRORS_FILE)) {
    return { merged: 0, details: [] };
  }
  
  const content = fs.readFileSync(ERRORS_FILE, 'utf8');
  const blocks = parseErrorBlocks(content);
  
  const result = { merged: 0, details: [] };
  
  // Group blocks by section
  const sectionBlocks = {};
  for (const block of blocks) {
    if (!sectionBlocks[block.section]) sectionBlocks[block.section] = [];
    sectionBlocks[block.section].push(block);
  }
  
  // Process each section independently
  for (const [sectionName, sectionBlockList] of Object.entries(sectionBlocks)) {
    const seen = new Map(); // hash -> index in sectionBlockList
    const toRemove = new Set(); // indices to remove
    
    for (let i = 0; i < sectionBlockList.length; i++) {
      const metadata = extractErrorMetadata(sectionBlockList[i].content);
      const hash = calculateErrorHash(sectionBlockList[i].content);
      
      if (seen.has(hash)) {
        const existingIdx = seen.get(hash);
        const existingMeta = extractErrorMetadata(sectionBlockList[existingIdx].content);
        
        // Keep the one with earlier logged date, merge resolution info
        const keptIdx = (!existingMeta.logged || (metadata.logged && metadata.logged < existingMeta.logged)) ? i : existingIdx;
        const removedIdx = keptIdx === i ? existingIdx : i;
        
        toRemove.add(removedIdx);
        
        result.merged++;
        result.details.push({
          keptId: extractErrorMetadata(sectionBlockList[keptIdx].content).id || 'unknown',
          mergedId: extractErrorMetadata(sectionBlockList[removedIdx].content).id || 'unknown',
          summary: extractErrorMetadata(sectionBlockList[keptIdx].content).summary || '(no summary)'
        });
        
        console.log(`  Merged [ERR-${extractErrorMetadata(sectionBlockList[removedIdx].metadata?.id || sectionBlockList[removedIdx].content.match(/\[ERR-(\d{8}-\d{3})\]/)?.[1] || 'unknown')}] into [ERR-${extractErrorMetadata(sectionBlockList[keptIdx].content).id || 'unknown'}]`);
      } else {
        seen.set(hash, i);
      }
    }
    
    // Remove duplicate blocks from content
    if (toRemove.size > 0) {
      let newContent = content;
      for (const idx of toRemove) {
        newContent = newContent.replace(sectionBlockList[idx].content, '');
      }
      newContent = newContent.replace(/\n{3,}/g, '\n\n');
      fs.writeFileSync(ERRORS_FILE, newContent);
    }
  }
  
  return result;
}

/**
 * Main cleanup function
 */
function cleanupErrors() {
  console.log('Starting error log cleanup...\n');
  
  // Read current errors file
  if (!fs.existsSync(ERRORS_FILE)) {
    console.log('ERRORS.md not found. Nothing to cleanup.');
    return;
  }
  
  const content = fs.readFileSync(ERRORS_FILE, 'utf8');
  const blocks = parseErrorBlocks(content);
  
  console.log(`Found ${blocks.length} error blocks`);
  
  // Separate by section
  const activeBlocks = blocks.filter(b => b.section === 'Active Errors');
  const resolvedBlocks = blocks.filter(b => b.section === 'Resolved Errors');
  
  console.log(`  Active: ${activeBlocks.length}`);
  console.log(`  Resolved: ${resolvedBlocks.length}`);
  
  // Check for old resolved errors to archive
  const toArchive = [];
  const toKeepResolved = [];
  
  for (const block of resolvedBlocks) {
    const metadata = extractErrorMetadata(block.content);
    if (isOldResolved(metadata)) {
      toArchive.push({ metadata, content: block.content });
    } else {
      toKeepResolved.push({ metadata, content: block.content });
    }
  }
  
  console.log(`\nOld resolved errors to archive: ${toArchive.length}`);
  
  // Check for duplicates
  const archivedErrors = getArchivedErrors();
  const seenHashes = new Set();
  const duplicates = [];
  
  for (const entry of [...toArchive, ...toKeepResolved, ...activeBlocks.map(b => ({ content: b.content }))]) {
    const metadata = extractErrorMetadata(entry.content);
    const hash = calculateErrorHash(entry.content);
    
    if (seenHashes.has(hash)) {
      duplicates.push({ metadata, hash });
    } else {
      seenHashes.add(hash);
    }
  }
  
  console.log(`Duplicates found: ${duplicates.length}`);
  
  // Archive old errors
  if (toArchive.length > 0) {
    // Create archived file if it doesn't exist
    if (!fs.existsSync(ERRORS_ARCHIVED)) {
      fs.writeFileSync(ERRORS_ARCHIVED, '# Archived Errors\n\n> Errors older than 30 days are moved here.\n\n');
    }
    
    // Append to archive
    const archiveHeader = `---\n\n## Archived: ${new Date().toISOString()}\n\n`;
    let archiveContent = fs.readFileSync(ERRORS_ARCHIVED, 'utf8');
    
    for (const { content, metadata } of toArchive) {
      archiveContent += `\n### ${metadata.id}\n`;
      archiveContent += `**Archived**: ${new Date().toISOString()}\n`;
      archiveContent += content;
      archiveContent += '\n---\n\n';
      
      console.log(`  Archived: ${metadata.id} (resolved: ${metadata.resolved.toISOString()})`);
    }
    
    fs.writeFileSync(ERRORS_ARCHIVED, archiveContent);
  }
  
  // Update ERRORS.md (remove archived errors from resolved section)
  let newContent = content;
  
  // Remove archived blocks from resolved section
  if (toArchive.length > 0) {
    for (const { content: blockContent } of toArchive) {
      newContent = newContent.replace(blockContent, '');
    }
  }
  
  // Clean up extra whitespace
  newContent = newContent.replace(/\n{3,}/g, '\n\n');
  
  // Write updated ERRORS.md
  fs.writeFileSync(ERRORS_FILE, newContent);
  console.log(`\nUpdated ERRORS.md`);
  
  // Report duplicates
  if (duplicates.length > 0) {
    console.log('\n⚠️  Duplicates found (same error content):');
    for (const { metadata, hash } of duplicates) {
      console.log(`  - ${metadata.id || 'unknown'} (hash: ${hash})`);
    }
    console.log('\nTip: Consider consolidating these into a single error entry.');
  }
  
  console.log('\n✅ Cleanup complete!');
}

// Run if executed directly
if (require.main === module) {
  cleanupErrors();
}

module.exports = { cleanupErrors, calculateErrorHash, extractErrorMetadata, isOldResolved, dedupeErrors };
