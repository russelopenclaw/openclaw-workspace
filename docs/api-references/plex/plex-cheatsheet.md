# Plex API Cheatsheet

## Authentication

| Method | How | Scope |
|--------|-----|-------|
| **Server token** | Read from Preferences.xml or registry | Full admin access |
| **Device token** | Web UI → View XML → URL parameter | Per-device |
| **User token** | Browser DevTools → Network tab → X-Plex-Token | Per-user |
| **API sign-in** | POST https://plex.tv/users/sign_in.json | Full account |
| **Transient** | GET /security/token | 48h, same as source |

**Get server token (Linux):**
```bash
cat "/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Preferences.xml" | grep -oP 'PlexOnlineToken="[^"]+"' | sed 's/PlexOnlineToken="//;s/"//'
```

## Required Headers

```
X-Plex-Token: {token}           # Required for ALL requests
Accept: application/json         # Optional — returns JSON instead of XML
```

## Endpoint Quick Reference

### Server Info

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Server capabilities |
| GET | `/identity` | Server identity/version |
| GET | `/status/sessions` | Active play sessions |
| GET | `/:/prefs` | All preferences |
| PUT | `/:/prefs?{key}={val}` | Set preference |
| GET | `/accounts` | All accounts |
| GET | `/devices` | All devices |

### Library Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/library/sections/` | List all libraries |
| GET | `/library/sections/{id}/all` | All items in library |
| GET | `/library/metadata/{key}` | Item metadata |
| GET | `/library/metadata/{key}/children` | Children (seasons/episodes) |
| GET | `/library/onDeck` | Continue watching |
| GET | `/library/recentlyAdded` | Recently added |
| POST | `/library/sections/{id}/refresh` | Scan library |
| PUT | `/library/metadata/{key}/refresh` | Refresh item metadata |
| PUT | `/library/sections/{id}/emptyTrash` | Empty trash |
| PUT | `/library/clean/bundles` | Clean bundles |
| PUT | `/library/optimize` | Optimize database |

### Playback

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/status/sessions` | Active sessions |
| GET | `/player/playback/play` | Play/resume |
| GET | `/player/playback/pause` | Pause |
| GET | `/player/playback/stop` | Stop |
| GET | `/player/playback/seekTo?offset={ms}` | Seek |
| GET | `/:/timeline?...` | Report progress |

### Search & Media

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/hubs/search?query={q}` | Global search |
| GET | `/library/metadata/{key}/thumb` | Thumbnail image |
| GET | `/library/metadata/{key}/art` | Background art |

### Plex.tv Cloud

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `https://plex.tv/api/v2/resources` | All servers |
| GET | `https://plex.tv/api/v2/friends` | Shared users |
| GET | `https://plex.tv/api/v2/user` | Account info |
| GET | `https://plex.tv/api/v2/server/access_tokens` | All tokens |

## Common Filter Operators

Filters on `/library/sections/{id}/all`:
- `title=Movie` — partial match, case-insensitive
- `year=2024` or `year>=2020`
- `rating>=8`
- `addedAt>=1700000000` (epoch)
- `contentRating=PG-13` (case-sensitive)
- `viewCount>=1`

## JSON Mode

Add `Accept: application/json` header. Response wraps in `MediaContainer` object:
```json
{
  "MediaContainer": {
    "size": 1,
    "Directory": [...]
  }
}
```