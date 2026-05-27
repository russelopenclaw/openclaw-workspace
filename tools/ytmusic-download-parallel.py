#!/usr/bin/env python3
"""
Download saved albums from YouTube Music with 4 parallel workers.
Resumes from progress files, skips completed albums and existing tracks.
"""

import json
import subprocess
import sys
import time
import os
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from ytmusicapi import YTMusic

# Configuration
DOWNLOAD_DIR = Path("/mnt/openclaw/music")
DOWNLOADED_FILE = Path("/home/kevin/.ytmusic-downloader/downloaded.json")
ALBUMS_FILE = Path("/home/kevin/.ytmusic-downloader/albums-complete.json")
ALBUM_PROGRESS_FILE = Path("/home/kevin/.ytmusic-downloader/albums-progress.json")
AUTH_FILE = Path("/home/kevin/.openclaw/workspace/ytmusic-auth.json")
MAX_WORKERS = 4

def clean_name(s):
    return ''.join(c for c in s if c not in r'\/:*?"<>|')

def download_track(video_id, title, artist, album, track_num, output_file, max_retries=2):
    url = f"https://music.youtube.com/watch?v={video_id}"
    cmd = [
        'yt-dlp', '-x', '--audio-format', 'mp3', '--audio-quality', '0',
        '--embed-metadata', '--embed-thumbnail', '--add-metadata',
        '-o', str(output_file),
        '--no-cookies', '--no-warnings',
        '--socket-timeout', '30', '--retries', '3', url
    ]
    for attempt in range(1, max_retries + 1):
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            if result.returncode == 0:
                return 'ok', None
            error_msg = result.stderr[:200] if result.stderr else 'Unknown error'
            if 'timeout' in error_msg.lower() or 'HTTP Error 5' in error_msg:
                if attempt < max_retries:
                    time.sleep(attempt * 5)
                    continue
            return 'fail', error_msg
        except subprocess.TimeoutExpired:
            if attempt < max_retries:
                time.sleep(attempt * 5)
            else:
                return 'timeout', 'Timed out'
        except Exception as e:
            return 'error', str(e)
    return 'fail', 'Max retries'

def download_album(args):
    """Download a single album. Returns (album_id, album_name, complete, downloaded, failed)"""
    album_id, album_name, album_tracks = args
    
    if not album_tracks:
        return (album_id, album_name, False, 0, 0)
    
    first_track = album_tracks[0]
    artists = first_track.get('artists', [])
    artist = artists[0].get('name', 'Unknown') if artists else 'Unknown'
    artist_clean = clean_name(artist)
    album_clean = clean_name(album_name)
    album_dir = DOWNLOAD_DIR / artist_clean / album_clean
    album_dir.mkdir(parents=True, exist_ok=True)
    
    downloaded = 0
    failed = 0
    
    for i, track in enumerate(album_tracks, 1):
        video_id = track.get('videoId')
        title = track.get('title', 'Unknown')
        track_num = track.get('trackNumber', i) or i
        title_clean = clean_name(title)
        track_formatted = f"{track_num:02d}"
        filename = f"{artist_clean}-{album_clean}-{track_formatted}-{title_clean}.mp3"
        output_file = album_dir / filename
        
        if output_file.exists():
            downloaded += 1
            continue
        
        result, error = download_track(video_id, title, artist, album_name, track_num, output_file)
        if result == 'ok':
            downloaded += 1
            print(f"  ✅ {album_name[:30]} - Track {track_num:02d}")
        else:
            failed += 1
            print(f"  ❌ {album_name[:30]} - Track {track_num:02d} ({result})")
    
    complete = (failed == 0 and downloaded == len(album_tracks))
    return (album_id, album_name, complete, downloaded, failed)

def main():
    print("🎵 YouTube Music - Parallel Album Download (4 workers)")
    print("=" * 60)
    
    ytm = YTMusic(str(AUTH_FILE))
    
    if ALBUMS_FILE.exists():
        completed_albums = set(json.load(open(ALBUMS_FILE)))
    else:
        completed_albums = set()
    
    progress = {}
    if ALBUM_PROGRESS_FILE.exists():
        progress = json.load(open(ALBUM_PROGRESS_FILE))
    
    print("📋 Fetching saved albums...")
    albums = ytm.get_library_albums(limit=500)
    print(f"Total: {len(albums)}, Completed: {len(completed_albums)}, To do: {len(albums) - len(completed_albums)}")
    
    # Build work list: fetch album details for incomplete albums
    work_items = []
    for album in albums:
        album_id = album.get('browseId')
        album_name = album.get('title', 'Unknown')
        if album_id in completed_albums:
            continue
        try:
            album_data = ytm.get_album(album_id)
            album_tracks = album_data.get('tracks', [])
            if album_tracks:
                work_items.append((album_id, album_name, album_tracks))
        except Exception as e:
            print(f"❌ Error fetching {album_name}: {e}")
            progress[album_id] = {'name': album_name, 'status': 'error', 'error': str(e)}
    
    print(f"\n🔄 Downloading {len(work_items)} albums with {MAX_WORKERS} workers...\n")
    
    total_complete = 0
    total_tracks = 0
    total_failed_albums = 0
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(download_album, item): item for item in work_items}
        
        for future in as_completed(futures):
            album_id, album_name, complete, downloaded, failed = future.result()
            total_tracks += downloaded
            
            if complete:
                completed_albums.add(album_id)
                total_complete += 1
                progress.pop(album_id, None)
                print(f"💿 COMPLETE: {album_name}")
            else:
                total_failed_albums += 1
                progress[album_id] = {
                    'name': album_name, 'status': 'incomplete',
                    'downloaded': downloaded, 'total': downloaded + failed, 'failed': failed
                }
    
    # Save state
    with open(ALBUMS_FILE, 'w') as f:
        json.dump(list(completed_albums), f)
    with open(ALBUM_PROGRESS_FILE, 'w') as f:
        json.dump(progress, f, indent=2)
    
    print("\n" + "=" * 60)
    print(f"✅ Done! {total_complete} complete, {total_failed_albums} incomplete, {total_tracks} tracks")
    if progress:
        print(f"⚠️  {len(progress)} albums still incomplete")
    print(f"📁 {DOWNLOAD_DIR}")

if __name__ == '__main__':
    main()