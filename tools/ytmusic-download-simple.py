#!/usr/bin/env python3
"""
Simple YouTube Music Downloader
Downloads liked songs with progress tracking
"""

import json
import subprocess
import sys
from pathlib import Path
from datetime import datetime
from ytmusicapi import YTMusic

# Configuration
DOWNLOAD_DIR = Path("/mnt/openclaw/music")
DB_FILE = Path.home() / ".ytmusic-downloader" / "ytmusic-downloads.db"
AUTH_FILE = Path("ytmusic-auth.json")

class SimpleDownloader:
    def __init__(self):
        # Ensure directories exist
        DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
        DB_FILE.parent.mkdir(parents=True, exist_ok=True)
        
        # Load auth
        self.ytm = YTMusic(str(AUTH_FILE))
        print(f"✅ Authenticated")
        
        # Load/downloaded list
        self.downloaded_file = DB_FILE.parent / "downloaded.json"
        if self.downloaded_file.exists():
            with open(self.downloaded_file) as f:
                self.downloaded = set(json.load(f))
        else:
            self.downloaded = set()
        
        print(f"📊 Already downloaded: {len(self.downloaded)} songs")
    
    def save_progress(self):
        with open(self.downloaded_file, 'w') as f:
            json.dump(list(self.downloaded), f)
    
    def download_song(self, video_id, title, artist):
        if video_id in self.downloaded:
            return 'skip'
        
        url = f"https://music.youtube.com/watch?v={video_id}"
        output = str(DOWNLOAD_DIR / "%(artist)s" / "%(album)s" / "%(track_number)02d - %(title)s.%(ext)s")
        
        cmd = [
            'yt-dlp',
            '-x', '--audio-format', 'mp3', '--audio-quality', '0',
            '--embed-metadata', '--embed-thumbnail', '--add-metadata',
            '-o', output,
            '--no-cookies',
            '--no-warnings',
            url
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            if result.returncode == 0:
                self.downloaded.add(video_id)
                self.save_progress()
                return 'ok'
            else:
                return f'fail: {result.stderr[:100]}'
        except subprocess.TimeoutExpired:
            return 'timeout'
        except Exception as e:
            return f'error: {e}'
    
    def download_liked(self, limit=100):
        print(f"\n❤️  Getting liked songs (limit: {limit})...")
        liked = self.ytm.get_liked_songs(limit=limit)
        tracks = liked.get('tracks', [])
        print(f"   Found {len(tracks)} songs")
        
        ok = skip = fail = 0
        for i, track in enumerate(tracks, 1):
            video_id = track.get('videoId')
            title = track.get('title', 'Unknown')
            artists = track.get('artists', [])
            artist = artists[0].get('name', 'Unknown') if artists else 'Unknown'
            
            if not video_id:
                continue
            
            result = self.download_song(video_id, title, artist)
            
            if result == 'ok':
                ok += 1
                print(f"  ✅ [{i}/{len(tracks)}] {artist} - {title}")
            elif result == 'skip':
                skip += 1
            else:
                fail += 1
                print(f"  ❌ [{i}/{len(tracks)}] {artist} - {title}: {result}")
            
            # Progress every 10
            if i % 10 == 0:
                print(f"  ... {i}/{len(tracks)} processed ...")
        
        print(f"\n✅ Done! {ok} downloaded, {skip} skipped, {fail} failed")
        return ok

if __name__ == '__main__':
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    dl = SimpleDownloader()
    dl.download_liked(limit)
