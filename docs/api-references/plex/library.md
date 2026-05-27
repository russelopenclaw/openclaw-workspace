# Plex - Library Endpoints

## Get All Items in a Library

### Movies
```
GET /library/sections/{id}/all?X-Plex-Token={token}
```

### TV Shows
```
GET /library/sections/{id}/all?X-Plex-Token={token}
```

The `{id}` is the library key from the `/library/sections/` endpoint.

### Parameters

| Parameter | Description |
|-----------|-------------|
| `X-Plex-Token` | Auth token (required) |
| `includeGuids` | 1 = include external GUIDs (IMDB, TMDB, etc.) |
| `limit` | Max items to return |
| `title` | Filter by title (partial match, case-insensitive) |
| `year` | Filter by year (=, <=, >=) |
| `rating` | Filter by rating (=, <=, >=) |
| `contentRating` | Filter by content rating |
| `studio` | Filter by studio (partial match) |
| `addedAt` | Filter by added date (epoch time, =, <=, >=) |
| `viewCount` | Filter by view count (=, <=, >=) |
| `lastViewedAt` | Filter by last viewed date (epoch) |
| `originallyAvailableAt` | Filter by release date |
| `duration` | Filter by duration in ms (=, <=, >=) |
| `file` | Filter by filename (partial match) |

### Response Structure

Movies return `Video` elements, TV shows return `Directory` elements.

Each `Video` element contains:
- `ratingKey` — Unique ID for the item
- `title`, `year`, `summary`, `rating`
- `duration` — In milliseconds
- `Media` child — File details (codec, resolution, bitrate)
- `Part` child — File path, size, container
- `Genre`, `Director`, `Writer`, `Country`, `Collection`, `Role` children

## Get Item Metadata

```
GET /library/metadata/{ratingKey}?X-Plex-Token={token}
```

Returns detailed metadata for a specific item.

## Get Item Children (Seasons/Episodes)

```
GET /library/metadata/{ratingKey}/children?X-Plex-Token={token}
```

For a show → returns seasons. For a season → returns episodes.

## Get Recently Added

```
GET /library/recentlyAdded?X-Plex-Token={token}
```

Or per-library:
```
GET /library/sections/{id}/recentlyAdded?X-Plex-Token={token}
```

## Scan All Libraries

```
POST /library/sections/all/refresh?X-Plex-Token={token}
```

## Scan a Single Library

```
POST /library/sections/{id}/refresh?X-Plex-Token={token}
```

## Refresh Metadata for a Library

```
PUT /library/sections/{id}/refresh?X-Plex-Token={token}
```

This refreshes metadata (not just file scan).

## Refresh Metadata for a Single Item

```
PUT /library/metadata/{ratingKey}/refresh?X-Plex-Token={token}
```

## Empty Trash

```
PUT /library/sections/{id}/emptyTrash?X-Plex-Token={token}
```

Removes orphaned/deleted items from a library.

Or for all libraries:
```
PUT /library/sections/all/emptyTrash?X-Plex-Token={token}
```

## Clean Bundles

```
PUT /library/clean/bundles?X-Plex-Token={token}
```

Removes unused metadata bundles.

## Optimize Database

```
PUT /library/optimize?X-Plex-Token={token}
```

Runs database optimization (VACUUM).

## Search

```
GET /hubs/search?X-Plex-Token={token}&query={query}
```

Returns search results across all libraries.

Or search within a library:
```
GET /library/sections/{id}/all?X-Plex-Token={token}&title={query}
```

## On Deck

```
GET /library/onDeck?X-Plex-Token={token}
```

Returns items "On Deck" (partially watched, continue watching).

## Watch History

```
GET /status/sessions/history/all?X-Plex-Token={token}
```

Returns watch history for all users.