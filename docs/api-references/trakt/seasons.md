# Trakt.tv - Seasons & Episodes API

## Seasons

### All Seasons

```
GET /shows/{id}/seasons?extended=full
```

Returns all seasons for a show.

### Season Summary

```
GET /shows/{id}/seasons/{season}?extended=full
```

`{season}` is the season number (1-based, 0 for specials).

### Season Translations

```
GET /shows/{id}/seasons/{season}/translations/{language}
```

### Season Ratings

```
GET /shows/{id}/seasons/{season}/ratings
```

### Season Stats

```
GET /shows/{id}/seasons/{season}/stats
```

### Season Watching

```
GET /shows/{id}/seasons/{season}/watching
```

## Episodes

### Episode Summary

```
GET /shows/{id}/seasons/{season}/episodes/{episode}?extended=full
```

`{episode}` is the episode number within the season.

### Episode Translations

```
GET /shows/{id}/seasons/{season}/episodes/{episode}/translations/{language}
```

### Episode Ratings

```
GET /shows/{id}/seasons/{season}/episodes/{episode}/ratings
```

### Episode Stats

```
GET /shows/{id}/seasons/{season}/episodes/{episode}/stats
```

### Episode Watching

```
GET /shows/{id}/seasons/{season}/episodes/{episode}/watching
```

## Quick Episode Lookup

```
GET /shows/{id}/seasons/{season}/episodes/{episode}
```

Alternate: Use search with Trakt episode ID:
```
GET /search/trakt_episode/{id}?type=episode
```