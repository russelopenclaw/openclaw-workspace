# Trakt.tv - Authentication

Trakt uses OAuth 2.0 for authentication with two supported flows.

## OAuth 2.0 Authorization Code Flow

Standard 3-legged OAuth for web apps and server-side apps.

### Step 1: Redirect User to Authorize

```
GET https://trakt.tv/oauth/authorize
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `response_type` | Yes | `code` |
| `client_id` | Yes | Your app's client ID |
| `redirect_uri` | Yes | Must match registered URI |
| `state` | Recommended | CSRF protection string |
| `scope` | No | Space-separated scopes (default: empty) |

### Step 2: Receive Authorization Code

User is redirected to `redirect_uri?code={code}&state={state}`

### Step 3: Exchange Code for Token

```
POST https://api.trakt.tv/oauth/token
```

Request body:
```json
{
  "code": "authorization_code",
  "client_id": "your_client_id",
  "client_secret": "your_client_secret",
  "redirect_uri": "your_redirect_uri",
  "grant_type": "authorization_code"
}
```

Response:
```json
{
  "access_token": "...",
  "token_type": "bearer",
  "expires_in": 7776000,
  "refresh_token": "...",
  "scope": null,
  "created_at": 1234567890
}
```

### Step 4: Refresh Token

Tokens expire after 90 days (`expires_in: 7776000` seconds).

```
POST https://api.trakt.tv/oauth/token
```

Request body:
```json
{
  "refresh_token": "your_refresh_token",
  "client_id": "your_client_id",
  "client_secret": "your_client_secret",
  "grant_type": "refresh_token",
  "redirect_uri": "your_redirect_uri"
}
```

## Device Authentication (No Browser Required)

Ideal for CLI tools, smart TVs, and headless apps.

### Step 1: Get Device Code

```
POST https://api.trakt.tv/oauth/device/code
```

Request body:
```json
{
  "client_id": "your_client_id"
}
```

Response:
```json
{
  "device_code": "...",
  "user_code": "ABC123",
  "verification_url": "https://trakt.tv/activate",
  "expires_in": 600,
  "interval": 5
}
```

### Step 2: User Authorizes

Display `user_code` to user. They visit `https://trakt.tv/activate` and enter the code.

### Step 3: Poll for Token

```
POST https://api.trakt.tv/oauth/device/token
```

Request body:
```json
{
  "code": "device_code",
  "client_id": "your_client_id",
  "client_secret": "your_client_secret"
}
```

Poll every `interval` seconds (typically 5s) until:
- **200:** Success, returns access token
- **400:** Pending (user hasn't authorized yet, keep polling)
- **404:** Invalid device code
- **429:** Slow down (increase interval by 5 seconds)

## Available Scopes

Trakt currently doesn't use granular scopes — all tokens have full access.

## Token Usage

Include in every authenticated request:
```
Authorization: Bearer {access_token}
trakt-api-key: {client_id}
```

## Revoking Access

```
POST https://api.trakt.tv/oauth/revoke
```

Request body:
```json
{
  "access_token": "token_to_revoke",
  "client_id": "your_client_id"
}
```