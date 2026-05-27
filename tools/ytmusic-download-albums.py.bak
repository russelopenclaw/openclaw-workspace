#!/usr/bin/env python3
"""
Download ALL saved albums from YouTube Music
- Downloads complete albums only (marks complete when ALL tracks succeed)
- Fixes track numbers on existing songs
- Tracks progress per album (can resume incomplete albums)
- Proper Artist/Album/Artist-Album-TrackNum-Title.mp3 structure
"""

import json
import subprocess
import sys
import time
import os
from pathlib import Path
from ytmusicapi import YTMusic

# Configuration
DOWNLOAD_DIR = Path("/mnt/openclaw/music")
DOWNLOADED_FILE = Path("/home/kevin/.ytmusic-downloader/downloaded.json")
ALBUMS_FILE = Path("/home/kevin/.ytmusic-downloader/albums-complete.json")
ALBUM_PROGRESS_FILE = Path("/home/kevin/.ytmusic-downloader/albums-progress.json")
AUTH_FILE = Path("/home/kevin/.openclaw/workspace/ytmusic-auth.json")

def clean_name(s):
    """Remove invalid filename characters"""
    return ''.join(c for c in s if c not in r'\/:*?"<>|')

def download_track(video_id, title, artist, album, track_num, output_file, max_retries=3):
    """Download a single track with retry logic"""
    
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
                
                # Check if retryable error
                if 'timeout' in error_msg.lower() or 'HTTP Error 5' in error_msg:
                    if attempt < max_retries:
                        wait_time = attempt * 5
                        print(f"      ⏳ Timeout, retrying in {wait_time}s...")
                        time.sleep(wait_time)
                        continue
                    else:
                        return 'timeout', error_msg
                else:
                    return 'fail', error_msg
                    
        except subprocess.TimeoutExpired:
            if attempt < max_retries:
                wait_time = attempt * 5
                print(f"      ⏳ Timeout, retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                return 'timeout', 'Download timed out'
        except Exception as e:
            return 'error', str(e)
    
    return 'fail', 'Max retries exceeded'

def fix_existing_track_numbers(album_dir, tracks, artist_clean, album_clean):
    """Rename existing files to have correct track numbers"""
    fixed = 0
    
    for track in tracks:
        video_id = track.get('videoId')
        title = track.get('title', 'Unknown')
        track_num = track.get('trackNumber', 0) or 0
        title_clean = clean_name(title)
        track_formatted = f"{track_num:02d}"
        
        # Find existing files for this track
        for mp3_file in album_dir.glob(f"*-{title_clean}.mp3"):
            filename = mp3_file.name
            # Check if track number is wrong
            if f"-{track_formatted}-" not in filename:
                # Rename with correct track number
                new_filename = f"{artist_clean}-{album_clean}-{track_formatted}-{title_clean}.mp3"
                new_path = album_dir / new_filename
                try:
                    mp3_file.rename(new_path)
                    print(f"      🔄 Renamed: {filename} → {new_filename}")
                    fixed += 1
                except Exception as e:
                    print(f"      ⚠️  Could not rename: {e}")
    
    return fixed

def download_album(ytm, album_id, album_name, album_tracks):
    """Download a complete album - only returns success if ALL tracks downloaded"""
    
    print(f"\n💿 Album: {album_name} ({len(album_tracks)} tracks)")
    
    # Get first track to determine artist/album names
    if not album_tracks:
        print("   ⚠️  No tracks found")
        return False, 0, 0
    
    first_track = album_tracks[0]
    artists = first_track.get('artists', [])
    artist = artists[0].get('name', 'Unknown') if artists else 'Unknown'
    
    artist_clean = clean_name(artist)
    album_clean = clean_name(album_name)
    
    # Create directory
    album_dir = DOWNLOAD_DIR / artist_clean / album_clean
    album_dir.mkdir(parents=True, exist_ok=True)
    
    # Fix existing track numbers
    fixed = fix_existing_track_numbers(album_dir, album_tracks, artist_clean, album_clean)
    if fixed > 0:
        print(f"      ✅ Fixed {fixed} track numbers")
    
    # Download each track
    downloaded = 0
    failed = 0
    failed_tracks = []
    
    for i, track in enumerate(album_tracks, 1):
        video_id = track.get('videoId')
        title = track.get('title', 'Unknown')
        track_num = track.get('trackNumber', i) or i
        
        title_clean = clean_name(title)
        track_formatted = f"{track_num:02d}"
        
        # Filename
        filename = f"{artist_clean}-{album_clean}-{track_formatted}-{title_clean}.mp3"
        output_file = album_dir / filename
        
        # Check if already downloaded
        if output_file.exists():
            downloaded += 1
            print(f"   ⏭️  [{i:3d}] Track {track_num:02d}: {title} (exists)")
            continue
        
        # Download
        print(f"   ⬇️  [{i:3d}] Track {track_num:02d}: {title}", end='')
        result, error = download_track(video_id, title, artist, album_name, track_num, output_file)
        
        if result == 'ok':
            downloaded += 1
            print(f" ✅")
        else:
            failed += 1
            failed_tracks.append((i, title, error[:50] if error else 'unknown'))
            print(f" ❌ ({result})")
    
    # Only mark complete if ALL tracks downloaded
    if failed == 0 and downloaded == len(album_tracks):
        print(f"   ✅ Album COMPLETE: {downloaded}/{len(album_tracks)} tracks")
        return True, downloaded, failed
    else:
        print(f"   ⚠️  Album INCOMPLETE: {downloaded}/{len(album_tracks)} tracks, {failed} failed")
        if failed_tracks:
            print(f"   Failed tracks:")
            for num, title, reason in failed_tracks[:5]:
                print(f"      {num}. {title} ({reason})")
            if len(failed_tracks) > 5:
                print(f"      ... and {len(failed_tracks) - 5} more")
        return False, downloaded, failed

def main():
    print("🎵 YouTube Music - Complete Album Download")
    print("=" * 70)
    print("Downloading ALL saved albums (complete albums only)")
    print()
    
    # Load auth
    ytm = YTMusic(str(AUTH_FILE))
    
    # Load tracking
    if ALBUMS_FILE.exists():
        with open(ALBUMS_FILE) as f:
            completed_albums = set(json.load(f))
    else:
        completed_albums = set()
    
    if ALBUM_PROGRESS_FILE.exists():
        with open(ALBUM_PROGRESS_FILE) as f:
            progress = json.load(f)
    else:
        progress = {}
    
    # Load downloaded songs
    if DOWNLOADED_FILE.exists():
        with open(DOWNLOADED_FILE) as f:
            downloaded_songs = set(json.load(f))
    else:
        downloaded_songs = set()
    
    # Get all saved albums
    print("📋 Fetching saved albums...")
    albums = ytm.get_library_albums(limit=500)
    print(f"Total saved albums: {len(albums)}")
    print(f"Already completed: {len(completed_albums)}")
    print(f"To process: {len(albums) - len(completed_albums)}")
    print()
    
    # Process each album
    total_complete = 0
    total_incomplete = 0
    total_tracks = 0
    
    for i, album in enumerate(albums, 1):
        album_id = album.get('browseId')
        album_name = album.get('title', 'Unknown')
        
        # Skip completed albums
        if album_id in completed_albums:
            print(f"\n⏭️  [{i:3d}] Already complete: {album_name}")
            continue
        
        # Get album tracks
        try:
            album_data = ytm.get_album(album_id)
            album_tracks = album_data.get('tracks', [])
        except Exception as e:
            print(f"\n❌ [{i:3d}] Error fetching album {album_name}: {e}")
            progress[album_id] = {'name': album_name, 'status': 'error', 'error': str(e)}
            continue
        
        if not album_tracks:
            print(f"\n⚠️  [{i:3d}] No tracks found: {album_name}")
            continue
        
        # Download album
        complete, downloaded, failed = download_album(ytm, album_id, album_name, album_tracks)
        total_tracks += downloaded
        
        if complete:
            completed_albums.add(album_id)
            total_complete += 1
            # Remove from progress if complete
            if album_id in progress:
                del progress[album_id]
        else:
            total_incomplete += 1
            # Save progress for incomplete albums
            progress[album_id] = {
                'name': album_name,
                'status': 'incomplete',
                'downloaded': downloaded,
                'total': len(album_tracks),
                'failed': failed
            }
        
        # Save progress every 5 albums
        if i % 5 == 0:
            with open(ALBUMS_FILE, 'w') as f:
                json.dump(list(completed_albums), f)
            with open(ALBUM_PROGRESS_FILE, 'w') as f:
                json.dump(progress, f, indent=2)
            with open(DOWNLOADED_FILE, 'w') as f:
                json.dump(list(downloaded_songs), f)
            print(f"\n   ... Progress saved ({i}/{len(albums)} albums) ...")
    
    # Save final state
    with open(ALBUMS_FILE, 'w') as f:
        json.dump(list(completed_albums), f)
    with open(ALBUM_PROGRESS_FILE, 'w') as f:
        json.dump(progress, f, indent=2)
    with open(DOWNLOADED_FILE, 'w') as f:
        json.dump(list(downloaded_songs), f)
    
    # Summary
    print()
    print("=" * 70)
    print("✅ ALBUM DOWNLOAD COMPLETE!")
    print()
    print(f"   Albums completed:    {total_complete}")
    print(f"   Albums incomplete:   {total_incomplete}")
    print(f"   Total tracks:        {total_tracks}")
    print(f"   Completed albums:    {len(completed_albums)} total")
    print()
    
    if progress:
        print(f"⚠️  Incomplete albums ({len(progress)}):")
        for album_id, info in list(progress.items())[:10]:
            name = info.get('name', 'Unknown')
            downloaded = info.get('downloaded', 0)
            total = info.get('total', 0)
            print(f"   • {name} ({downloaded}/{total} tracks)")
        if len(progress) > 10:
            print(f"   ... and {len(progress) - 10} more")
        print()
        print(f"💡 Run again to complete incomplete albums")
    
    print(f"📁 Location: {DOWNLOAD_DIR}")

if __name__ == '__main__':
    main()
