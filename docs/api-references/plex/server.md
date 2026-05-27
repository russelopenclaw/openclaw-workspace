# Plex - Server Endpoints

## Server Identity

```
GET /identity?X-Plex-Token={token}
```

Returns basic server info: machine identifier, version, etc.

## Server Capabilities

```
GET /?X-Plex-Token={token}
```

Returns server capabilities, friendly name, version, platform, etc.

## Server Preferences

### Get All Preferences

```
GET /:/prefs?X-Plex-Token={token}
```

Returns all server preferences as key-value pairs in XML/JSON.

### Set a Preference

```
PUT /:/prefs?X-Plex-Token={token}&{pref_name}={value}
```

Example:
```bash
curl -X PUT "http://{ip}:32400/:/prefs?X-Plex-Token={token}&FriendlyName=MyServer"
```

## Active Sessions

```
GET /status/sessions?X-Plex-Token={token}
```

Returns all currently playing sessions with:
- Media metadata (title, year, duration)
- User info
- Player info (device, platform, state)
- Transcode session info (if transcoding)
- Stream details (codec, bitrate, resolution)

**Key elements:** `Video`, `Track`, `User`, `Player`, `TranscodeSession`

**Player state values:** `playing`, `paused`, `buffering`

## Get Libraries (Sections)

```
GET /library/sections/?X-Plex-Token={token}
```

Returns all libraries with:
- `key` — Library ID (used in other endpoints)
- `type` — `movie`, `show`, `artist`, `photo`
- `title` — Library name
- `agent` — Metadata agent (e.g., `com.plexapp.agents.imdb`)
- `scanner` — Scanner name
- `Location` elements — File paths

## Get Accounts

```
GET /accounts?X-Plex-Token={token}
```

Returns all accounts with access to the server.

## Get Devices

```
GET /devices?X-Plex-Token={token}
```

Returns historical device information (not just active).

## Download Databases

```
GET /diagnostics/databases?X-Plex-Token={token}
```

Downloads server databases as a ZIP file.

## Download Logs

```
GET /diagnostics/logs?X-Plex-Token={token}
```

Downloads server log files as a ZIP file.

## Transient Token

```
GET /security/token?X-Plex-Token={token}
```

Generates a temporary token (48-hour lifetime) with same permissions as the source token.

## Server List (from plex.tv)

```
GET https://plex.tv/api/v2/resources?include_https=1&X-Plex-Token={token}
```

Returns all servers associated with the account, including connection URLs.