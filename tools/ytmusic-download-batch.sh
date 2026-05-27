#!/bin/bash
# Download remaining liked songs in batches

set -e

DOWNLOAD_DIR="/mnt/openclaw/music"
DOWNLOADED_FILE="$HOME/.ytmusic-downloader/downloaded.json"
AUTH_FILE="/home/kevin/.openclaw/workspace/ytmusic-auth.json"

echo "🎵 Downloading remaining liked songs"
echo "===================================="

# Get list of songs to download
/home/linuxbrew/.linuxbrew/bin/python3 << 'PYTHON'
from ytmusicapi import YTMusic
import json

ytm = YTMusic('/home/kevin/.openclaw/workspace/ytmusic-auth.json')

# Load already downloaded
with open('/home/kevin/.ytmusic-downloader/downloaded.json') as f:
    downloaded = set(json.load(f))

# Get all liked songs
liked = ytm.get_liked_songs(limit=600)
tracks = liked.get('tracks', [])

print(f"Total liked: {len(tracks)}, Already downloaded: {len(downloaded)}")

# Filter to only new songs
new_tracks = []
for track in tracks:
    video_id = track.get('videoId')
    if video_id and video_id not in downloaded:
        title = track.get('title', 'Unknown')
        artists = track.get('artists', [])
        artist = artists[0].get('name', 'Unknown') if artists else 'Unknown'
        album_info = track.get('album', {})
        album = album_info.get('name', 'Unknown') if album_info else 'Unknown'
        track_num = track.get('trackNumber', 0) or 0
        
        # Try to get track number from album
        album_id = album_info.get('id')
        if album_id and not track.get('trackNumber'):
            try:
                album_data = ytm.get_album(album_id)
                for at in album_data.get('tracks', []):
                    if at.get('videoId') == video_id:
                        track_num = at.get('trackNumber', track_num) or track_num
                        break
            except:
                pass
        
        new_tracks.append({
            'video_id': video_id,
            'title': title,
            'artist': artist,
            'album': album,
            'track_num': track_num
        })

# Save to temp file
with open('/tmp/ytmusic-new-songs.json', 'w') as f:
    json.dump(new_tracks, f, indent=2)

print(f"New songs to download: {len(new_tracks)}")
PYTHON

# Download each song
echo ""
echo "Downloading..."

/home/linuxbrew/.linuxbrew/bin/python3 << 'PYTHON'
import json
import subprocess
import os
from pathlib import Path

DOWNLOAD_DIR = Path("/mnt/openclaw/music")
DOWNLOADED_FILE = Path.home() / ".ytmusic-downloader" / "downloaded.json"

with open('/tmp/ytmusic-new-songs.json') as f:
    songs = json.load(f)

def clean_name(s):
    return ''.join(c for c in s if c not in r'\/:*?"<>|')

ok = skip = fail = 0
for i, song in enumerate(songs, 1):
    video_id = song['video_id']
    title = song['title']
    artist = song['artist']
    album = song['album']
    track_num = song['track_num'] or 0
    
    artist_clean = clean_name(artist)
    album_clean = clean_name(album)
    title_clean = clean_name(title)
    track_formatted = f"{track_num:02d}"
    
    # Create directory
    album_dir = DOWNLOAD_DIR / artist_clean / album_clean
    album_dir.mkdir(parents=True, exist_ok=True)
    
    # Filename
    filename = f"{artist_clean}-{album_clean}-{track_formatted}-{title_clean}.mp3"
    output_file = album_dir / filename
    
    # Check if exists
    if output_file.exists():
        skip += 1
        print(f"⏭️  [{i}/{len(songs)}] {artist} - {title}")
        continue
    
    print(f"⬇️  [{i}/{len(songs)}] {artist} - {title}")
    
    # Download
    url = f"https://music.youtube.com/watch?v={video_id}"
    cmd = [
        'yt-dlp',
        '-x', '--audio-format', 'mp3', '--audio-quality', '0',
        '--embed-metadata', '--embed-thumbnail', '--add-metadata',
        '-o', str(output_file),
        '--no-cookies', '--no-warnings',
        url
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode == 0:
            # Mark as downloaded
            with open(DOWNLOADED_FILE) as f:
                downloaded = json.load(f)
            if video_id not in downloaded:
                downloaded.append(video_id)
            with open(DOWNLOADED_FILE, 'w') as f:
                json.dump(downloaded, f)
            
            ok += 1
            print(f"   ✅ Done")
        else:
            fail += 1
            print(f"   ❌ Failed")
    except subprocess.TimeoutExpired:
        fail += 1
        print(f"   ❌ Timeout")
    except Exception as e:
        fail += 1
        print(f"   ❌ Error: {e}")
    
    # Progress every 20
    if i % 20 == 0:
        print(f"  ... {i}/{len(songs)} ...")

print(f"\n✅ Complete: {ok} downloaded, {skip} skipped, {fail} failed")
PYTHON

echo ""
echo "===================="
downloaded_count=$(/home/linuxbrew/.linuxbrew/bin/python3 -c "import json; print(len(json.load(open('$DOWNLOADED_FILE'))))")
echo "Total tracked: $downloaded_count songs"
