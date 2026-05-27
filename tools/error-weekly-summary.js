#!/usr/bin/env node
/**
 * Error Weekly Summary
 * 
 * Generates weekly summary of error logs for Telegram notification
 * Runs every Sunday at 8 AM via cron
 * 
 * Features:
 * - Counts new errors by category
 * - Identifies top 3 recurring patterns
 * - Suggests fixes based on .learnings/
 * - Sends Telegram alert if >10 new errors
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = '/home/kevin/.openclaw/workspace';
const ERRORS_FILE = path.join(WORKSPACE, '.learnings/ERRORS.md');
const ARCHIVED_FILE = path.join(WORKSPACE, '.learnings/ERRORS-ARCHIVED.md');
const LEARNINGS_DIR = path.join(WORKSPACE, '.learnings');

/**
 * Parse ERRORS.md and count errors by category
 */
function parseErrors() {
    if (!fs.existsSync(ERRORS_FILE)) {
        return { total: 0, byCategory: {}, recent: [] };
    }

    const content = fs.readFileSync(ERRORS_FILE, 'utf8');
    const lines = content.split('\n');
    
    const errors = [];
    let currentError = null;
    
    for (const line of lines) {
        // Match error entries: ## [ERR-YYYYMMDD-XXX] Error Title
        if (line.startsWith('### ')) {
            if (currentError) errors.push(currentError);
            
            const match = line.match(/### \[ERR-(\d{4})(\d{2})(\d{2})-\d+\] (.+)/);
            if (match) {
                currentError = {
                    date: `${match[1]}-${match[2]}-${match[3]}`,
                    time: '00:00',
                    title: match[4],
                    category: categorizeError(match[4]),
                    details: []
                };
            }
        } else if (currentError && line.trim() && !line.startsWith('---') && !line.startsWith('>')) {
            currentError.details.push(line.trim());
        }
    }
    
    if (currentError) errors.push(currentError);
    
    // Count by category
    const byCategory = {};
    for (const error of errors) {
        byCategory[error.category] = (byCategory[error.category] || 0) + 1;
    }
    
    // Get last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recent = errors.filter(e => new Date(e.date) >= sevenDaysAgo);
    
    return {
        total: errors.length,
        byCategory,
        recent,
        recentCount: recent.length
    };
}

/**
 * Categorize error by title
 */
function categorizeError(title) {
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('gog') || titleLower.includes('google') || titleLower.includes('sheets')) {
        return 'Google/gog';
    }
    if (titleLower.includes('ollama') || titleLower.includes('model') || titleLower.includes('llm')) {
        return 'Ollama/Models';
    }
    if (titleLower.includes('gateway') || titleLower.includes('openclaw')) {
        return 'Gateway/OpenClaw';
    }
    if (titleLower.includes('postgres') || titleLower.includes('database') || titleLower.includes('sql')) {
        return 'Database';
    }
    if (titleLower.includes('remotion') || titleLower.includes('video') || titleLower.includes('ffmpeg')) {
        return 'Video/Remotion';
    }
    if (titleLower.includes('n8n') || titleLower.includes('webhook')) {
        return 'n8n/Webhooks';
    }
    if (titleLower.includes('github') || titleLower.includes('git')) {
        return 'GitHub';
    }
    if (titleLower.includes('memory') || titleLower.includes('mem0')) {
        return 'Memory/mem0';
    }
    if (titleLower.includes('heartbeat') || titleLower.includes('cron')) {
        return 'Heartbeat/Cron';
    }
    
    return 'Other';
}

/**
 * Find recurring patterns in recent errors
 */
function findRecurringPatterns(recent) {
    const patternCount = {};
    
    for (const error of recent) {
        // Extract key phrases from title
        const phrases = error.title
            .toLowerCase()
            .split(/[\s-]+/)
            .filter(w => w.length > 4); // Skip short words
        
        for (const phrase of phrases) {
            patternCount[phrase] = (patternCount[phrase] || 0) + 1;
        }
    }
    
    // Sort by frequency
    const sorted = Object.entries(patternCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
    
    return sorted.map(([pattern, count]) => ({ pattern, count }));
}

/**
 * Scan .learnings/ for relevant fix suggestions
 */
function findRelevantLearnings(recent) {
    const suggestions = [];
    
    if (!fs.existsSync(LEARNINGS_DIR)) return suggestions;
    
    const files = fs.readdirSync(LEARNINGS_DIR);
    
    for (const file of files) {
        if (!file.endsWith('.md')) continue;
        if (file.startsWith('ERRORS')) continue;
        
        const filePath = path.join(LEARNINGS_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check if this learning relates to any recent errors
        for (const error of recent) {
            const errorKeywords = error.title.toLowerCase().split(/[\s-]+/).slice(0, 5);
            const hasMatch = errorKeywords.some(k => k.length > 4 && content.toLowerCase().includes(k));
            
            if (hasMatch) {
                suggestions.push({
                    error: error.title,
                    learning: file,
                    excerpt: content.split('\n').slice(0, 3).join('\n').slice(0, 150)
                });
            }
        }
    }
    
    return suggestions.slice(0, 3); // Top 3 suggestions
}

/**
 * Generate weekly summary message
 */
function generateSummary() {
    const stats = parseErrors();
    const patterns = findRecurringPatterns(stats.recent);
    const learnings = findRelevantLearnings(stats.recent);
    
    const now = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    let message = `📊 **Error Weekly Summary**\n`;
    message += `_${weekAgo.toISOString().split('T')[0]} → ${now.toISOString().split('T')[0]}_\n\n`;
    
    message += `**New Errors:** ${stats.recentCount}\n`;
    message += `**Total Errors:** ${stats.total}\n\n`;
    
    if (stats.recentCount > 0) {
        message += `**By Category:**\n`;
        const sortedCats = Object.entries(stats.byCategory)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        for (const [cat, count] of sortedCats) {
            message += `• ${cat}: ${count}\n`;
        }
        message += '\n';
    }
    
    if (patterns.length > 0) {
        message += `**Top Patterns:**\n`;
        for (const { pattern, count } of patterns) {
            message += `• "${pattern}" (${count}x)\n`;
        }
        message += '\n';
    }
    
    if (learnings.length > 0) {
        message += `**Relevant Learnings:**\n`;
        for (const { error, learning, excerpt } of learnings) {
            message += `• ${learning} → ${excerpt}...\n`;
        }
        message += '\n';
    }
    
    // Alert threshold
    if (stats.recentCount > 10) {
        message += `⚠️ **High error volume** - ${stats.recentCount} errors this week (>10 threshold)\n`;
    } else if (stats.recentCount === 0) {
        message += `✅ **Clean week** - No new errors!\n`;
    }
    
    return {
        message,
        shouldAlert: stats.recentCount > 10,
        stats
    };
}

// CLI mode
if (require.main === module) {
    const result = generateSummary();
    console.log(result.message);
    
    if (process.argv.includes('--json')) {
        console.log('\n---JSON---');
        console.log(JSON.stringify(result.stats, null, 2));
    }
}

module.exports = {
    generateSummary,
    parseErrors,
    categorizeError,
    findRecurringPatterns,
    findRelevantLearnings
};
