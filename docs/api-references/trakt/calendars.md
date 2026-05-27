# Trakt.tv - Calendars API

Returns upcoming/past episodes and movies. All calendar endpoints require authentication.

## My Shows Calendar

```
GET /calendars/my/shows?start_date={date}&days={n}
```

Returns upcoming episodes for shows in the authenticated user's watchlist/collection.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `start_date` | Today | Start date (YYYY-MM-DD) |
| `days` | 7 | Number of days (max 33) |

## My Movies Calendar

```
GET /calendars/my/movies?start_date={date}&days={n}
```

Upcoming movies the user has watchlisted.

## My DVD Calendar

```
GET /calendars/my/dvd?start_date={date}&days={n}
```

DVD/Blu-ray release dates for watchlisted movies.

## All Shows Calendar

```
GET /calendars/all/shows?start_date={date}&days={n}
```

All shows airing (not personalized). No auth required.

## All Movies Calendar

```
GET /calendars/all/movies?start_date={date}&days={n}
```

All movie releases. No auth required.

## All DVD Calendar

```
GET /calendars/all/dvd?start_date={date}&days={n}
```

All DVD releases. No auth required.

## Response Format

```json
[
  {
    "first_aired": "2024-01-15T02:00:00.000Z",
    "episode": {
      "season": 5,
      "number": 3,
      "title": "Episode Title",
      "ids": { "trakt": 12345, "imdb": "tt1234567" }
    },
    "show": {
      "title": "Show Title",
      "year": 2020,
      "ids": { "trakt": 1390, "slug": "show-title" }
    }
  }
]
```