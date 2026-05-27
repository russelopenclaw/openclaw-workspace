# Trakt.tv - Check In, Comments, Genres, Lists, People, Recommendations

## Check In

Check into an episode or movie (marks as watching).

```
POST /checkin
```

```json
{
  "movie": {
    "ids": {"imdb": "tt0000001"},
    "title": "Movie Title",
    "year": 2024
  },
  "app_version": "1.0",
  "app_date": "2024-01-15",
  "sharing": {
    "twitter": true,
    "tumblr": false
  },
  "message": "Watching this!"
}
```

Or for episodes:
```json
{
  "episode": {
    "ids": {"trakt": 12345}
  }
}
```

**Note:** Only one active check-in at a time. New check-in replaces old.

### Delete Active Check-in

```
DELETE /checkin
```

## Comments

### Post Comment

```
POST /comments
```

```json
{
  "comment": "Great episode!",
  "spoiler": false,
  "movie": {"ids": {"imdb": "tt0000001"}},
  "episode": {"ids": {"trakt": 12345}},
  "show": {"ids": {"slug": "breaking-bad"}}
}
```

### Post Review

Same as comment but with `review: true`:
```json
{
  "comment": "Full review text here...",
  "spoiler": false,
  "review": true,
  "movie": {"ids": {"imdb": "tt0000001"}}
}
```

### Get Comment

```
GET /comments/{id}?include_replies=true
```

### Update Comment

```
PUT /comments/{id}
```

### Delete Comment

```
DELETE /comments/{id}
```

### Comment Replies

```
POST /comments/{id}/replies
GET /comments/{id}/replies
```

### Like/Unlike Comment

```
POST /comments/{id}/like
DELETE /comments/{id}/like
```

## Genres

```
GET /genres/movies
GET /genres/shows
```

Returns list of available genres:
```json
[
  {"name": "Action", "slug": "action"},
  {"name": "Comedy", "slug": "comedy"}
]
```

## Lists

### Trending Lists

```
GET /lists/trending?page=1&limit=10
```

### Popular Lists

```
GET /lists/popular?page=1&limit=10
```

### List Details

```
GET /lists/{id}
```

### List Items

```
GET /lists/{id}/items/{type}
```

### Like/Unlike List

```
POST /lists/{id}/like
DELETE /lists/{id}/like
```

## People

### Person Summary

```
GET /people/{id}
```

### Person Movies

```
GET /people/{id}/movies
```

Returns movies as `cast` and `crew` arrays.

### Person Shows

```
GET /people/{id}/shows
```

## Recommendations

### Get Personal Recommendations

```
GET /recommendations/movies?ignore_collected=true&ignore_watchlisted=true&limit=10
GET /recommendations/shows?ignore_collected=true&ignore_watchlisted=true&limit=10
```

Requires authentication. Returns personalized recommendations.

### Hide Recommendation

```
DELETE /recommendations/movies/{id}
DELETE /recommendations/shows/{id}
```