### Google Calendar (gog)

**Keyring Config Required:**
```bash
export GOG_KEYRING_BACKEND=file
export GOG_KEYRING_PASSWORD=<your-password>
```

**API Response Format:**
- Returns `{events: []}` wrapper (NOT raw array)
- Event fields: `summary` (not `title`), `start`, `end`, `location`
- Dates: ISO 8601 strings (handle UTC vs local carefully)

**Common Gotchas:**
- Missing keyring vars → silent auth failures
- Response format mismatch → frontend crashes
- Date comparison → always normalize to local timezone

**Fixed 2026-04-15:** Calendar integration now working after fixing:
- Keyring env vars
- Response mapping (`summary` → `title`)
- Date comparison (UTC vs local)
- Flat ISO string handling
