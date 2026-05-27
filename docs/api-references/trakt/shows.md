# Trakt.tv - Shows API

## Summary

```
GET /shows/{id}
```

`{id}` can be Trakt ID, slug, or IMDB ID.

With `?extended=full` returns full info (overview, runtime, rating, etc.)

## Aliases

```
GET /shows/{id}/aliases
```

Returns alternate titles for different countries.

## Translations

```
GET /shows/{id}/translations/{language}
```

Available languages: en, es, fr, de, it, pt, ja, zh, etc.

## Trending

```
GET /shows/trending?page=1&limit=10
```

Returns shows with most watches in recent period. Supports `?extended=full`.

## Popular

```
GET /shows/popular?page=1&limit=10
```

Shows with highest rating. Supports `?extended=full`.

## Anticipated

```
GET /shows/anticipated?page=1&limit=10
```

Most anticipated based on watchlist count. Supports `?extended=full`.

## Updates

```
GET /shows/updates/{start_date}?page=1&limit=10
```

`start_date` in ISO 8601 format. Returns shows updated since that date.

## People

```
GET /shows/{id}/people
```

Returns cast and crew.

## Ratings

```
GET /shows/{id}/ratings
```

Returns rating distribution (1-10 vote counts).

## Related

```
GET /shows/{id}/related?limit=10
```

Similar/recommended shows.

## Stats

```
GET /shows/{id}/stats
```

Returns watchstats: watchers, plays, collectors, etc.

## Watching

```
GET /shows/{id}/watching
```

Users currently watching this show (real-time).

## Next Episode

```
GET /shows/{id}/next_episode
```

Returns the next unwatched episode for the authenticated user.

## Last Episode

```
GET /shows/{id}/last_episode
```

Returns the most recently aired episode.