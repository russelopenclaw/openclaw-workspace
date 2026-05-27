#!/usr/bin/env python3
"""
Download ALL liked songs from YouTube Music
- Downloads everything (ignores existing manifest)
- Retries failed downloads (especially timeouts)
- Proper Artist/Album structure
"""

import json
import subprocess
import sys
import time
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

def download_song(video_id, title, artist, album, track_num, ytm, max_retries=3):
    """Download a single song with retry logic"""
    
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
    
    # Download with retries
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
                return 'ok', None
            else:
                error_msg = result.stderr[:200] if result.stderr else 'Unknown error'
                
                # Check if it's a timeout or temporary error
                if 'timeout' in error_msg.lower() or 'timed out' in error_msg.lower() or 'HTTP Error 5' in error_msg:
                    if attempt < max_retries:
                        wait_time = attempt * 5  # 5s, 10s, 15s
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
            else:
                return 'timeout', 'Download timed out after all retries'
        except Exception as e:
            return f'error', str(e)
    
    return 'fail', 'Max retries exceeded'

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
    print("🎵 YouTube Music - Complete Library Download")
    print("=" * 60)
    print("Downloading ALL liked songs (with retry on failures)")
    print()
    
    # Load auth
    ytm = YTMusic(str(AUTH_FILE))
    
    # Clear manifest to start fresh
    downloaded = set()
    
    # Get liked songs
    print("📋 Fetching liked songs...")
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 1000
    liked = ytm.get_liked_songs(limit=limit)
    tracks = liked.get('tracks', [])
    
    print(f"Total liked songs: {len(tracks)}")
    print(f"Will attempt to download: {len(tracks)}")
    print()
    
    # Download each track
    ok = fail = timeout = 0
    failed_list = []
    
    for i, track in enumerate(tracks, 1):
        video_id = track.get('videoId')
        if not video_id:
            continue
        
        title = track.get('title', 'Unknown')
        artists = track.get('artists', [])
        artist = artists[0].get('name', 'Unknown') if artists else 'Unknown'
        album_info = track.get('album')
        album = album_info.get('name', 'Unknown') if album_info else 'Unknown'
        
        # Get track number
        track_num = get_track_number(track, ytm)
        
        # Download
        print(f"⬇️  [{i:3d}] {artist} - {title}", end='')
        result, error = download_song(video_id, title, artist, album, track_num, ytm)
        
        if result == 'ok':
            downloaded.add(video_id)
            ok += 1
            print(f" ✅")
        elif result == 'timeout':
            timeout += 1
            fail += 1
            failed_list.append((i, artist, title, 'timeout'))
            print(f" ⏱️ (timeout)")
        else:
            fail += 1
            failed_list.append((i, artist, title, error[:50] if error else 'unknown'))
            print(f" ❌ ({result})")
        
        # Save progress every 20 songs
        if i % 20 == 0:
            with open(DOWNLOADED_FILE, 'w') as f:
                json.dump(list(downloaded), f)
            print(f"     ... Progress saved ({i} songs, {ok} ok, {fail} failed) ...")
    
    # Save final state
    with open(DOWNLOADED_FILE, 'w') as f:
        json.dump(list(downloaded), f)
    with open(ALBUMS_FILE, 'w') as f:
        json.dump([], f)
    
    # Summary
    print()
    print("=" * 60)
    print(f"✅ Complete!")
    print(f"   Downloaded: {ok}")
    print(f"   Failed:     {fail} ({timeout} timeouts)")
    print(f"   Total:      {len(downloaded)} songs")
    print()
    
    # Show failed songs
    if failed_list:
        print(f"❌ Failed downloads ({len(failed_list)}):")
        for num, artist, title, reason in failed_list[:20]:
            print(f"   {num}. {artist} - {title} ({reason})")
        if len(failed_list) > 20:
            print(f"   ... and {len(failed_list) - 20} more")
        print()
    
    print(f"📁 Location: {DOWNLOAD_DIR}")

if __name__ == '__main__':
    main()
