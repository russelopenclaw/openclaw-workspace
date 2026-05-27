# Trakt.tv API Reference

> **Source:** trakt.docs.apiary.io (Apiary) + community documentation  
> **Base URL:** `https://api.trakt.tv`  
> **API Version:** 2  
> **Docs:** https://trakt.docs.apiary.io/  
> **Status:** Apiary is JS-rendered; live docs require browser access. This reference built from API specification + training data.  
> **Verification note:** Key endpoints should be verified against live API before production use.

## Table of Contents

1. [Getting Started](getting-started.md) - Auth, headers, rate limits
2. [Authentication](auth.md) - OAuth2 + device auth flows
3. [Calendars](calendars.md) - Upcoming episodes/movies
4. [Certifications](certifications.md) - Content certifications (PG, R, etc.)
5. [Check In](checkin.md) - Check into episodes/movies
6. [Certifications](certifications.md) - Movie/show certifications
7. [Comments](comments.md) - Comment on items
8. [Countries](countries.md) - Available countries
9. [Genres](genres.md) - Available genres
10. [Lists](lists.md) - User-created lists
11. [Movies](movies.md) - Movie data endpoints
12. [Networks](networks.md) - TV networks
13. [People](people.md) - Actor/crew data
14. [Recommendations](recommendations.md) - Personal recommendations
15. [Search](search.md) - Text & ID-based search
16. [Seasons](seasons.md) - Show season data
17. [Shows](shows.md) - TV show data
18. [Episodes](episodes.md) - Individual episode data
19. [Sync](sync.md) - Watched history, collection, ratings
20. [Users](users.md) - User profiles, settings, watchlist
21. [Seasons](seasons.md) - Season-level data
22. [Currencies](currencies.md) - Available currencies
23. [Languages](languages.md) - Available languages
24. [Networks](networks.md) - Available networks
25. [Stats](stats.md) - Trakt.tv global stats

## Quick Reference

| Section | Key Endpoints |
|---------|--------------|
| Calendars | `/calendars/my/shows`, `/calendars/my/movies`, `/calendars/all/shows` |
| Check In | `/checkin` |
| Comments | `/comments`, `/comments/{id}`, `/comments/{id}/replies` |
| Genres | `/genres/movies`, `/genres/shows` |
| Lists | `/lists/{id}`, `/users/{id}/lists` |
| Movies | `/movies/{id}`, `/movies/trending`, `/movies/popular` |
| People | `/people/{id}`, `/people/{id}/movies` |
| Search | `/search/query`, `/search/id/{id_type}` |
| Shows | `/shows/{id}`, `/shows/trending`, `/shows/popular` |
| Seasons | `/shows/{id}/seasons`, `/shows/{id}/seasons/{season}` |
| Episodes | `/shows/{id}/seasons/{season}/episodes/{episode}` |
| Sync | `/sync/history`, `/sync/collection`, `/sync/ratings`, `/sync/watchlist` |
| Users | `/users/{id}`, `/users/{id}/watchlist`, `/users/{id}/history` |