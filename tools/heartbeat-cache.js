#!/usr/bin/env node
/**
 * Heartbeat Cache Layer
 * 
 * Reduces token burn and execution time by:
 * - Caching PostgreSQL query results with TTL
 * - Skipping redundant checks when state hasn't changed
 * - Batching expensive API calls (email/calendar/weather)
 * - Persisting cache state between heartbeats
 * 
 * Target: 40% reduction in token burn and execution time
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = '/home/kevin/.openclaw/workspace';
const CACHE_PATH = path.join(WORKSPACE, 'heartbeat-cache.json');

// Cache TTL configuration (in minutes)
const CACHE_TTL = {
    // PostgreSQL queries - these don't change frequently
    pg_subagent_status: 5,      // Subagent status changes infrequently
    pg_tasks_in_progress: 3,    // Task updates happen during work
    pg_idle_agents: 5,          // Agent availability
    pg_task_backlog: 10,        // Backlog rarely urgent
    pg_stuck_tasks: 30,         // 6-hour threshold, check every 30 min
    
    // Expensive API calls - batch these
    email_unread: 15,           // Email doesn't need real-time
    calendar_events: 30,        // Calendar changes slowly  
    weather: 60,                // Weather updates hourly
    
    // System health - can cache briefly
    system_health: 2,         // System health check
    mission_control: 5,         // MC status
    
    // Briefing/data
    briefing_queue: 1,          // Briefings processed quickly
};

// Cost weight for each check (relative token/execution cost)
const CHECK_COST = {
    pg_subagent_status: 2,
    pg_tasks_in_progress: 3,
    pg_idle_agents: 2,
    pg_task_backlog: 2,
    email_unread: 8,
    calendar_events: 6,
    weather: 4,
    system_health: 3,
    mission_control: 4,
    briefing_queue: 1,
};

/**
 * Cache Manager Class
 */
class HeartbeatCache {
    constructor() {
        this.cache = this.loadCache();
        // Restore stats from persisted cache, or reset if new cycle
        if (this.cache._savedStats) {
            this.stats = this.cache._savedStats;
            delete this.cache._savedStats;
        } else {
            this.stats = {
                hits: 0,
                misses: 0,
                skips: 0,
                batched: 0,
                savedCost: 0,
                cycleStart: new Date().toISOString(),
            };
        }
    }

    /**
     * Load cache from disk
     */
    loadCache() {
        try {
            if (fs.existsSync(CACHE_PATH)) {
                const data = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
                // Support both old format ({entries:{}, metadata:{}}) and new format (with stats)
                if (data.entries) {
                    // Extract stats if present (new format)
                    const stats = data.stats || null;
                    const cache = { entries: data.entries, metadata: data.metadata || { created: new Date().toISOString(), version: '1.0' } };
                    // Stash stats temporarily for constructor
                    cache._savedStats = stats;
                    return cache;
                }
            }
        } catch (e) {
            console.error('Cache load error:', e.message);
        }
        return {
            entries: {},
            metadata: {
                created: new Date().toISOString(),
                version: '1.0',
            }
        };
    }

    /**
     * Save cache to disk (including stats)
     */
    saveCache() {
        try {
            const data = {
                ...this.cache,
                stats: this.stats,
            };
            fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error('Cache save error:', e.message);
        }
    }

    /**
     * Reset stats for a new heartbeat cycle
     */
    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            skips: 0,
            batched: 0,
            savedCost: 0,
            cycleStart: new Date().toISOString(),
        };
    }

    /**
     * Check if a cached entry is still valid
     */
    isValid(key) {
        const entry = this.cache.entries[key];
        if (!entry) return false;
        
        const ttlMinutes = CACHE_TTL[key] || 5;
        const ttlMs = ttlMinutes * 60 * 1000;
        const age = Date.now() - new Date(entry.timestamp).getTime();
        
        return age < ttlMs;
    }

    /**
     * Get cached data if valid
     */
    get(key) {
        if (this.isValid(key)) {
            this.stats.hits++;
            this.stats.savedCost += (CHECK_COST[key] || 1);
            return this.cache.entries[key].data;
        }
        this.stats.misses++;
        return null;
    }

    /**
     * Store data in cache
     */
    set(key, data, changeHash = null) {
        // Check if data actually changed (using hash comparison)
        const existing = this.cache.entries[key];
        const newHash = changeHash || this.computeHash(data);
        
        if (existing && existing.hash === newHash) {
            // Data unchanged, just update timestamp to extend TTL
            existing.timestamp = new Date().toISOString();
            this.stats.skips++;
            this.stats.savedCost += (CHECK_COST[key] || 1);
            return false; // Indicates no change
        }
        
        this.cache.entries[key] = {
            data,
            hash: newHash,
            timestamp: new Date().toISOString(),
        };
        
        return true; // Indicates new data stored
    }

    /**
     * Compute a simple hash for change detection
     */
    computeHash(data) {
        if (data === null || data === undefined) return 'null';
        if (typeof data === 'string') return `str:${data.length}:${data.slice(0, 50)}`;
        if (typeof data === 'number') return `num:${data}`;
        if (typeof data === 'boolean') return `bool:${data}`;
        if (Array.isArray(data)) return `arr:${data.length}:${this.computeHash(data.slice(0, 5))}`;
        if (typeof data === 'object') {
            const keys = Object.keys(data).sort().join(',');
            return `obj:${keys}`;
        }
        return `val:${String(data).slice(0, 50)}`;
    }

    /**
     * Invalidate specific keys or patterns
     */
    invalidate(keyPattern) {
        const keys = Object.keys(this.cache.entries);
        let count = 0;
        
        for (const key of keys) {
            if (key.includes(keyPattern) || key === keyPattern) {
                delete this.cache.entries[key];
                count++;
            }
        }
        
        return count;
    }

    /**
     * Get batch of API calls that are due (respecting TTL)
     * Returns array of {key, due: boolean, canBatch: boolean}
     */
    getBatchableCalls() {
        const now = Date.now();
        const batchable = [];
        
        // Group API calls for batching
        const apiCalls = ['email_unread', 'calendar_events', 'weather'];
        
        for (const key of apiCalls) {
            const entry = this.cache.entries[key];
            const ttlMinutes = CACHE_TTL[key] || 15;
            const ttlMs = ttlMinutes * 60 * 1000;
            
            const due = !entry || (now - new Date(entry.timestamp).getTime()) >= ttlMs;
            
            batchable.push({
                key,
                due,
                canBatch: true,
                cost: CHECK_COST[key] || 1,
            });
        }
        
        return batchable;
    }

    /**
     * Check if we should skip expensive calls this heartbeat
     * Implements staggered checking to distribute load
     */
    shouldSkipExpensive(checkKey, heartbeatCount) {
        const entry = this.cache.entries[checkKey];
        if (!entry) return false; // No cache, must run
        
        const ttlMinutes = CACHE_TTL[checkKey] || 15;
        const ttlMs = ttlMinutes * 60 * 1000;
        const age = Date.now() - new Date(entry.timestamp).getTime();
        
        if (age < ttlMs) {
            // Still within TTL, skip check
            return true;
        }
        
        // Stagger expensive checks based on heartbeat count
        // Spread load across heartbeats
        const staggeredKeys = ['email_unread', 'calendar_events', 'weather'];
        if (staggeredKeys.includes(checkKey)) {
            const index = staggeredKeys.indexOf(checkKey);
            // Run this check only every Nth heartbeat where N = stagger index + 1
            if (heartbeatCount % (index + 2) !== 0) {
                return true; // Skip this heartbeat, run on next
            }
        }
        
        return false;
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const entryCount = Object.keys(this.cache.entries).length;
        const totalCost = Object.values(CHECK_COST).reduce((a, b) => a + b, 0);
        const avoidedCost = this.stats.savedCost;
        const savingsPercent = this.stats.hits > 0 
            ? Math.round((avoidedCost / (avoidedCost + totalCost)) * 100) 
            : 0;
        
        return {
            ...this.stats,
            entryCount,
            totalCost,
            avoidedCost,
            savingsPercent,
        };
    }

    /**
     * Get cache status summary for logging
     */
    getStatusSummary() {
        const stats = this.getStats();
        const entries = Object.entries(this.cache.entries).map(([k, v]) => {
            const age = Math.round((Date.now() - new Date(v.timestamp).getTime()) / 1000);
            const ttl = (CACHE_TTL[k] || 5) * 60;
            return { key: k, age: `${age}s`, ttl: `${ttl}s`, valid: age < ttl };
        });
        
        return { stats, entries };
    }

    /**
     * Cleanup expired entries
     */
    cleanup() {
        const keys = Object.keys(this.cache.entries);
        let removed = 0;
        
        for (const key of keys) {
            const ttlMinutes = CACHE_TTL[key] || 60; // Default 1 hour cleanup
            const ttlMs = ttlMinutes * 60 * 1000 * 2; // 2x TTL for cleanup
            const age = Date.now() - new Date(this.cache.entries[key].timestamp).getTime();
            
            if (age > ttlMs) {
                delete this.cache.entries[key];
                removed++;
            }
        }
        
        return removed;
    }

    /**
     * Reset cache (for testing/debugging)
     */
    reset() {
        this.cache = {
            entries: {},
            metadata: {
                created: new Date().toISOString(),
                version: '1.0',
            }
        };
        this.resetStats();
        this.saveCache();
    }

    /**
     * Warm cache with critical keys (called on session start)
     * Pre-populates fast-to-fetch data to avoid cold cache on first heartbeat
     */
    async warm(keys = null) {
        // Simplified: just log which keys will be warmed, don't store placeholder
        // Actual data will be populated by first heartbeat run
        const warmKeys = keys || ['pg_subagent_status', 'system_health', 'mission_control'];
        console.log(`[cache] Will warm ${warmKeys.length} keys on first heartbeat`);
        return warmKeys;
    }
}

// Singleton instance
let cacheInstance = null;

function getCache() {
    if (!cacheInstance) {
        cacheInstance = new HeartbeatCache();
    }
    return cacheInstance;
}

module.exports = {
    HeartbeatCache,
    getCache,
    CACHE_TTL,
    CHECK_COST,
    CACHE_PATH,
};