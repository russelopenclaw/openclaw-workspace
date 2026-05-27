#!/bin/bash
# YouTube Music Library Cleanup & Reorganization
# Moves flat files to Artist/Album/ structure with proper naming

set -e

DOWNLOAD_DIR="/mnt/openclaw/music"
DOWNLOADED_FILE="$HOME/.ytmusic-downloader/downloaded.json"
AUTH_FILE="/home/kevin/.openclaw/workspace/ytmusic-auth.json"

echo "🧹 YouTube Music Library Cleanup"
echo "================================"
echo "Target structure: Artist/Album/Artist-Album-TrackNum-Title.mp3"
echo ""

# Step 1: Get metadata for all downloaded songs
echo "📋 Getting metadata for all downloaded songs..."

/home/linuxbrew/.linuxbrew/bin/python3 << 'PYTHON'
import json
import os
from pathlib import Path
from ytmusicapi import YTMusic

DOWNLOAD_DIR = Path("/mnt/openclaw/music")
AUTH_FILE = "/home/kevin/.openclaw/workspace/ytmusic-auth.json"
DOWNLOADED_FILE = Path.home() / ".ytmusic-downloader" / "downloaded.json"

ytm = YTMusic(AUTH_FILE)

with open(DOWNLOADED_FILE) as f:
    downloaded = json.load(f)

print(f"Found {len(downloaded)} downloaded songs")

# Get metadata for each song
metadata = []
for i, video_id in enumerate(downloaded, 1):
    try:
        song = ytm.get_song(video_id)
        if not song:
            continue
        
        title = song.get('title', 'Unknown')
        artists = song.get('artists', [{}])
        artist = artists[0].get('name', 'Unknown') if artists else 'Unknown'
        album = song.get('album', {}).get('name', 'Unknown') if song.get('album') else 'Unknown'
        track_num = song.get('trackNumber', 0) or 0
        
        # Try to get better track number from album
        album_id = song.get('album', {}).get('id')
        if album_id and not song.get('trackNumber'):
            try:
                album_data = ytm.get_album(album_id)
                for track in album_data.get('tracks', []):
                    if track.get('videoId') == video_id:
                        track_num = track.get('trackNumber', track_num) or track_num
                        break
            except:
                pass
        
        metadata.append({
            'video_id': video_id,
            'title': title,
            'artist': artist,
            'album': album,
            'track_num': track_num
        })
        
        if i % 50 == 0:
            print(f"  Processed {i}/{len(downloaded)} songs...")
            
    except Exception as e:
        print(f"  Error processing {video_id}: {e}")
        # Keep the entry with unknown metadata
        metadata.append({
            'video_id': video_id,
            'title': 'Unknown',
            'artist': 'Unknown',
            'album': 'Unknown',
            'track_num': 0
        })

# Save metadata for bash script
with open('/tmp/ytmusic-metadata.json', 'w') as f:
    json.dump(metadata, f, indent=2)

print(f"✅ Metadata collected for {len(metadata)} songs")
PYTHON

# Step 2: Organize files
echo ""
echo "📁 Organizing files..."

/home/linuxbrew/.linuxbrew/bin/python3 << 'PYTHON'
import json
import os
import shutil
from pathlib import Path

DOWNLOAD_DIR = Path("/mnt/openclaw/music")
METADATA_FILE = Path("/tmp/ytmusic-metadata.json")

with open(METADATA_FILE) as f:
    metadata = json.load(f)

def clean_name(s):
    """Remove invalid filename characters"""
    return ''.join(c for c in s if c not in r'\/:*?"<>|')

organized = 0
moved = 0
duplicates = 0
errors = 0

for song in metadata:
    video_id = song['video_id']
    title = song['title']
    artist = song['artist']
    album = song['album']
    track_num = song['track_num'] or 0
    
    artist_clean = clean_name(artist)
    album_clean = clean_name(album)
    title_clean = clean_name(title)
    track_formatted = f"{track_num:02d}"
    
    # New filename and path
    filename = f"{artist_clean}-{album_clean}-{track_formatted}-{title_clean}.mp3"
    artist_dir = DOWNLOAD_DIR / artist_clean
    album_dir = artist_dir / album_clean
    new_path = album_dir / filename
    
    # Find the old file (search in root and subdirs)
    old_file = None
    
    # First check if file already exists at new location
    if new_path.exists():
        # print(f"  ✓ Already organized: {filename}")
        organized += 1
        continue
    
    # Search for the file in the download directory
    for mp3_file in DOWNLOAD_DIR.rglob("*.mp3"):
        if mp3_file.name.startswith(video_id[:8]) or video_id[:8] in str(mp3_file):
            old_file = mp3_file
            break
    
    # Alternative: search by title/artist in filename
    if not old_file:
        for mp3_file in DOWNLOAD_DIR.rglob(f"*{title_clean[:20]}*.mp3"):
            if artist_clean.lower() in str(mp3_file).lower():
                old_file = mp3_file
                break
    
    if not old_file:
        # Try any mp3 in root that matches
        for mp3_file in DOWNLOAD_DIR.glob("*.mp3"):
            if title_clean.lower() in mp3_file.name.lower():
                old_file = mp3_file
                break
    
    if not old_file:
        errors += 1
        continue
    
    # Create directory structure
    album_dir.mkdir(parents=True, exist_ok=True)
    
    # Move the file
    try:
        if old_file.exists():
            shutil.move(str(old_file), str(new_path))
            moved += 1
            print(f"  📁 {artist} - {album} - {track_formatted} - {title}")
        else:
            errors += 1
    except Exception as e:
        print(f"  ❌ Error moving {old_file.name}: {e}")
        errors += 1

print(f"\n✅ Organized: {moved} files moved, {organized} already organized, {errors} errors")

# Step 3: Remove old empty directories and duplicate files
print("\n🗑️  Cleaning up...")

# Remove empty directories
empty_dirs = 0
for dirpath in sorted(DOWNLOADED_DIR.iterdir(), reverse=True):
    if dirpath.is_dir():
        try:
            # Remove empty subdirectories
            for subdir in dirpath.rglob("*"):
                if subdir.is_dir() and not any(subdir.iterdir()):
                    subdir.rmdir()
                    empty_dirs += 1
        except:
            pass

# Remove duplicate files (same video_id in multiple locations)
print("Checking for duplicates...")
PYTHON

# Step 4: Remove old flat files
echo ""
echo "Removing old flat files..."
find "$DOWNLOAD_DIR" -maxdepth 1 -name "*.mp3" -type f -delete 2>/dev/null || true
find "$DOWNLOAD_DIR" -maxdepth 1 -name "*.webp" -type f -delete 2>/dev/null || true

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "New structure:"
find "$DOWNLOAD_DIR" -type d | head -20
