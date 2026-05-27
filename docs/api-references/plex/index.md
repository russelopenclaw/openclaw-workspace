# Plex Media Server API Reference

> **Source:** plexopedia.com + community documentation  
> **Server Base URL:** `http://{ip}:32400`  
> **Cloud Base URL:** `https://plex.tv`  
> **Default Format:** XML (add `Accept: application/json` for JSON)  
> **Auth:** X-Plex-Token (required for all requests)

## Table of Contents

1. [Getting Started & Auth](getting-started.md) - Token types, headers, JSON mode
2. [Server Endpoints](server.md) - Identity, sessions, capabilities, preferences
3. [Library Endpoints](library.md) - Sections, scan, refresh, clean, optimize
4. [Media Endpoints](media.md) - Movies, TV shows, music, photos, metadata
5. [Playback Control](playback.md) - Play, pause, seek, stop
6. [Playlists](playlists.md) - Create, manage playlists
7. [Plex.tv Cloud API](plextv.md) - Account, friends, opt-outs, discover together
8. [Plex Cheatsheet](plex-cheatsheet.md) - Quick reference

## Quick Reference

| Category | Key Endpoints |
|----------|--------------|
| Server | `/identity`, `/status/sessions`, `/library/sections`, `/accounts`, `/devices` |
| Library | `/library/sections/{id}/all`, `/library/sections/{id}/refresh`, `/library/sections/all/scan` |
| Media | `/library/metadata/{id}`, `/library/metadata/{id}/children`, `/library/metadata/{id}/thumb` |
| Playback | `/status/sessions`, via player API |
| Maintenance | `/library/sections/all/emptyTrash`, `/library/sections/all/optimize`, `/library/clean/bundles` |