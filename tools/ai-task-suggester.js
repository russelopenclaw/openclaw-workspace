#!/usr/bin/env node
/**
 * AI Task Suggester
 * Analyzes completed work patterns + calendar to suggest high-value tasks
 * 
 * Generates intelligent task recommendations based on:
 * - Historical completion patterns
 * - Upcoming calendar events
 * - Current backlog priorities
 * - System health indicators
 * 
 * Usage: node tools/ai-task-suggester.js
 * Schedule: Every heartbeat (conversational context) or daily briefing
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE = '/home/kevin/.openclaw/workspace';
const LOG_FILE = path.join(WORKSPACE, '.learnings', 'task-suggester.log');
const SUGGESTIONS_FILE = path.join(WORKSPACE, '.suggested-tasks.json');

// Colors
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[36m';
const RESET = '\x1b[0m';

function log(color, msg) {
    const timestamp = new Date().toISOString();
    console.log(`${color}[${timestamp}] ${msg}${RESET}`);
    fs.appendFileSync(LOG_FILE, `[${timestamp}] ${msg}\n`);
}

/**
 * Analyze completed tasks to find patterns
 */
function getCompletionPatterns() {
    try {
        // Get tasks completed in last 7 days
        const result = execSync(
            `PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d mission_control -t -c ` +
            `"SELECT id, title, description, completed_at, priority, ` +
            `EXTRACT(EPOCH FROM (completed_at - created_at))/3600 as hours_to_complete ` +
            `FROM tasks WHERE column_name='complete' AND completed_at > NOW() - INTERVAL '7 days' ` +
            `ORDER BY completed_at DESC;"`,
            { encoding: 'utf8' }
        );
        
        const tasks = [];
        result.split('\n').forEach(line => {
            const parts = line.split('|').map(s => s.trim());
            if (parts.length >= 6 && parts[0] !== 'id') {
                tasks.push({
                    id: parts[0],
                    title: parts[1],
                    description: parts[2],
                    completedAt: parts[3],
                    priority: parts[4],
                    hoursToComplete: parseFloat(parts[5]) || 0
                });
            }
        });
        
        return {
            count: tasks.length,
            avgHours: tasks.reduce((a, b) => a + b.hoursToComplete, 0) / (tasks.length || 1),
            priorities: tasks.reduce((acc, t) => { acc[t.priority] = (acc[t.priority] || 0) + 1; return acc; }, {}),
            recent: tasks.slice(0, 5)
        };
    } catch (e) {
        return { count: 0, avgHours: 0, priorities: {}, recent: [] };
    }
}

/**
 * Check upcoming calendar events (next 48 hours)
 */
function getUpcomingEvents() {
    try {
        const calendarPath = path.join(WORKSPACE, 'calendar', 'events.json');
        if (!fs.existsSync(calendarPath)) return [];
        
        const data = JSON.parse(fs.readFileSync(calendarPath, 'utf8'));
        const now = new Date();
        const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
        
        return data.filter(e => {
            const eventDate = new Date(e.date || e.time);
            return eventDate >= now && eventDate <= in48h;
        });
    } catch (e) {
        return [];
    }
}

/**
 * Analyze current backlog
 */
function getBacklogAnalysis() {
    try {
        const result = execSync(
            `PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d mission_control -t -c ` +
            `"SELECT id, title, priority, description, created_at FROM tasks WHERE column_name='backlog' ` +
            `ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END, created_at ASC;"`,
            { encoding: 'utf8' }
        );
        
        const tasks = [];
        result.split('\n').forEach(line => {
            const parts = line.split('|').map(s => s.trim());
            if (parts.length >= 5 && parts[0] !== 'id') {
                tasks.push({
                    id: parts[0],
                    title: parts[1],
                    priority: parts[2],
                    description: parts[3],
                    createdAt: parts[4]
                });
            }
        });
        
        return {
            total: tasks.length,
            high: tasks.filter(t => t.priority === 'high').length,
            medium: tasks.filter(t => t.priority === 'medium').length,
            low: tasks.filter(t => t.priority === 'low').length,
            tasks: tasks.slice(0, 10)
        };
    } catch (e) {
        return { total: 0, high: 0, medium: 0, low: 0, tasks: [] };
    }
}

/**
 * Check system health signals
 */
function getSystemSignals() {
    const signals = [];
    
    // Check error logs
    const errorsPath = path.join(WORKSPACE, '.learnings', 'ERRORS.md');
    if (fs.existsSync(errorsPath)) {
        const content = fs.readFileSync(errorsPath, 'utf8');
        const activeErrors = content.split('\n').filter(l => l.includes('[ERR-'));
        if (activeErrors.length > 0) {
            signals.push({ type: 'errors', count: activeErrors.length, message: 'Active errors need resolution' });
        }
    }
    
    // Check stuck tasks (in-progress > 1 hour)
    try {
        const result = execSync(
            `PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d mission_control -t -c ` +
            `"SELECT COUNT(*) FROM tasks WHERE column_name='in-progress' AND updated_at < NOW() - INTERVAL '1 hour';"`,
            { encoding: 'utf8' }
        );
        const stuck = parseInt(result.trim()) || 0;
        if (stuck > 0) {
            signals.push({ type: 'stuck', count: stuck, message: 'Stuck tasks need attention' });
        }
    } catch (e) {}
    
    // Check sub-agent failures
    try {
        const result = execSync(
            `PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d mission_control -t -c ` +
            `"SELECT COUNT(*) FROM tasks WHERE linked_subagent IS NOT NULL AND column_name IN ('backlog', 'review') AND updated_at < NOW() - INTERVAL '4 hour';"`,
            { encoding: 'utf8' }
        );
        const failed = parseInt(result.trim()) || 0;
        if (failed > 0) {
            signals.push({ type: 'failed-subagents', count: failed, message: 'Sub-agent failures need recovery' });
        }
    } catch (e) {}
    
    return signals;
}

/**
 * Generate smart suggestions using pattern matching + heuristics
 */
function generateSuggestions() {
    log(BLUE, '🧠 Analyzing work patterns and generating suggestions...');
    
    const patterns = getCompletionPatterns();
    const events = getUpcomingEvents();
    const backlog = getBacklogAnalysis();
    const signals = getSystemSignals();
    
    const suggestions = [];
    
    // Pattern-based: If we complete many small tasks, suggest batching
    if (patterns.count >= 5 && patterns.avgHours < 1) {
        suggestions.push({
            type: 'pattern',
            priority: 'high',
            category: 'productivity',
            title: 'Batch similar small tasks',
            description: `You completed ${patterns.count} tasks in 7 days (avg ${patterns.avgHours.toFixed(1)}h each). ` +
                        `Consider batching them into a single automation script to save time.`,
            effort: '1-2 hours',
            impact: 'Reduces repetitive work'
        });
    }
    
    // Error-based: If errors exist, suggest cleanup
    const errorSignal = signals.find(s => s.type === 'errors');
    if (errorSignal && errorSignal.count > 0) {
        suggestions.push({
            type: 'signal',
            priority: 'high',
            category: 'reliability',
            title: 'Review and resolve active errors',
            description: `${errorSignal.count} errors logged in .learnings/ERRORS.md. ` +
                        `Review and implement fixes or mark as resolved.`,
            effort: '30 min - 1 hour',
            impact: 'Improves system reliability'
        });
    }
    
    // Stuck task-based: Suggest intervention
    const stuckSignal = signals.find(s => s.type === 'stuck');
    if (stuckSignal && stuckSignal.count > 0) {
        suggestions.push({
            type: 'signal',
            priority: 'high',
            category: 'operations',
            title: `Unstick ${stuckSignal.count} in-progress task(s)`,
            description: `${stuckSignal.count} task(s) stuck >1 hour. Investigate blockers and reassign or complete.`,
            effort: '15-30 min',
            impact: 'Unblocks workflow'
        });
    }
    
    // Calendar-based: If events coming, suggest prep work
    if (events.length > 0) {
        const eventTitles = events.map(e => e.title).join(', ');
        suggestions.push({
            type: 'calendar',
            priority: 'medium',
            category: 'planning',
            title: 'Prepare for upcoming events',
            description: `Events in next 48h: ${eventTitles}. Review agenda, prepare materials, or schedule pre-meeting work.`,
            effort: '30 min',
            impact: 'Better meeting outcomes'
        });
    }
    
    // Backlog-based: If high-priority items sitting, suggest focus
    if (backlog.high >= 1) {
        const highPriorityTask = backlog.tasks.find(t => t.priority === 'high');
        if (highPriorityTask) {
            suggestions.push({
                type: 'backlog',
                priority: 'high',
                category: 'focus',
                title: `Complete high-priority: ${highPriorityTask.title}`,
                description: highPriorityTask.description || 'High-impact task waiting in backlog.',
                effort: '1-3 hours',
                impact: 'Unblocks dependent work'
            });
        }
    }
    
    // Quality signal: If many completions, suggest documentation/testing
    if (patterns.count >= 10) {
        suggestions.push({
            type: 'pattern',
            priority: 'medium',
            category: 'quality',
            title: 'Document and test completed features',
            description: `${patterns.count} tasks completed recently. ` +
                        `Create runbooks, add tests, and document architecture for future maintenance.`,
            effort: '2-4 hours',
            impact: 'Preserves institutional knowledge'
        });
    }
    
    // System improvement: Always suggest one meta-improvement
    suggestions.push({
        type: 'meta',
        priority: 'medium',
        category: 'optimization',
        title: 'System improvement: Automate a manual process',
        description: 'Review completed work patterns. Identify one repetitive task that could be automated ' +
                    '(e.g., morning briefings, health checks, backups). Automate it to reduce future toil.',
        effort: '1-2 hours',
        impact: 'Permanent time savings'
    });
    
    // Sort by priority
    suggestions.sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.priority] - order[b.priority];
    });
    
    return {
        generated: suggestions,
        context: {
            completions: patterns.count,
            backlog: backlog.total,
            signals: signals.length,
            events: events.length
        },
        timestamp: new Date().toISOString()
    };
}

/**
 * Save suggestions to file and optionally send to user
 */
function saveSuggestions(suggestions) {
    log(GREEN, `Generated ${suggestions.generated.length} suggestions`);
    
    // Save to file
    fs.writeFileSync(SUGGESTIONS_FILE, JSON.stringify(suggestions, null, 2));
    log(GREEN, `Saved to ${SUGGESTIONS_FILE}`);
    
    return suggestions;
}

/**
 * Format suggestions for display
 */
function formatSuggestions(suggestions) {
    let output = '\n🎯 **AI Task Suggestions** (generated at ' + suggestions.timestamp + ')\n\n';
    
    suggestions.generated.forEach((s, i) => {
        const emoji = s.priority === 'high' ? '🔴' : s.priority === 'medium' ? '🟡' : '🟢';
        output += `${i + 1}. ${emoji} **${s.title}** (${s.category})\n`;
        output += `   ${s.description}\n`;
        output += `   Effort: ${s.effort} | Impact: ${s.impact}\n\n`;
    });
    
    output += `---\n*Context: ${suggestions.context.completions} completions, ` +
              `${suggestions.context.backlog} backlog, ${suggestions.context.signals} signals detected*\n`;
    
    return output;
}

// Main
async function main() {
    try {
        const suggestions = generateSuggestions();
        saveSuggestions(suggestions);
        
        const formatted = formatSuggestions(suggestions);
        console.log(formatted);
        
        log(GREEN, '✓ Task suggestions generated');
        process.exit(0);
    } catch (e) {
        log('Error: ' + e.message);
        console.error(e);
        process.exit(1);
    }
}

module.exports = { generateSuggestions, saveSuggestions, formatSuggestions };

main();
