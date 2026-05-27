#!/usr/bin/env node
/**
 * Self-Healing System Monitor
 * Monitors critical services, auto-restarts when down, sends Telegram alerts
 * 
 * Services monitored:
 * - Mission Control (port 8765) - Next.js dev server
 * - Ollama (port 11434) - LLM inference server
 * - PostgreSQL (port 5432) - Database
 * - OpenClaw Gateway - Agent runtime
 * 
 * Usage: node tools/self-healing-monitor.js
 * Schedule: Every 5 minutes via cron
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Configuration
const TELEGRAM_CHAT_ID = '8177470832';
const WORKSPACE = '/home/kevin/.openclaw/workspace';
const LOG_FILE = path.join(WORKSPACE, '.learnings', 'self-healing.log');
const STATE_FILE = path.join(WORKSPACE, '.learnings', 'self-healing-state.json');

// Services to monitor
// Check if Ollama is installed on this host
const hasOllama = (() => {
    try {
        execSync('which ollama', { encoding: 'utf8', stdio: 'ignore' });
        return true;
    } catch (e) {
        return false;
    }
})();

const SERVICES = [
    {
        name: 'Mission Control',
        check: 'curl -s --max-time 3 http://localhost:8765/api/status',
        restartCmd: 'cd /home/kevin/.openclaw/workspace/mission-control && pgrep -f "next dev" >/dev/null && echo "Already running" || nohup npm run dev -- -p 8765 > .next/dev.log 2>&1 &'
    },
    ...(hasOllama ? [{
        name: 'Ollama',
        check: 'curl -s --max-time 3 http://localhost:11434',
        restartCmd: 'pgrep -f "ollama serve" >/dev/null || nohup ollama serve > /tmp/ollama.log 2>&1 &'
    }] : []),
    {
        name: 'PostgreSQL',
        check: 'PGPASSWORD=AlfredDB2026Secure psql -h localhost -U alfred -d postgres -c "SELECT 1" 2>&1',
        restartCmd: 'sudo systemctl restart postgresql 2>/dev/null || echo "Restart attempted"'
    },
    {
        name: 'OpenClaw Gateway',
        check: 'openclaw gateway status 2>&1',
        restartCmd: 'openclaw gateway start 2>/dev/null || true'
    }
];

// Colors for console
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[36m';
const RESET = '\x1b[0m';

function log(color, msg) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}`;
    console.log(`${color}${line}${RESET}`);
    fs.appendFileSync(LOG_FILE, line + '\n');
}

function loadState() {
    if (fs.existsSync(STATE_FILE)) {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
    return { alerts: [], restarts: [], lastCheck: null };
}

function saveState(state) {
    state.lastCheck = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function checkService(service) {
    try {
        const output = execSync(service.check, { encoding: 'utf8', timeout: 5000, stdio: 'pipe' });
        // If command returns output (and doesn't throw), service is up
        return output && output.length > 0;
    } catch (e) {
        return false;
    }
}

function restartService(service) {
    log(RED, `🔧 Restarting ${service.name}...`);
    try {
        execSync(service.restartCmd, { encoding: 'utf8', timeout: 30000 });
        log(GREEN, `✅ ${service.name} restart command executed`);
        return true;
    } catch (e) {
        log(RED, `❌ Failed to restart ${service.name}: ${e.message.split('\n')[0]}`);
        return false;
    }
}

function queueTelegramAlert(message) {
    const queueFile = path.join(WORKSPACE, '.alert-queue.json');
    let queue = [];
    if (fs.existsSync(queueFile)) {
        queue = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
    }
    queue.push({
        channel: 'telegram',
        target: TELEGRAM_CHAT_ID,
        message: message,
        timestamp: new Date().toISOString()
    });
    fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));
    log(GREEN, `✅ Alert queued`);
}

async function monitorAndHeal() {
    log(BLUE, '🏥 Starting self-healing health check...');
    
    const state = loadState();
    let issues = [];
    
    for (const service of SERVICES) {
        const isUp = checkService(service);
        
        if (!isUp) {
            log(RED, `❌ ${service.name} is DOWN`);
            issues.push(service);
            
            const restarted = restartService(service);
            await new Promise(resolve => setTimeout(resolve, 10000));
            const stillDown = !checkService(service);
            
            if (stillDown) {
                log(RED, `⚠️ ${service.name} still down`);
                state.restarts.push({ service: service.name, timestamp: new Date().toISOString(), success: false });
                queueTelegramAlert(`⚠️ ${service.name} down - auto-restart failed`);
            } else {
                log(GREEN, `✅ ${service.name} recovered`);
                state.restarts.push({ service: service.name, timestamp: new Date().toISOString(), success: true });
                queueTelegramAlert(`✅ ${service.name} recovered after auto-restart`);
            }
        } else {
            log(GREEN, `✅ ${service.name} healthy`);
        }
    }
    
    if (issues.length === 0) {
        log(GREEN, '🏥 All services healthy');
    } else {
        log(RED, `🏥 ${issues.length} service(s) need attention`);
    }
    
    state.alerts = state.alerts.slice(-50);
    state.restarts = state.restarts.slice(-50);
    saveState(state);
    
    return issues.length === 0;
}

async function main() {
    try {
        const allHealthy = await monitorAndHeal();
        process.exit(allHealthy ? 0 : 1);
    } catch (e) {
        log(RED, `Fatal: ${e.message}`);
        process.exit(1);
    }
}

main();
