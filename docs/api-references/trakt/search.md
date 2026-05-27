# Trakt.tv - Search API

## Text Search

```
GET /search/query?query={query}&type={type}&field={field}
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `query` | Yes | Search text (min 1 character) |
| `type` | No | Filter: `movie`, `show`, `episode`, `person`, `list` (comma-separated for multiple) |
| `field` | No | Search field: `title`, `year`, `tagline` (default: `title`) |

**Important:** Text search is rate limited more aggressively. Cache results.

## ID Lookup

Look up items by external ID:

```
GET /search/id/{id_type}?id={id}
```

| id_type | Example |
|---------|---------|
| `imdb` | `tt0903747` |
| `tmdb` | `1396` |
| `tvdb` | `81189` |
| `tvrage` | (deprecated) |
| `trakt` | `1390` |
| `trakt_episode` | `73440` |
| `trakt_season` | `3982` |
| `slug` | `breaking-bad` |

You can search multiple ID types at once:

```
GET /search/imdb?imdb_id=tt0903747&type=show
```

## Response Format

Search results return a mixed array based on type:

```json
[
  {
    "type": "show",
    "score": 100,
    "show": {
      "title": "Breaking Bad",
      "year": 2008,
      "ids": {
        "trakt": 1390,
        "slug": "breaking-bad",
        "imdb": "tt0903747",
        "tmdb": 1396,
        "tvdb": 81189
      }
    }
  }
]
```

The key in each result (`show`, `movie`, `episode`, `person`, `list`) matches the `type` field.