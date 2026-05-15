# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

### Google Sheets

- **Dadabase**: 1cXSGjCXleUK8iQweBAwLaa7j3QK2Sla-8v11CirQsuw
  - Columns: Joke ID, Joke, Used, Posted
  - Service: gog (russelopenclaw@gmail.com)

### Google Calendar (gog)

- Requires: `GOG_KEYRING_BACKEND=file` and `GOG_KEYRING_PASSWORD`
- Response: `{events: []}` wrapper, `summary` (not `title`)
→ See `docs/reference/gog-calendar.md`

### Plex Media Server

- **Host:** server:32400, Token: z7Bh1q4cqgmNEzfF6EFW
- **15 libraries, 30 users, 9 active**
→ See `docs/reference/plex-server.md`

### MinIO (hp1)

- Web UI: http://hp1:9001
- S3 API: http://hp1:9000
- Access Key: admin
- Secret Key: password123

### GitHub

- Token: saved in openclaw.json (env.GITHUB_TOKEN)
- Account: russelopenclaw (for code push)

### Dad Joke Video Pipeline

→ See `docs/reference/dad-joke-pipeline-tools.md`

### Subagent Monitoring

- **Monitor**: `node tools/start-health-monitor.js`
- **Stop**: `node tools/stop-health-monitor.js`
- **Logs**: `.learnings/SUBAGENT-HEALTH.log`
- **Registry**: `.learnings/SUBAGENT-REGISTRY.json`
- **Respawn Queue**: `.learnings/SUBAGENT-RESPAWN-QUEUE.json`
- **Docs**: `tools/SUBAGENT-MONITORING.md`

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.
