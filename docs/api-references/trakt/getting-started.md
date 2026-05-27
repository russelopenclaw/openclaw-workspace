# Trakt.tv - Getting Started

## Base URL

```
https://api.trakt.tv
```

## Required Headers

Every request MUST include:

| Header | Value | Notes |
|--------|-------|-------|
| `Content-Type` | `application/json` | Required for all requests |
| `trakt-api-version` | `2` | API version |
| `trakt-api-key` | `{client_id}` | Your Trakt app's client ID |

For authenticated requests, also include:

| Header | Value | Notes |
|--------|-------|-------|
| `Authorization` | `Bearer {access_token}` | OAuth2 access token |

## Rate Limiting

- **Authenticated requests:** 1000 requests per 5 minutes (burst allowed)
- **Unauthenticated requests:** 100 requests per 5 minutes
- Rate limit headers returned in response:
  - `X-RateLimit-Limit` - Total allowed
  - `X-RateLimit-Remaining` - Remaining in window
  - `X-RateLimit-Reset` - Unix timestamp when window resets
- HTTP 429 returned when rate limit exceeded

## Pagination

Most list endpoints support pagination:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `page` | 1 | Page number |
| `limit` | 10 | Items per page (max 1000 for most endpoints) |

Pagination headers in response:
- `X-Pagination-Page` - Current page
- `X-Pagination-Limit` - Items per page
- `X-Pagination-Page-Count` - Total pages
- `X-Pagination-Item-Count` - Total items

## Response Format

All responses are JSON. Common response codes:

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created (POST) |
| 204 | Success, no content (DELETE) |
| 400 | Bad Request - invalid parameters |
| 401 | Unauthorized - missing/invalid token |
| 403 | Forbidden - insufficient permissions |
| 404 | Not Found |
| 409 | Conflict - already exists |
| 422 | Unprocessable Entity |
| 429 | Rate Limited |
| 500 | Server Error |

## Extended Info

Most endpoints accept `?extended=full` or `?extended=metadata` to return additional data:

- **Default:** Basic info only (title, year, IDs)
- **`full`:** Adds overview, runtime, rating, votes, etc.
- **`metadata`:** Adds metadata like certification, country, language
- **`full,metadata`:** Both combined

## Images

Trakt does NOT host images. Use the `ids` field to fetch images from:
- **TMDB:** `https://image.tmdb.org/t/p/{size}/{tmdb_id}`
- **TVDB:** Via TVDB API using `tvdb` ID
- **IMDB:** Via third-party services using `imdb` ID

## Common ID Types

| Type | Description |
|------|-------------|
| `trakt` | Trakt's internal numeric ID |
| `slug` | URL-friendly slug (e.g., `breaking-bad`) |
| `imdb` | IMDB ID (e.g., `tt0903747`) |
| `tmdb` | The Movie Database ID |
| `tvdb` | The TVDB ID |
| `tvrage` | TVRage ID (deprecated) |

## Timestamps

All timestamps are UTC in ISO 8601 format: `2014-09-01T09:10:11.000Z`

## App Registration

1. Go to https://trakt.tv/oauth/applications
2. Create a new application
3. Get `client_id` and `client_secret`
4. Configure redirect URI for OAuth flow