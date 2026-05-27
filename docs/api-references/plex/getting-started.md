# Plex - Getting Started & Authentication

## Base URL

```
http://{ip_address}:32400
```

## Required Headers

| Header | Value | Notes |
|--------|-------|-------|
| `X-Plex-Token` | `{token}` | Required for ALL requests |
| `Accept` | `application/json` | Optional — returns JSON instead of XML |

Additional headers for API clients:

| Header | Value | Notes |
|--------|-------|-------|
| `X-Plex-Client-Identifier` | `{unique_id}` | Identifies your app/client |
| `X-Plex-Product` | `YourAppName` | Application name |
| `X-Plex-Version` | `1.0.0` | App version |
| `X-Plex-Device` | `Script` | Device type |
| `X-Plex-Platform` | `Linux` | Platform |

## Getting a Plex Token

### Method 1: Server Token (Admin - Recommended)

The server token is the admin token and works for ALL API calls.

**Linux:**
```bash
cat "/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Preferences.xml" | grep -oP 'PlexOnlineToken="[^"]+"' | sed 's/PlexOnlineToken="//;s/"//'
```

**Windows Registry:**
```
HKEY_CURRENT_USER\Software\Plex, Inc.\Plex Media Server
Value: PlexOnlineToken
```

**macOS:**
```bash
defaults read com.plexapp.plexmediaserver PlexOnlineToken
```

### Method 2: Device Token (Via Web UI)

1. Open Plex Web UI, click any media item
2. Click three dots → Get Info
3. Click "View XML" in lower-left
4. Token appears in the URL as `X-Plex-Token={token}`

### Method 3: User Token (Non-Admin)

1. Log in as the user in Plex Web
2. Open browser DevTools (F12) → Network tab
3. Click any item → Get Info
4. Find the request in Network tab — token is in the URL

### Method 4: All Tokens

```bash
curl "https://plex.tv/api/v2/server/access_tokens?auth_token={server_token}"
```

Returns all device and user tokens for your server.

### Method 5: Sign In via API

```
POST https://plex.tv/users/sign_in.json
```

Headers: `X-Plex-Client-Identifier`, `X-Plex-Product`, `X-Plex-Device`
Body (form-encoded): `user[login]={username}&user[password]={password}`

Returns JSON with `authToken` field.

## Token Types

| Type | Scope | Lifetime | Use |
|------|-------|----------|-----|
| Server token | Full admin | Permanent | Server management |
| Device token | Per-device | Until revoked | Client API calls |
| User token | Per-user | Until revoked | User-specific data |
| Claim token | Server claim | One-time | Claiming a new server |
| Transient token | Same as source | 48 hours | Temporary access |

## Response Format

### XML (Default)

All responses are XML by default. Root element is always `MediaContainer`.

### JSON (Optional)

Add `Accept: application/json` header to get JSON responses. The JSON structure mirrors the XML with `MediaContainer` as the root object.

### Common HTTP Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 401 | Unauthorized — invalid/missing token |
| 403 | Forbidden — insufficient permissions |
| 404 | Not Found |
| 500 | Server Error |