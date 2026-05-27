# Trakt.tv - Sync API

The Sync API is the core for tracking what you've watched, collected, and rated.

## Add to History (Mark as Watched)

```
POST /sync/history
```

```json
{
  "movies": [{"ids": {"imdb": "tt0000001"}, "watched_at": "2024-01-15T20:00:00.000Z"}],
  "episodes": [{"ids": {"trakt": 12345}, "watched_at": "2024-01-15T20:00:00.000Z"}]
}
```

`watched_at` can be ISO 8601 datetime or `"now"` for current time.

## Remove from History

```
DELETE /sync/history/remove
```

Same body format as add.

## Get History

```
GET /sync/history/{type}?start_at={date}&end_at={date}
```

| Type | Description |
|------|-------------|
| `movies` | Movie watch history |
| `episodes` | Episode watch history |
| `shows` | Show watch history (not recommended) |
| `seasons` | Season watch history |
| `all` | Both movies and episodes |

Query params: `start_at`, `end_at` (ISO 8601), `page`, `limit`

## Add to Collection

```
POST /sync/collection
```

```json
{
  "movies": [{"ids": {"imdb": "tt0000001"}, "collected_at": "2024-01-15"}],
  "episodes": [{"ids": {"trakt": 12345}, "collected_at": "2024-01-15"}]
}
```

## Remove from Collection

```
DELETE /sync/collection/remove
```

## Get Collection

```
GET /sync/collection/{type}
```

Types: `movies`, `shows` (returns all collected episodes)

## Add Ratings

```
POST /sync/ratings
```

```json
{
  "movies": [{"rating": 9, "ids": {"imdb": "tt0000001"}, "rated_at": "2024-01-15"}],
  "episodes": [{"rating": 8, "ids": {"trakt": 12345}, "rated_at": "2024-01-15"}],
  "shows": [{"rating": 9, "ids": {"slug": "breaking-bad"}, "rated_at": "2024-01-15"}],
  "seasons": [{"rating": 8, "ids": {"trakt": 12345}, "rated_at": "2024-01-15"}]
}
```

Rating scale: 1-10

## Remove Ratings

```
DELETE /sync/ratings/remove
```

## Get Ratings

```
GET /sync/ratings/{type}/{rating}
```

- `type`: `movies`, `shows`, `seasons`, `episodes`, `all`
- `rating`: 1-10 (optional filter)

## Add to Watchlist

```
POST /sync/watchlist
```

```json
{
  "movies": [{"ids": {"imdb": "tt0000001"}}],
  "shows": [{"ids": {"slug": "breaking-bad"}}],
  "seasons": [{"ids": {"trakt": 12345}}],
  "episodes": [{"ids": {"trakt": 12345}}]
}
```

## Remove from Watchlist

```
DELETE /sync/watchlist/remove
```

## Get Watchlist

```
GET /sync/watchlist/{type}/{sort}
```

- `type`: `movies`, `shows`, `seasons`, `episodes`, `all`
- `sort`: `rank`, `added`, `title`, `released`, `runtime`, `popularity`, `percentage`, `votes` (default: `rank`)

## Playback Progress

Get paused progress for resumed watching:

```
GET /sync/playback/{type}
```

Types: `movies`, `episodes`

Response includes `progress` (0-100 percentage) and `paused_at` timestamp.

## Last Activities

Get timestamps of last activity for each section (useful for incremental sync):

```
GET /sync/last_activities
```

Response:
```json
{
  "all": "2024-01-15T20:00:00.000Z",
  "movies": {
    "watched_at": "...",
    "collected_at": "...",
    "rated_at": "...",
    "watchlisted_at": "...",
    "commented_at": "...",
    "paused_at": "...",
    "hidden_at": "..."
  },
  "episodes": { ... },
  "shows": { ... },
  "seasons": { ... }
}
```