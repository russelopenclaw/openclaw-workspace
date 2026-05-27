#!/usr/bin/env python3
"""
Download favorite songs from YouTube Music
Clean, simple downloader with proper Artist/Album structure
"""

import json
import subprocess
import sys
from pathlib import Path
from ytmusicapi import YTMusic

# Configuration
DOWNLOAD_DIR = Path("/mnt/openclaw/music")
DOWNLOADED_FILE = Path("/home/kevin/.ytmusic-downloader/downloaded.json")
ALBUMS_FILE = Path("/home/kevin/.ytmusic-downloader/albums.json")
AUTH_FILE = Path("/home/kevin/.openclaw/workspace/ytmusic-auth.json")

def clean_name(s):
    """Remove invalid filename characters"""
    return ''.join(c for c in s if c not in r'\/:*?"<>|')

def download_song(video_id, title, artist, album, track_num, ytm):
    """Download a single song"""
    
    # Clean names
    artist_clean = clean_name(artist)
    album_clean = clean_name(album)
    title_clean = clean_name(title)
    track_formatted = f"{track_num:02d}"
    
    # Create directory: Artist/Album/
    album_dir = DOWNLOAD_DIR / artist_clean / album_clean
    album_dir.mkdir(parents=True, exist_ok=True)
    
    # Filename: Artist-Album-TrackNum-Title.mp3
    filename = f"{artist_clean}-{album_clean}-{track_formatted}-{title_clean}.mp3"
    output_file = album_dir / filename
    
    # Check if already downloaded
    if output_file.exists():
        return 'skip'
    
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
            return 'ok'
        else:
            return 'fail'
    except subprocess.TimeoutExpired:
        return 'timeout'
    except Exception as e:
        return f'error:{e}'

def get_track_number(track, ytm):
    """Get track number, fetching from album if needed"""
    track_num = track.get('trackNumber', 0) or 0
    
    # If no track number, try to get from album
    if not track_num:
        album_info = track.get('album')
        if album_info:
            album_id = album_info.get('id')
            if album_id:
                try:
                    album_data = ytm.get_album(album_id)
                    for at in album_data.get('tracks', []):
                        if at.get('videoId') == track.get('videoId'):
                            track_num = at.get('trackNumber', 0) or 0
                            break
                except:
                    pass
    
    return track_num

def main():
    print("🎵 YouTube Music - Downloading Favorites")
    print("=" * 50)
    
    # Load auth
    ytm = YTMusic(str(AUTH_FILE))
    
    # Load tracking
    if DOWNLOADED_FILE.exists():
        with open(DOWNLOADED_FILE) as f:
            downloaded = set(json.load(f))
    else:
        downloaded = set()
    
    # Get liked songs
    print("📋 Fetching liked songs...")
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 100
    liked = ytm.get_liked_songs(limit=limit)
    tracks = liked.get('tracks', [])
    
    print(f"Total liked: {len(tracks)}")
    print(f"Already downloaded: {len(downloaded)}")
    print(f"Will download: {len([t for t in tracks if t.get('videoId') not in downloaded])}")
    print()
    
    # Download each track
    ok = skip = fail = 0
    for i, track in enumerate(tracks, 1):
        video_id = track.get('videoId')
        if not video_id:
            continue
        
        title = track.get('title', 'Unknown')
        artists = track.get('artists', [])
        artist = artists[0].get('name', 'Unknown') if artists else 'Unknown'
        album_info = track.get('album', {})
        album = album_info.get('name', 'Unknown') if album_info else 'Unknown'
        
        # Get track number
        track_num = get_track_number(track, ytm)
        
        # Check if already tracked
        if video_id in downloaded:
            skip += 1
            print(f"⏭️  [{i:3d}] {artist} - {title}")
            continue
        
        # Download
        print(f"⬇️  [{i:3d}] {artist} - {title}", end='')
        result = download_song(video_id, title, artist, album, track_num, ytm)
        
        if result == 'ok':
            downloaded.add(video_id)
            ok += 1
            print(f" ✅")
        elif result == 'skip':
            skip += 1
            print(f" ⏭️ (exists)")
        else:
            fail += 1
            print(f" ❌ ({result})")
        
        # Save progress every 20 songs
        if i % 20 == 0:
            with open(DOWNLOADED_FILE, 'w') as f:
                json.dump(list(downloaded), f)
            print(f"     ... Progress saved ({i} songs) ...")
    
    # Save final state
    with open(DOWNLOADED_FILE, 'w') as f:
        json.dump(list(downloaded), f)
    with open(ALBUMS_FILE, 'w') as f:
        json.dump([], f)
    
    # Summary
    print()
    print("=" * 50)
    print(f"✅ Complete!")
    print(f"   Downloaded: {ok}")
    print(f"   Skipped:    {skip}")
    print(f"   Failed:     {fail}")
    print(f"   Total:      {len(downloaded)} songs tracked")
    print()
    print(f"📁 Location: {DOWNLOAD_DIR}")

if __name__ == '__main__':
    main()
