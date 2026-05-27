#!/usr/bin/env python3
"""Test YouTube Music download with proper error handling"""

import subprocess
import sys
from ytmusicapi import YTMusic

# Test authentication
print("Testing authentication...")
ytm = YTMusic('ytmusic-auth.json')
print("✅ Authenticated!")

# Get 5 liked songs
print("\nGetting liked songs...")
liked = ytm.get_liked_songs(limit=5)
tracks = liked.get('tracks', [])[:5]

print(f"Found {len(tracks)} tracks to test:\n")

for i, track in enumerate(tracks, 1):
    video_id = track.get('videoId')
    title = track.get('title', 'Unknown')
    artist = track.get('artists', [{}])[0].get('name', 'Unknown') if track.get('artists') else 'Unknown'
    
    print(f"{i}. {artist} - {title}")
    print(f"   Video ID: {video_id}")
    
    # Test yt-dlp
    url = f"https://music.youtube.com/watch?v={video_id}"
    cmd = [
        'yt-dlp',
        '--simulate',  # Don't actually download
        '--print', 'title',
        url
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        if result.returncode == 0:
            print(f"   ✅ yt-dlp OK: {result.stdout.strip()}")
        else:
            print(f"   ⚠️  yt-dlp warning: {result.stderr[:100]}")
    except subprocess.TimeoutExpired:
        print(f"   ⏱️  Timeout")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    print()

print("\nTest complete! Ready to run full download.")
