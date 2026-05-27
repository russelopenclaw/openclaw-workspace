### Plex Media Server

- **Host**: server:32400 (NOT reachable via IP from Optiplex)
- **Token**: z7Bh1q4cqgmNEzfF6EFW (admin)
- **Libraries**: 15 total (TV Shows key=1, Movies key=2, 4K key=35, etc.)
- **Users**: 30 accounts, 11 with watch history, 9 active (90 days)
- **API**: XML by default, add `Accept: application/json` for JSON
- **History**: `accountID` on each entry maps to `/accounts` usernames
- **Live data**: `/status/sessions` for now playing, `/status/sessions/history/all` for history
- **MC page**: http://server:8765/plex
