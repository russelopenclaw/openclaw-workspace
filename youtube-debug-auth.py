#!/usr/bin/env python3
"""Debug YouTube auth - see what account/channel we're actually accessing."""

import json
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
import socket
import webbrowser
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from datetime import datetime, timezone

SCOPES = [
    "https://www.googleapis.com/auth/youtube",
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.force-ssl",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
]

class OAuthCallbackHandler(BaseHTTPRequestHandler):
    auth_code = None
    def do_GET(self):
        from urllib.parse import parse_qs, urlparse
        query = parse_qs(urlparse(self.path).query)
        code = query.get("code")
        if code:
            OAuthCallbackHandler.auth_code = code[0]
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(b"<html><body><h2>Success! Close this tab.</h2></body></html>")
        else:
            self.send_response(400)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(b"<html><body><h2>Error</h2></body></html>")
    def log_message(self, format, *args):
        pass

def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]

# Load client secret
client_secret_file = Path.home() / ".openclaw" / "youtube" / "client_secret.json"
if not client_secret_file.exists():
    print(f"Error: {client_secret_file} not found")
    exit(1)

port = find_free_port()
redirect_uri = f"http://127.0.0.1:{port}"

flow = InstalledAppFlow.from_client_secrets_file(
    str(client_secret_file),
    scopes=SCOPES,
    redirect_uri=redirect_uri,
)

auth_url, _ = flow.authorization_url(access_type="offline", prompt="consent", login_hint="")

print(f"\n🔐 AUTH URL: {auth_url}")
print("\nOpen this URL in your browser and sign in with the EXACT Google account")
print("that owns the YouTube channel: https://studio.youtube.com/channel/UCRniim13FXZYPJ7eWtqNUqw")
print("\nWaiting for auth...")

server = HTTPServer(("127.0.0.1", port), OAuthCallbackHandler)
server_thread = threading.Thread(target=server.handle_request, daemon=True)
server_thread.start()
webbrowser.open(auth_url)
server_thread.join(timeout=120)
server.server_close()

if not OAuthCallbackHandler.auth_code:
    print("❌ No auth code received")
    exit(1)

try:
    flow.fetch_token(code=OAuthCallbackHandler.auth_code)
except Exception as e:
    print(f"⚠️ Token fetch warning (continuing anyway): {e}")

creds = flow.credentials

print("\n✅ Auth successful!")
print(f"   Email scopes: {creds.scopes}")

# Get user info
print("\n👤 User Info:")
try:
    from googleapiclient.discovery import build
    oauth2 = build('oauth2', 'v2', credentials=creds)
    user_info = oauth2.userinfo().get().execute()
    print(f"   Email: {user_info.get('email')}")
    print(f"   Name: {user_info.get('name')}")
    print(f"   ID: {user_info.get('id')}")
except Exception as e:
    print(f"   Error: {e}")

# Get YouTube channels
print("\n📺 YouTube Channels:")
try:
    youtube = build("youtube", "v3", credentials=creds)
    
    # Try channels.list
    response = youtube.channels().list(part="snippet,contentDetails,statistics", mine=True).execute()
    
    if not response.get("items"):
        print("   ❌ No channels found with channels.list(mine=True)")
        print("\n   This usually means:")
        print("   1. The account doesn't have a YouTube channel created yet")
        print("   2. OR the channel is a Brand Account (requires different approach)")
        
        # Check if there are any channels at all
        print("\n   Checking for Brand Accounts...")
        # Brand accounts show up with different parameters
        try:
            response2 = youtube.channels().list(part="snippet", managedByMe=True).execute()
            if response2.get("items"):
                print(f"   ✅ Found {len(response2['items'])} Brand Account(s):")
                for c in response2["items"]:
                    print(f"      - {c['snippet']['title']} ({c['id']})")
            else:
                print("   ❌ No Brand Accounts found either")
        except Exception as e2:
            print(f"   Error checking Brand Accounts: {e2}")
    else:
        print(f"   ✅ Found {len(response['items'])} channel(s):")
        for c in response["items"]:
            snippet = c["snippet"]
            stats = c.get("statistics", {})
            print(f"\n      Channel: {snippet['title']}")
            print(f"      ID: {c['id']}")
            print(f"      Description: {snippet.get('description', 'N/A')[:100]}")
            print(f"      Subscribers: {stats.get('subscriberCount', 'hidden')}")
            print(f"      Videos: {stats.get('videoCount', '0')}")
            print(f"      Views: {stats.get('viewCount', '0')}")
            
except Exception as e:
    print(f"   ❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n--- END DEBUG ---\n")
