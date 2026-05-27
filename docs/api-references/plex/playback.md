# Plex - Playback Control & Other Endpoints

## Playback Control

Playback commands are sent to a specific player/client, not the server directly.

### Get Active Sessions

```
GET /status/sessions?X-Plex-Token={token}
```

Each session includes a `Session.id` and `Player.machineIdentifier`.

### Control Playback

```
GET /player/playback/play?X-Plex-Token={token}&X-Plex-Client-Identifier={client_id}
```

Available commands:
- `/player/playback/play` — Play/resume
- `/player/playback/pause` — Pause
- `/player/playback/stop` — Stop
- `/player/playback/skipNext` — Next track/episode
- `/player/playback/skipPrevious` — Previous track/episode
- `/player/playback/seekTo?offset={ms}` — Seek to offset in milliseconds
- `/player/playback/stepForward` — Skip forward 30s
- `/player/playback/stepBack` — Skip back 30s

**Note:** These commands are sent to the client, not the server. The `X-Plex-Client-Identifier` must match the active player.

### Set Playback Progress

```
GET /:/timeline?X-Plex-Token={token}&ratingKey={key}&key=/library/metadata/{key}&state={state}&time={ms}&duration={ms}
```

States: `playing`, `paused`, `stopped`

## Thumbnails/Images

```
GET /library/metadata/{ratingKey}/thumb?X-Plex-Token={token}
GET /library/metadata/{ratingKey}/art?X-Plex-Token={token}
```

Returns image data. Optional parameters:
- `width` — Resize width
- `height` — Resize height
- `minSize` — 1 = don't upscale

## Playlists

### Get All Playlists

```
GET /playlists?X-Plex-Token={token}
```

### Get Playlist Items

```
GET /playlists/{id}/items?X-Plex-Token={token}
```

### Create Playlist

```
POST /playlists?X-Plex-Token={token}&title={name}&type={type}&smart={0|1}
```

For a regular playlist, add items:
```
PUT /playlists/{id}/items?X-Plex-Token={token}&uri=server://{machine_id}/com.plexapp.plugins.library/library/metadata/{ratingKey}
```

### Delete Playlist

```
DELETE /playlists/{id}?X-Plex-Token={token}
```

## Transcode Status

```
GET /transcode/sessions?X-Plex-Token={token}
```

Returns active transcode sessions.

### Cancel Transcode

```
DELETE /transcode/sessions/{session_key}?X-Plex-Token={token}
```

## Plex.tv Cloud API

### Server Resources

```
GET https://plex.tv/api/v2/resources?include_https=1&X-Plex-Token={token}
```

### Friends/Shared Users

```
GET https://plex.tv/api/v2/friends?X-Plex-Token={token}
```

### User Account

```
GET https://plex.tv/api/v2/user?X-Plex-Token={token}
```

### Watch State Sync Settings

```
POST https://community.plex.tv/api
```

GraphQL mutation for changing sync settings (see plextv-sync-state.md).

### Discover Together Settings

GraphQL mutation for privacy settings (see plextv-discover-together.md).

### Opt-Out Settings

GraphQL mutation for platform opt-outs (see plextv-opt-outs.md).