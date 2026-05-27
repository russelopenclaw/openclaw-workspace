# System Architecture

**Last Updated**: 2026-03-05  
**Maintained By**: Alfred

## Overview

Alfred is an autonomous agent system built on OpenClaw with automated deployment, monitoring, and task orchestration capabilities.

## Core Components

### 1. Gateway
- **Port**: 18789
- **Purpose**: Central API gateway for agent communication
- **Endpoints**: `/status`, `/health`, `/sessions`, `/tools`
- **Tech**: Node.js HTTP server

### 2. Mission Control (PostgreSQL)
- **Database**: `mission_control`
- **Tables**: `agents`, `tasks`, `subagents`, `cron_jobs`
- **Purpose**: Task orchestration and agent state management
- **Location**: Local PostgreSQL server

### 3. Ollama Integration
- **Host**: 192.168.1.33:11434
- **Models**: qwen3.5:cloud (primary), nomic-embed-text:latest (embeddings)
- **Purpose**: Local LLM inference

### 4. Mission Control Dashboard
- **Port**: 8765
- **Tech**: React/web components
- **Purpose**: UI for monitoring and task management

### 5. Subagent Health Monitor
- **Script**: `tools/start-health-monitor.js`
- **Purpose**: Monitors subagent lifecycle and respawns as needed
- **Logs**: `.learnings/SUBAGENT-HEALTH.log`

### 6. Deployment Pipeline
- **Script**: `tools/deployment-pipeline.js`
- **Wrapper**: `scripts/deploy.sh`
- **Purpose**: Automated CI/CD-style deployment testing
- **Phases**: Pre-deployment checks → Deploy → Post-deployment smoke tests → Rollback (if needed)
- **Reports**: `.learnings/deployment-reports/`

## Data Flow

```
User Request → Gateway → Task Creation → Alfred (Main Agent)
                                              ↓
                                    Spawn Subagents
                                              ↓
                                    Execute Tasks
                                              ↓
                                    Update Database
                                              ↓
                                    Report Completion
```

## Deployment Workflow

1. Pre-deployment checks (automated)
2. Git pull and install dependencies
3. Run database migrations
4. Build Mission Control
5. Restart services
6. Post-deployment smoke tests
7. Generate deployment report

## File Structure

```
/workspace/
├── tools/
│   ├── deployment-pipeline.js      # Automated deployment
│   ├── validate-deployment.js      # Pre-deployment validation
│   ├── agent-status-updater.js     # PostgreSQL status updates
│   ├── mem0-session-hook.js        # Memory integration
│   └── migrations/                 # Database migrations
├── scripts/
│   └── deploy.sh                   # Deployment wrapper
├── docs/
│   ├── DEPLOYMENT-PIPELINE.md      # Deployment documentation
│   ├── DEPLOYMENT-QUICKSTART.md    # Quick reference
│   ├── PRE-DEPLOYMENT-CHECKLIST.md # Manual checklist
│   ├── OPERATIONAL-RUNBOOK.md      # Operations guide
│   └── SYSTEM-ARCHITECTURE.md      # This file
├── .learnings/
│   ├── deployment-reports/         # Generated reports
│   ├── ERRORS.md                   # Known errors
│   └── LEARNINGS.md                # Process improvements
├── backups/
│   └── db-backup-*.sql             # Database backups
└── .github/workflows/
    └── deployment-pipeline.yml     # CI/CD workflow
```

## Services

| Service | Type | Status Check |
|---------|------|--------------|
| alfred-hub | Systemd user | `systemctl --user is-active alfred-hub` |
| subagent-health-monitor | Systemd user | `systemctl --user is-active subagent-health-monitor` |
| PostgreSQL | System service | `pg_isready` |
| Ollama | Remote service | `curl http://192.168.1.33:11434/api/tags` |
| Gateway | HTTP | `curl http://localhost:18789/status` |
| Mission Control | HTTP | `curl http://localhost:8765/` |

## Security

- Database credentials stored in config (not committed)
- Gateway requires token authentication
- Exec command approvals (allowlist/deny)
- Private data not exfiltrated
- `trash` > `rm` for sensitive files

## Monitoring

- Health monitoring via heartbeat system
- Subagent health tracking
- Error logging to `.learnings/ERRORS.md`
- Deployment reports with pass/fail status
- Performance metrics (response times, memory, disk)

## Related Documentation

- [DEPLOYMENT-PIPELINE.md](DEPLOYMENT-PIPELINE.md) - Deployment automation
- [OPERATIONAL-RUNBOOK.md](OPERATIONAL-RUNBOOK.md) - Day-to-day operations
- [PRE-DEPLOYMENT-CHECKLIST.md](PRE-DEPLOYMENT-CHECKLIST.md) - Manual checklist
