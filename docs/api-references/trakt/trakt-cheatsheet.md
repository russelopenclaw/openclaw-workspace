# Trakt.tv API Cheatsheet

## Authentication

| Method | Flow | Use Case |
|--------|------|----------|
| **OAuth2 Code** | 3-legged | Web apps, server-side |
| **Device Auth** | Code + polling | CLI, smart TVs, headless |

**Key URLs:**
- Authorize: `https://trakt.tv/oauth/authorize`
- Token exchange: `POST https://api.trakt.tv/oauth/token`
- Device code: `POST https://api.trakt.tv/oauth/device/code`
- Device token: `POST https://api.trakt.tv/oauth/device/token`
- Revoke: `POST https://api.trakt.tv/oauth/revoke`

**Token lifetime:** 90 days (`expires_in: 7776000`)

## Required Headers

```
Content-Type: application/json
trakt-api-version: 2
trakt-api-key: {client_id}
Authorization: Bearer {access_token}    # For authenticated endpoints
```

## Rate Limits

| Type | Limit |
|------|-------|
| Authenticated | 1000 req / 5 min |
| Unauthenticated | 100 req / 5 min |

Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Pagination

| Param | Default | Description |
|-------|---------|-------------|
| `page` | 1 | Page number |
| `limit` | 10 | Items per page (max 1000) |

Headers: `X-Pagination-Page`, `X-Pagination-Limit`, `X-Pagination-Page-Count`, `X-Pagination-Item-Count`

## Extended Info

| Value | Returns |
|-------|---------|
| (default) | Basic: title, year, IDs |
| `full` | + overview, runtime, rating, votes |
| `metadata` | + certification, country, language |
| `full,metadata` | Everything |

## Endpoint Quick Reference

### Search & Discovery

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/search/query?query={q}&type={type}` | No | Text search |
| GET | `/search/id/{id_type}?id={id}` | No | ID lookup (imdb, tmdb, tvdb, slug) |
| GET | `/shows/trending` | No | Trending shows |
| GET | `/shows/popular` | No | Popular shows |
| GET | `/movies/trending` | No | Trending movies |
| GET | `/movies/popular` | No | Popular movies |
| GET | `/movies/box_office` | No | Top 10 box office |

### Media Data

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/shows/{id}` | No | Show summary |
| GET | `/shows/{id}/seasons` | No | All seasons |
| GET | `/shows/{id}/seasons/{s}/episodes/{e}` | No | Episode detail |
| GET | `/movies/{id}` | No | Movie summary |
| GET | `/people/{id}` | No | Person detail |
| GET | `/genres/movies` | No | Movie genres |
| GET | `/genres/shows` | No | Show genres |

### Sync (Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/sync/history` | Mark as watched |
| DELETE | `/sync/history/remove` | Remove from history |
| GET | `/sync/history/{type}` | Get watch history |
| POST | `/sync/collection` | Add to collection |
| GET | `/sync/collection/{type}` | Get collection |
| POST | `/sync/ratings` | Add ratings (1-10) |
| GET | `/sync/ratings/{type}/{rating}` | Get ratings |
| POST | `/sync/watchlist` | Add to watchlist |
| GET | `/sync/watchlist/{type}/{sort}` | Get watchlist |
| GET | `/sync/last_activities` | Last activity timestamps |
| GET | `/sync/playback/{type}` | Paused playback progress |

### Users (Auth Required for most)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/settings` | Authenticated user profile |
| GET | `/users/{id}` | User profile |
| GET | `/users/{id}/watched/{type}` | All watched (bulk) |
| GET | `/users/{id}/history/{type}` | Watch history |
| GET | `/users/{id}/stats` | User stats |
| GET | `/users/{id}/watching` | Currently watching |
| GET | `/users/{id}/watchlist/{type}` | Watchlist |
| GET | `/users/{id}/collection/{type}` | Collection |
| GET | `/users/{id}/ratings/{type}` | Ratings |
| POST | `/users/{id}/lists` | Create list |
| GET | `/users/{id}/lists/{lid}/items` | List items |

### Calendars (Auth Required for /my/)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/calendars/my/shows` | Yes | My shows schedule |
| GET | `/calendars/my/movies` | Yes | My movies schedule |
| GET | `/calendars/all/shows` | No | All shows schedule |
| GET | `/calendars/all/movies` | No | All movies schedule |

### Social

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/checkin` | Yes | Check in |
| POST | `/comments` | Yes | Post comment/review |
| GET | `/comments/{id}` | No | Get comment |
| POST | `/comments/{id}/like` | Yes | Like comment |
| GET | `/lists/trending` | No | Trending lists |
| GET | `/recommendations/movies` | Yes | Personal recs |

## Common ID Types

| Type | Format | Example |
|------|--------|---------|
| `trakt` | Numeric | `1390` |
| `slug` | URL slug | `breaking-bad` |
| `imdb` | IMDB ID | `tt0903747` |
| `tmdb` | TMDB ID | `1396` |
| `tvdb` | TVDB ID | `81189` |

## Sync Body Format

```json
{
  "movies": [{"ids": {"imdb": "tt0000001"}, "watched_at": "now"}],
  "shows": [{"ids": {"slug": "breaking-bad"}}],
  "episodes": [{"ids": {"trakt": 12345}, "watched_at": "2024-01-15T20:00:00.000Z"}],
  "seasons": [{"ids": {"trakt": 3982}}]
}
```

Timestamps: ISO 8601 or `"now"`