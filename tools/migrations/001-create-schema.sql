-- PostgreSQL Schema for Mission Control
-- Migration 001: Initial schema setup
-- Created: 2026-03-05

-- Agents table (skip if exists)
CREATE TABLE IF NOT EXISTS agents (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('working', 'idle', 'offline')),
    current_task TEXT,
    last_activity TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks table with full history support (skip if exists)
CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    column_name VARCHAR(50) NOT NULL,  -- "column" is reserved, using column_name
    assignee VARCHAR(50),
    priority VARCHAR(20) DEFAULT 'medium',
    description TEXT,
    parent_task_id VARCHAR(50) REFERENCES tasks(id),
    linked_subagent VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task history (audit trail)
CREATE TABLE IF NOT EXISTS task_history (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(50) REFERENCES tasks(id) ON DELETE CASCADE,
    status VARCHAR(50),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    note TEXT
);

-- Subagents table (skip if exists)
CREATE TABLE IF NOT EXISTS subagents (
    run_id VARCHAR(100) PRIMARY KEY,
    label VARCHAR(200),
    task VARCHAR(500),
    status VARCHAR(20),
    runtime VARCHAR(20),
    total_tokens BIGINT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    note TEXT
);

-- Create indexes for performance (skip if exists)
CREATE INDEX IF NOT EXISTS idx_tasks_column ON tasks(column_name);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(column_name, priority);
CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON task_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_history_timestamp ON task_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_subagents_status ON subagents(status);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);

-- Grant permissions (redundant but safe)
GRANT ALL ON ALL TABLES IN SCHEMA public TO alfred;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO alfred;
