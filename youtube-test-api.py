#!/usr/bin/env python3
"""Test YouTube API with stored credentials."""

import json
from pathlib import Path
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

# Load stored credentials
cred_file = Path.home() / ".openclaw" / "youtube" / "client_secret.json"
if not cred_file.exists():
    print(f"Error: {cred_file} not found")
    exit(1)

with open(cred_file) as f:
    client_config = json.load(f)

# Try to load existing channels
channels_file = Path.home() / ".openclaw" / "youtube" / "channels.json"
if channels_file.exists():
    with open(channels_file) as f:
        channels_data = json.load(f)
    print(f"Found existing channels.json with {len(channels_data)} channel(s)")
else:
    print("No channels.json found - need to authenticate first")
    print("\nRe-run auth with:")
    print(f"  python3 /home/kevin/.openclaw/workspace/skills/youtube-uploader/scripts/youtube-upload.py auth --client-secret {cred_file}")
    exit(1)

# Try each channel
for channel_id, data in channels_data.items():
    print(f"\n--- Testing channel: {channel_id} ---")
    print(f"Title: {data.get('title', 'Unknown')}")
    
    # Build credentials
    try:
        creds = Credentials(
            token=data["token"],
            refresh_token=data["refresh_token"],
            token_uri=data["token_uri"],
            client_id=data["client_id"],
            client_secret=data["client_secret"],
            scopes=["https://www.googleapis.com/auth/youtube"],
        )
        
        # Refresh if expired
        if creds.expired and creds.refresh_token:
            print("Token expired, refreshing...")
            creds.refresh(Request())
        
        # Test API call
        youtube = build("youtube", "v3", credentials=creds)
        
        # Get channel info
        print("\n📺 Fetching channel info...")
        response = youtube.channels().list(part="snippet,contentDetails,statistics", id=channel_id).execute()
        
        if response.get("items"):
            channel = response["items"][0]
            snippet = channel["snippet"]
            stats = channel.get("statistics", {})
            
            print(f"\n✅ Channel found!")
            print(f"   Title: {snippet['title']}")
            print(f"   ID: {channel['id']}")
            print(f"   Description: {snippet.get('description', 'N/A')[:100]}")
            print(f"   Subscriber count: {stats.get('subscriberCount', 'hidden')}")
            print(f"   Video count: {stats.get('videoCount', '0')}")
            print(f"   Total views: {stats.get('viewCount', '0')}")
            
            # Also try to list videos
            print("\n📹 Recent videos:")
            videos_response = youtube.search().list(
                part="snippet",
                channelId=channel_id,
                order="date",
                type="video",
                maxResults=5
            ).execute()
            
            if videos_response.get("items"):
                for i, video in enumerate(videos_response["items"], 1):
                    print(f"   {i}. {video['snippet']['title']}")
            else:
                print("   No videos found")
                
        else:
            print(f"❌ Channel {channel_id} not found via API")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

print("\n--- END TEST ---\n")
