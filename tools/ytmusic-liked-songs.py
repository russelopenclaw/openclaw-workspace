#!/usr/bin/env python3
"""
Download ALL liked songs from YouTube Music that aren't already on disk.
Strategy: Try direct video ID first, then fall back to YouTube search.
"""

import json
import subprocess
import sys
import time
from pathlib import Path
from ytmusicapi import YTMusic

DOWNLOAD_DIR = Path("/mnt/openclaw/music")
AUTH_FILE = Path("/home/kevin/.openclaw/workspace/ytmusic-auth.json")
PROGRESS_FILE = Path("/home/kevin/.ytmusic-downloader/liked-songs-progress.json")

def clean_name(s):
    return ''.join(c for c in s if c not in r'\/:*?"<>|')

def try_download(url, output_file, timeout=180):
    """Download from a URL. Returns True on success."""
    cmd = [
        'yt-dlp', '-x', '--audio-format', 'mp3', '--audio-quality', '0',
        '--embed-metadata', '--embed-thumbnail', '--add-metadata',
        '-o', str(output_file),
        '--socket-timeout', '30', '--retries', '3', url
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        if result.returncode == 0 and output_file.exists() and output_file.stat().st_size > 10000:
            return True
    except (subprocess.TimeoutExpired, Exception):
        pass
    return False

def fix_tags(filepath, artist, album, title, track_num):
    try:
        from mutagen.easyid3 import EasyID3
        audio = EasyID3(str(filepath))
        audio['artist'] = artist
        audio['albumartist'] = artist
        audio['album'] = album
        audio['title'] = title
        audio['tracknumber'] = [str(track_num)]
        audio['discnumber'] = ['1']
        audio.save(str(filepath))
    except Exception:
        pass

def main():
    print("🎵 Liked Songs Downloader (with search fallback)")
    print("=" * 60)
    
    ytm = YTMusic(str(AUTH_FILE))
    
    progress = {}
    if PROGRESS_FILE.exists():
        progress = json.load(open(PROGRESS_FILE))
    
    print("📋 Fetching liked songs...")
    liked = ytm.get_liked_songs(limit=5000)
    liked_tracks = liked.get('tracks', [])
    print(f"Total liked songs: {len(liked_tracks)}")
    
    to_download = []
    already_have = 0
    no_vid = 0
    
    for i, track in enumerate(liked_tracks, 1):
        video_id = track.get('videoId', '')
        title = track.get('title', 'Unknown')
        artists = track.get('artists', [])
        artist_name = artists[0].get('name', 'Unknown') if artists else 'Unknown'
        album = track.get('album', {})
        album_name = album.get('name', 'Unknown') if album else 'Unknown'
        
        if not video_id:
            no_vid += 1
            continue
        
        if progress.get(video_id, {}).get('status') == 'complete':
            already_have += 1
            continue
        
        artist_clean = clean_name(artist_name)
        album_clean = clean_name(album_name)
        title_clean = clean_name(title)
        
        # Check if already on disk
        artist_dir = DOWNLOAD_DIR / artist_clean
        found = False
        for search_dir in [artist_dir / album_clean, artist_dir]:
            if search_dir.exists():
                for mp3 in search_dir.glob("*.mp3"):
                    if title_clean[:20].lower() in mp3.stem.lower():
                        found = True
                        break
            if found:
                break
        
        if found:
            already_have += 1
            progress[video_id] = {'status': 'complete', 'title': title, 'artist': artist_name}
            continue
        
        to_download.append({
            'video_id': video_id,
            'title': title,
            'artist': artist_name,
            'album': album_name,
            'track_num': i,
            'artist_clean': artist_clean,
            'album_clean': album_clean,
            'title_clean': title_clean,
        })
    
    print(f"Already on disk: {already_have}")
    print(f"No video ID: {no_vid}")
    print(f"To download: {len(to_download)}")
    
    downloaded = 0
    failed = 0
    search_fallback = 0
    
    for i, track in enumerate(to_download, 1):
        video_id = track['video_id']
        title = track['title']
        artist = track['artist']
        album = track['album']
        artist_clean = track['artist_clean']
        album_clean = track['album_clean']
        title_clean = track['title_clean']
        track_num = track['track_num']
        
        album_dir = DOWNLOAD_DIR / artist_clean / album_clean
        album_dir.mkdir(parents=True, exist_ok=True)
        
        filename = f"{artist_clean}-{album_clean}-{track_num:02d}-{title_clean}.mp3"
        output_file = album_dir / filename
        
        print(f"  [{i:3d}/{len(to_download)}] {artist} - {title}", end=' ... ', flush=True)
        
        # Strategy 1: Try direct YouTube Music URL
        url = f"https://music.youtube.com/watch?v={video_id}"
        ok = try_download(url, output_file)
        
        # Strategy 2: Fall back to YouTube search
        if not ok:
            # Remove failed partial file
            if output_file.exists():
                output_file.unlink()
            query = f"{artist} {title}"
            search_url = f"ytsearch1:{query}"
            ok = try_download(search_url, output_file)
            if ok:
                search_fallback += 1
                print("✅ (search)", flush=True)
            else:
                print("❌", flush=True)
                failed += 1
                if output_file.exists():
                    output_file.unlink()
                progress[video_id] = {'status': 'failed', 'title': title, 'artist': artist}
                # Save progress every 10
                if i % 10 == 0:
                    with open(PROGRESS_FILE, 'w') as f:
                        json.dump(progress, f, indent=2)
                continue
        
        if ok:
            downloaded += 1
            if 'search' not in str(output_file):
                print("✅", flush=True)
            fix_tags(output_file, artist, album, title, track_num)
            progress[video_id] = {'status': 'complete', 'title': title, 'artist': artist}
        
        # Save progress every 10 tracks
        if i % 10 == 0:
            with open(PROGRESS_FILE, 'w') as f:
                json.dump(progress, f, indent=2)
    
    with open(PROGRESS_FILE, 'w') as f:
        json.dump(progress, f, indent=2)
    
    print()
    print("=" * 60)
    print("✅ LIKED SONGS DOWNLOAD COMPLETE!")
    print(f"   Downloaded: {downloaded} ({search_fallback} via search)")
    print(f"   Failed: {failed}")
    print(f"   Already on disk: {already_have}")
    print(f"   No video ID: {no_vid}")

if __name__ == '__main__':
    main()