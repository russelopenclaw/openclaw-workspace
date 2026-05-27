#!/usr/bin/env python3
"""
Download a specific YouTube Music playlist with full metadata
Checks for existing files to avoid duplicates
"""

import json
import subprocess
import sys
import time
from pathlib import Path
from ytmusicapi import YTMusic

# Configuration
PLAYLIST_ID = "PLPMrWuw9jHjqfeNJ9zZbuUXXHzgMmJFZZ"  # Focused playlist
DOWNLOAD_DIR = Path("/mnt/openclaw/music")
AUTH_FILE = Path("/home/kevin/.openclaw/workspace/ytmusic-auth.json")
MANIFEST_FILE = Path("/home/kevin/.ytmusic-downloader/focused-manifest.json")

def clean_name(s):
    """Remove invalid filename characters"""
    return ''.join(c for c in s if c not in r'\/:*?"<>|').strip()

def file_exists(artist, album, title):
    """Check if song already exists in download directory"""
    artist_clean = clean_name(artist)
    album_clean = clean_name(album) if album else "Unknown Album"
    title_clean = clean_name(title)
    
    # Check various possible locations
    possible_paths = [
        DOWNLOAD_DIR / artist_clean / album_clean / f"{artist_clean}-{album_clean}-*-{title_clean}.mp3",
        DOWNLOAD_DIR / artist_clean / "Unknown Album" / f"{artist_clean}-Unknown Album-*-{title_clean}.mp3",
        DOWNLOAD_DIR / artist_clean / f"{title_clean}.mp3",
    ]
    
    for pattern in possible_paths:
        matches = list(DOWNLOAD_DIR.glob(str(pattern.relative_to(DOWNLOAD_DIR))))
        if matches:
            return True, matches[0]
    
    # Also check by globbing artist folder
    artist_dir = DOWNLOAD_DIR / artist_clean
    if artist_dir.exists():
        for f in artist_dir.rglob("*.mp3"):
            if title_clean.lower() in f.name.lower():
                return True, f
    
    return False, None

def download_song(video_id, title, artist, album, track_num, max_retries=3):
    """Download a single song with retry logic and metadata"""
    
    artist_clean = clean_name(artist)
    album_clean = clean_name(album) if album else "Unknown Album"
    title_clean = clean_name(title)
    track_formatted = f"{track_num:02d}"
    
    # Create directory: Artist/Album/
    album_dir = DOWNLOAD_DIR / artist_clean / album_clean
    album_dir.mkdir(parents=True, exist_ok=True)
    
    # Filename: Artist-Album-TrackNum-Title.mp3
    filename = f"{artist_clean}-{album_clean}-{track_formatted}-{title_clean}.mp3"
    output_file = album_dir / filename
    
    url = f"https://music.youtube.com/watch?v={video_id}"
    
    for attempt in range(1, max_retries + 1):
        cmd = [
            'yt-dlp',
            '-x', '--audio-format', 'mp3', '--audio-quality', '0',
            '--embed-metadata', '--embed-thumbnail', '--add-metadata',
            '-o', str(output_file),
            '--no-cookies', '--no-warnings',
            '--socket-timeout', '30',
            '--retries', '3',
            url
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
            
            if result.returncode == 0:
                print(f"   ✅ Downloaded: {title}")
                return 'ok', str(output_file)
            else:
                error_msg = result.stderr[:200] if result.stderr else 'Unknown error'
                
                if 'timeout' in error_msg.lower() or 'timed out' in error_msg.lower() or 'HTTP Error 5' in error_msg:
                    if attempt < max_retries:
                        wait_time = attempt * 5
                        print(f"   ⏳ Timeout, retrying in {wait_time}s... ({attempt}/{max_retries})")
                        time.sleep(wait_time)
                        continue
                    else:
                        return 'timeout', error_msg
                else:
                    return 'fail', error_msg
                    
        except subprocess.TimeoutExpired:
            if attempt < max_retries:
                wait_time = attempt * 5
                print(f"   ⏳ Timeout, retrying in {wait_time}s... ({attempt}/{max_retries})")
                time.sleep(wait_time)
                continue
            else:
                return 'timeout', 'Download timed out after all retries'
        except Exception as e:
            return 'fail', str(e)
    
    return 'fail', 'Max retries exceeded'

def main():
    print("🎵 YouTube Music Playlist Downloader")
    print("=" * 50)
    print(f"Playlist ID: {PLAYLIST_ID}")
    print(f"Download Dir: {DOWNLOAD_DIR}")
    print()
    
    # Load auth
    if not AUTH_FILE.exists():
        print("❌ Auth file not found. Run ytmusic-auth.py first.")
        sys.exit(1)
    
    yt = YTMusic(auth=str(AUTH_FILE))
    
    # Get playlist info
    print("📋 Fetching playlist...")
    playlist = yt.get_playlist(PLAYLIST_ID, limit=100)
    playlist_title = playlist.get('title', 'Unknown')
    tracks = playlist.get('tracks', [])
    
    print(f"Playlist: {playlist_title}")
    print(f"Total tracks: {len(tracks)}")
    print()
    
    # Load existing manifest
    downloaded = {}
    if MANIFEST_FILE.exists():
        with open(MANIFEST_FILE) as f:
            downloaded = json.load(f)
    
    # Process tracks
    results = {'ok': 0, 'skipped': 0, 'failed': 0, 'timeout': 0}
    failed_tracks = []
    
    for i, track in enumerate(tracks, 1):
        video_id = track.get('videoId')
        title = track.get('title', 'Unknown')
        artists = track.get('artists', [])
        artist = artists[0].get('name', 'Unknown') if artists else 'Unknown'
        album = track.get('album', {}).get('name', 'Unknown Album') if track.get('album') else 'Unknown Album'
        
        print(f"[{i}/{len(tracks)}] {title} - {artist}")
        
        # Check if already downloaded
        exists, path = file_exists(artist, album, title)
        if exists:
            print(f"   ⏭️  Already exists: {path}")
            results['skipped'] += 1
            downloaded[video_id] = {'status': 'exists', 'path': str(path)}
            continue
        
        # Download
        status, info = download_song(video_id, title, artist, album, i)
        results[status] += 1
        
        downloaded[video_id] = {
            'status': status,
            'title': title,
            'artist': artist,
            'album': album,
            'path': info if status == 'ok' else None,
            'error': info if status in ['fail', 'timeout'] else None
        }
        
        if status in ['fail', 'timeout']:
            failed_tracks.append({'title': title, 'artist': artist, 'error': info})
            print(f"   ❌ Failed: {info}")
        
        # Save manifest after each track
        MANIFEST_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(MANIFEST_FILE, 'w') as f:
            json.dump(downloaded, f, indent=2)
        
        # Small delay between downloads
        time.sleep(1)
    
    # Summary
    print()
    print("=" * 50)
    print("📊 SUMMARY")
    print("=" * 50)
    print(f"✅ Downloaded: {results['ok']}")
    print(f"⏭️  Skipped (exists): {results['skipped']}")
    print(f"❌ Failed: {results['failed']}")
    print(f"⏳ Timeout: {results['timeout']}")
    print(f"📁 Saved to: {DOWNLOAD_DIR}")
    print(f"📄 Manifest: {MANIFEST_FILE}")
    
    if failed_tracks:
        print()
        print("⚠️  Failed tracks:")
        for t in failed_tracks:
            print(f"  - {t['title']} - {t['artist']}: {t['error']}")

if __name__ == "__main__":
    main()
