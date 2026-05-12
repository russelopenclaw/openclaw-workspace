#!/usr/bin/env node
/**
 * Sub-Agent Pool Manager - Runtime Integration Script
 * 
 * This script provides pool management LOGIC but must be called from within
 * an OpenClaw agent session to use the `sessions_spawn` tool.
 * 
 * Integration: Call managePool() from Alfred session when heartbeat runs.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE = '/home/kevin/.openclaw/workspace';
const LOG_FILE = path.join(WORKSPACE, '.learnings', 'subagent-pool.log');
const STATE_FILE = path.join(WORKSPACE, '.learnings', 'subagent-pool-state.json');

const CONFIG = {
    maxConcurrent: 5,
    minConcurrent: 1,
    backlogThreshold: 3
};

const MODEL_MAP = {
    code: 'qwen2.5-coder:7b',
    codeLarge: 'qwen3-coder-next:cloud',
    research: 'llama3.1:8b',
    quick: 'qwen2.5:7b',
    default: 'qwen2.5:7b'
};

// Import agent registry for intelligent assignment
const agentRegistry = require('./agent-registry.js');

function log(msg) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${msg}`);
    fs.appendFileSync(LOG_FILE, `[${timestamp}] ${msg}\n`);
}

function getBacklogUnassigned() {
    try {
        const result = execSync(
            `PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d mission_control -t -c ` +
            `"SELECT id, title, priority FROM tasks WHERE column_name='backlog' AND (assignee IS NULL OR assignee = '') ` +
            `ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END, created_at ASC LIMIT 5;"`,
            { encoding: 'utf8' }
        );
        const tasks = [];
        result.split('\n').forEach(line => {
            const [id, title, priority] = line.split('|').map(s => s.trim());
            if (id && id !== 'id') tasks.push({ id, title, priority });
        });
        return tasks;
    } catch (e) {
        return [];
    }
}

function getActiveAgentCount() {
    try {
        const result = execSync(
            `PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d mission_control -t -c ` +
            `"SELECT COUNT(*) FROM tasks WHERE column_name='in-progress' AND linked_subagent IS NOT NULL AND linked_subagent != ''; "`,
            { encoding: 'utf8' }
        );
        return parseInt(result.trim()) || 0;
    } catch (e) {
        return 0;
    }
}

function detectTaskType(title, deliverables = '') {
    // Use registry for intelligent agent selection
    const result = agentRegistry.getBestAgentForTask(title, deliverables);
    return result.agent;
}

/**
 * Main pool management function - call this from OpenClaw session
 * 
 * @param {Object} openclawTools - OpenClaw tool functions (sessions_spawn, etc.)
 * @returns {Object} Pool status
 */
async function managePool(openclawTools) {
    log('🏊 Evaluating sub-agent pool...');
    
    const unassigned = getBacklogUnassigned();
    const activeCount = getActiveAgentCount();
    
    log(`  Backlog: ${unassigned.length} unassigned | Active: ${activeCount}/${CONFIG.maxConcurrent}`);
    
    const results = {
        backlog: unassigned.length,
        active: activeCount,
        spawned: 0,
        tasks: []
    };
    
    // Scale UP: Assign to specialized agents
    if (unassigned.length > 0 && activeCount < CONFIG.maxConcurrent) {
        const toSpawn = Math.min(CONFIG.maxConcurrent - activeCount, unassigned.length);
        log(`  ↑ Scaling up: ${toSpawn} sub-agent(s)`);
        
        for (let i = 0; i < toSpawn; i++) {
            const task = unassigned[i];
            
            // Use registry for intelligent agent selection
            const agentResult = agentRegistry.getBestAgentForTask(task.title, task.description || '');
            const agentType = agentResult.agent;
            const agentInfo = agentRegistry.AGENTS[agentType];
            
            // Select model based on task priority
            const priority = task.priority || 'medium';
            const model = priority === 'high' ? agentInfo.models.large : agentInfo.models.small;
            
            log(`  → Spawning ${agentInfo.name} for ${task.id}: ${agentResult.confidence} confidence`);
            
            try {
                // Use OpenClaw tool to spawn sub-agent
                await openclawTools.sessions_spawn({
                    runtime: 'subagent',
                    model: model,
                    thinking: 'off',  // Workers execute, don't reason
                    task: `Complete task ${task.id}: ${task.title}`,
                    label: `${agentInfo.name}-${task.id}`,
                    cleanup: 'delete',  // Auto-cleanup on completion
                });
                
                results.spawned++;
                results.tasks.push({
                    id: task.id,
                    agent: agentInfo.name,
                    agentType: agentType,
                    model: model,
                    confidence: agentResult.confidence,
                });
                
                // Update task: IN_PROGRESS + linked to sub-agent
                execSync(
                    `PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d mission_control -c ` +
                    `"UPDATE tasks SET column_name='IN_PROGRESS', assignee='${agentInfo.name}', started_at=NOW(), updated_at=NOW() WHERE id='${task.id}';"`,
                    { encoding: 'utf8', stdio: 'ignore' }
                );
                
                log(`  ✓ ${agentInfo.name} spawned for ${task.id}: ${model}`);
            } catch (e) {
                log(`  ❌ Failed: ${e.message.split('\n')[0]}`);
            }
        }
    }
    
    // Scale DOWN logic (future: check idle agents and terminate)
    if (unassigned.length === 0 && activeCount > CONFIG.minConcurrent) {
        log(`  ↓ Over-provisioned: ${activeCount} active, ${CONFIG.minConcurrent} min`);
        // Future: gracefully complete or reassign
    }
    
    log(`  ✓ Pool status: ${results.spawned} spawned, ${activeCount} active`);
    return results;
}

// Export for use in OpenClaw sessions
module.exports = { managePool, CONFIG, MODEL_MAP };

// CLI mode (for testing/standalone)
if (require.main === module) {
    log('Pool manager loaded (requires OpenClaw runtime for spawning)');
    const unassigned = getBacklogUnassigned();
    const active = getActiveAgentCount();
    console.log(`Backlog: ${unassigned.length} | Active: ${active}`);
    process.exit(0);
}
