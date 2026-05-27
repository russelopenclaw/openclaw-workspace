#!/usr/bin/env python3
"""Download remaining liked songs"""

import json
import subprocess
import sys
from pathlib import Path
from ytmusicapi import YTMusic

DOWNLOAD_DIR = Path("/mnt/openclaw/music")
DOWNLOADED_FILE = Path("/home/kevin/.ytmusic-downloader/downloaded.json")
AUTH_FILE = Path("/home/kevin/.openclaw/workspace/ytmusic-auth.json")

def clean_name(s):
    return ''.join(c for c in s if c not in r'\/:*?"<>|')

def main():
    print("🎵 Downloading remaining liked songs")
    print("=" * 40)
    
    # Load auth
    ytm = YTMusic(str(AUTH_FILE))
    
    # Load already downloaded
    if DOWNLOADED_FILE.exists():
        with open(DOWNLOADED_FILE) as f:
            downloaded = set(json.load(f))
    else:
        downloaded = set()
    
    print(f"Already downloaded: {len(downloaded)} songs")
    
    # Get all liked songs
    liked = ytm.get_liked_songs(limit=600)
    tracks = liked.get('tracks', [])
    print(f"Total liked: {len(tracks)}")
    
    # Filter to new songs
    new_tracks = []
    for track in tracks:
        video_id = track.get('videoId')
        if video_id and video_id not in downloaded:
            new_tracks.append(track)
    
    print(f"New songs to download: {len(new_tracks)}")
    print()
    
    if not new_tracks:
        print("✅ All liked songs already downloaded!")
        return
    
    # Download each
    ok = skip = fail = 0
    for i, track in enumerate(new_tracks, 1):
        video_id = track.get('videoId')
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
        
        # Clean names
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
            print(f"⏭️  [{i}/{len(new_tracks)}] {artist} - {title}")
            continue
        
        print(f"⬇️  [{i}/{len(new_tracks)}] {artist} - {title}")
        
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
                downloaded.add(video_id)
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
        
        # Save progress every 20 songs
        if i % 20 == 0:
            with open(DOWNLOADED_FILE, 'w') as f:
                json.dump(list(downloaded), f)
            print(f"  ... {i}/{len(new_tracks)} ...")
    
    # Save final state
    with open(DOWNLOADED_FILE, 'w') as f:
        json.dump(list(downloaded), f)
    
    print()
    print("=" * 40)
    print(f"✅ Complete: {ok} downloaded, {skip} skipped, {fail} failed")
    print(f"Total tracked: {len(downloaded)} songs")

if __name__ == '__main__':
    main()
