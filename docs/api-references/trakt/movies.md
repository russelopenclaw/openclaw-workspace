# Trakt.tv - Movies API

## Summary

```
GET /movies/{id}
```

`{id}` can be Trakt ID, slug, or IMDB ID.

With `?extended=full` returns full info (overview, runtime, rating, tagline, certification, etc.)

## Aliases

```
GET /movies/{id}/aliases
```

## Translations

```
GET /movies/{id}/translations/{language}
```

## Trending

```
GET /movies/trending?page=1&limit=10
```

## Popular

```
GET /movies/popular?page=1&limit=10
```

## Anticipated

```
GET /movies/anticipated?page=1&limit=10
```

## Box Office

```
GET /movies/box_office
```

Top 10 weekend box office movies.

## Updates

```
GET /movies/updates/{start_date}?page=1&limit=10
```

## People

```
GET /movies/{id}/people
```

Returns cast and crew.

## Ratings

```
GET /movies/{id}/ratings
```

Rating distribution (1-10).

## Related

```
GET /movies/{id}/related?limit=10
```

## Stats

```
GET /movies/{id}/stats
```

Watchstats: watchers, plays, collectors, comments, lists, likes.

## Watching

```
GET /movies/{id}/watching
```

Users currently watching this movie.