# Trakt.tv - Users API

All user endpoints require authentication unless the user's profile is public.

## User Settings

```
GET /users/settings
```

Returns authenticated user's profile, account, and connections (social media IDs).

## Profile

```
GET /users/{id}
```

`{id}` can be slug (username) or Trakt ID.

## Followers / Following

```
GET /users/{id}/followers
GET /users/{id}/following
```

## Friends

```
GET /users/{id}/friends
```

Mutual followers.

## History

```
GET /users/{id}/history/{type}?start_at={date}&end_at={date}
```

Types: `movies`, `episodes`, `shows`, `seasons`, `all`

## Ratings

```
GET /users/{id}/ratings/{type}/{rating}
```

## Watchlist

```
GET /users/{id}/watchlist/{type}/{sort}
```

Sort options: `rank`, `added`, `title`, `released`, `runtime`, `popularity`, `percentage`, `votes`

## Collection

```
GET /users/{id}/collection/{type}
```

Types: `movies`, `shows`

## Stats

```
GET /users/{id}/stats
```

Returns comprehensive user stats: movies watched, episodes watched, time spent, etc.

## Watching (Currently)

```
GET /users/{id}/watching
```

Returns item user is currently watching, or 204 if not watching.

## Watched

```
GET /users/{id}/watched/{type}
```

Returns all watched movies/episodes with play counts. Good for bulk sync.

Types: `movies`, `shows`, `episodes` (all)

## Lists

```
GET /users/{id}/lists
GET /users/{id}/lists/{list_id}
```

## List Items

```
GET /users/{id}/lists/{list_id}/items/{type}
```

Types: `movie`, `show`, `season`, `episode`, `person`, `comment`

## Create List

```
POST /users/{id}/lists
```

```json
{
  "name": "My List",
  "description": "Description",
  "privacy": "private",
  "display_numbers": false,
  "allow_comments": true,
  "sort_by": "rank",
  "sort_how": "asc"
}
```

Privacy: `private`, `friends`, `public`

## Update / Delete List

```
PUT /users/{id}/lists/{list_id}
DELETE /users/{id}/lists/{list_id}
```

## Add / Remove List Items

```
POST /users/{id}/lists/{list_id}/items
DELETE /users/{id}/lists/{list_id}/items/remove
```

```json
{
  "movies": [{"ids": {"imdb": "tt0000001"}}],
  "shows": [{"ids": {"slug": "breaking-bad"}}],
  "episodes": [{"ids": {"trakt": 12345}}]
}
```

## Comments

```
GET /users/{id}/comments/{type}
```

Types: `all`, `reviews`, `shouts`

## Hidden Items

```
GET /users/hidden/{section}
```

Sections: `calendar`, `progress_watched`, `progress_collected`, `recommendations`

## Recommendations

```
GET /users/recommendations/{type}?ignore_collected=true&ignore_watchlisted=true
```

Types: `movies`, `shows`

## Social

```
GET /users/likes/{type}
```

Types: `comments`, `lists`