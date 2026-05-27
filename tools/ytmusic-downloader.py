#!/usr/bin/env python3
"""
YouTube Music Library Downloader (v2 - SQLite + SMB support)

Downloads liked songs, saved albums, and playlists from YouTube Music.
Uses SQLite for efficient tracking of thousands of songs.
"""

import json
import os
import subprocess
import sys
import sqlite3
from pathlib import Path
from datetime import datetime
from contextlib import contextmanager
from ytmusicapi import YTMusic

# Configuration
DOWNLOAD_DIR = "/mnt/openclaw/music"  # Download directory (SMB share)
LOCAL_DB_DIR = Path.home() / ".ytmusic-downloader"  # Local database location
DB_FILE = "ytmusic-downloads.db"
AUTH_FILE = "ytmusic-auth.json"

class DownloadDatabase:
    """SQLite database for tracking downloads (efficient for thousands of songs)"""
    
    def __init__(self, db_path):
        self.db_path = Path(db_path)
        self._init_db()
    
    @contextmanager
    def get_connection(self):
        """Context manager for database connections"""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()
    
    def _init_db(self):
        """Initialize database schema"""
        with self.get_connection() as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS downloads (
                    video_id TEXT PRIMARY KEY,
                    title TEXT,
                    artist TEXT,
                    album TEXT,
                    track_number INTEGER,
                    year TEXT,
                    source TEXT,
                    file_path TEXT,
                    downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    status TEXT DEFAULT 'pending'
                )
            ''')
            
            conn.execute('''
                CREATE TABLE IF NOT EXISTS albums (
                    album_id TEXT PRIMARY KEY,
                    album_name TEXT,
                    total_tracks INTEGER,
                    downloaded_tracks INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'pending',
                    started_at TIMESTAMP,
                    completed_at TIMESTAMP
                )
            ''')
            
            conn.execute('''
                CREATE TABLE IF NOT EXISTS playlists (
                    playlist_id TEXT PRIMARY KEY,
                    playlist_name TEXT,
                    total_tracks INTEGER,
                    downloaded_tracks INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'pending',
                    started_at TIMESTAMP,
                    completed_at TIMESTAMP
                )
            ''')
            
            # Index for fast lookups
            conn.execute('CREATE INDEX IF NOT EXISTS idx_status ON downloads(status)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_source ON downloads(source)')
    
    def is_downloaded(self, video_id):
        """Check if song is already downloaded"""
        with self.get_connection() as conn:
            cursor = conn.execute('SELECT 1 FROM downloads WHERE video_id = ?', (video_id,))
            return cursor.fetchone() is not None
    
    def mark_downloaded(self, video_id, metadata, file_path=None):
        """Mark a song as downloaded"""
        with self.get_connection() as conn:
            conn.execute('''
                INSERT OR REPLACE INTO downloads 
                (video_id, title, artist, album, track_number, year, source, file_path, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed')
            ''', (
                video_id,
                metadata.get('title'),
                metadata.get('artist'),
                metadata.get('album'),
                metadata.get('track_number'),
                metadata.get('year'),
                metadata.get('source', 'unknown'),
                file_path
            ))
    
    def start_album(self, album_id, album_name, total_tracks):
        """Mark album as being processed"""
        with self.get_connection() as conn:
            conn.execute('''
                INSERT OR REPLACE INTO albums 
                (album_id, album_name, total_tracks, status, started_at)
                VALUES (?, ?, ?, 'in_progress', CURRENT_TIMESTAMP)
            ''', (album_id, album_name, total_tracks))
    
    def update_album_track(self, album_id):
        """Increment downloaded track count for album"""
        with self.get_connection() as conn:
            conn.execute('''
                UPDATE albums 
                SET downloaded_tracks = downloaded_tracks + 1
                WHERE album_id = ?
            ''', (album_id,))
            
            # Check if album is complete
            cursor = conn.execute('''
                SELECT total_tracks, downloaded_tracks FROM albums WHERE album_id = ?
            ''', (album_id,))
            row = cursor.fetchone()
            if row and row['downloaded_tracks'] >= row['total_tracks']:
                conn.execute('''
                    UPDATE albums SET status = 'completed', completed_at = CURRENT_TIMESTAMP
                    WHERE album_id = ?
                ''', (album_id,))
                return True  # Album complete
            return False
    
    def is_album_complete(self, album_id):
        """Check if album was fully downloaded"""
        with self.get_connection() as conn:
            cursor = conn.execute('SELECT status FROM albums WHERE album_id = ?', (album_id,))
            row = cursor.fetchone()
            return row and row['status'] == 'completed'
    
    def start_playlist(self, playlist_id, playlist_name, total_tracks):
        """Mark playlist as being processed"""
        with self.get_connection() as conn:
            conn.execute('''
                INSERT OR REPLACE INTO playlists 
                (playlist_id, playlist_name, total_tracks, status, started_at)
                VALUES (?, ?, ?, 'in_progress', CURRENT_TIMESTAMP)
            ''', (playlist_id, playlist_name, total_tracks))
    
    def update_playlist_track(self, playlist_id):
        """Increment downloaded track count for playlist"""
        with self.get_connection() as conn:
            conn.execute('''
                UPDATE playlists 
                SET downloaded_tracks = downloaded_tracks + 1
                WHERE playlist_id = ?
            ''', (playlist_id,))
    
    def get_stats(self):
        """Get download statistics"""
        with self.get_connection() as conn:
            stats = {}
            
            cursor = conn.execute('SELECT COUNT(*) as count FROM downloads WHERE status = "completed"')
            stats['songs'] = cursor.fetchone()['count']
            
            cursor = conn.execute('SELECT COUNT(*) as count FROM albums WHERE status = "completed"')
            stats['albums'] = cursor.fetchone()['count']
            
            cursor = conn.execute('SELECT COUNT(*) as count FROM playlists WHERE status = "completed"')
            stats['playlists'] = cursor.fetchone()['count']
            
            return stats


class YTMusicDownloader:
    def __init__(self, auth_file=AUTH_FILE, download_dir=DOWNLOAD_DIR):
        self.auth_file = Path(auth_file)
        self.download_dir = Path(download_dir)
        
        # Store database locally (SQLite doesn't work well over SMB)
        LOCAL_DB_DIR.mkdir(parents=True, exist_ok=True)
        self.db_path = LOCAL_DB_DIR / DB_FILE
        
        # Load authentication
        if not self.auth_file.exists():
            print(f"❌ Auth file not found: {self.auth_file}")
            sys.exit(1)
        
        self.ytm = YTMusic(str(self.auth_file))
        print(f"✅ Authenticated as YouTube Music user")
        
        # Create download directory
        self.download_dir.mkdir(parents=True, exist_ok=True)
        print(f"📁 Download directory: {self.download_dir}")
        
        # Initialize database
        self.db = DownloadDatabase(self.db_path)
        stats = self.db.get_stats()
        print(f"📊 Database: {stats['songs']} songs, {stats['albums']} albums, {stats['playlists']} playlists")
    
    def get_liked_songs(self, limit=5000):
        """Get all liked songs"""
        print("\n❤️  Fetching liked songs...")
        try:
            songs = self.ytm.get_liked_songs(limit=limit)
            count = songs.get('trackCount', len(songs.get('tracks', [])))
            print(f"   Found {count} liked songs")
            return songs.get('tracks', [])
        except Exception as e:
            print(f"   ❌ Error: {e}")
            return []
    
    def get_saved_albums(self, limit=1000):
        """Get all saved albums"""
        print("\n💿 Fetching saved albums...")
        try:
            albums = self.ytm.get_library_albums(limit=limit)
            print(f"   Found {len(albums)} saved albums")
            return albums
        except Exception as e:
            print(f"   ❌ Error: {e}")
            return []
    
    def get_library_playlists(self, limit=500):
        """Get all playlists"""
        print("\n📋 Fetching playlists...")
        try:
            playlists = self.ytm.get_library_playlists(limit=limit)
            print(f"   Found {len(playlists)} playlists")
            return playlists
        except Exception as e:
            print(f"   ❌ Error: {e}")
            return []
    
    def get_album_tracks(self, album_id):
        """Get all tracks from an album"""
        try:
            album = self.ytm.get_album(album_id)
            return album.get('tracks', [])
        except Exception as e:
            print(f"   ❌ Error: {e}")
            return []
    
    def get_playlist_tracks(self, playlist_id):
        """Get all tracks from a playlist"""
        try:
            playlist = self.ytm.get_playlist(playlist_id, limit=5000)
            return playlist.get('tracks', [])
        except Exception as e:
            print(f"   ❌ Error: {e}")
            return []
    
    def download_song(self, video_id, metadata):
        """Download a single song with metadata"""
        if self.db.is_downloaded(video_id):
            return False
        
        url = f"https://music.youtube.com/watch?v={video_id}"
        
        # Output template: Artist/Album/Track - Title.mp3
        output_template = str(self.download_dir / "%(artist)s" / "%(album)s" / "%(track_number)02d - %(title)s.%(ext)s")
        
        cmd = [
            'yt-dlp',
            '--extract-audio',
            '--audio-format', 'mp3',
            '--audio-quality', '0',
            '--embed-metadata',
            '--embed-thumbnail',
            '--add-metadata',
            '--output', output_template,
            '--no-cookies',  # Don't require browser cookies
            url
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            if result.returncode == 0:
                # Try to extract the actual file path from output
                file_path = None
                for line in result.stdout.split('\n'):
                    if 'Destination' in line or 'Merging formats' in line:
                        file_path = line.split(':')[-1].strip()
                
                self.db.mark_downloaded(video_id, metadata, file_path)
                return True
            else:
                print(f"      ❌ Failed: {result.stderr[:100]}")
                return False
        except subprocess.TimeoutExpired:
            print(f"      ❌ Timeout")
            return False
        except Exception as e:
            print(f"      ❌ Error: {e}")
            return False
    
    def download_album(self, album_id, album_name):
        """Download album - only mark complete if ALL tracks succeed"""
        if self.db.is_album_complete(album_id):
            print(f"   ⏭️  Album already complete: {album_name}")
            return 0
        
        print(f"\n💿 Downloading album: {album_name}")
        tracks = self.get_album_tracks(album_id)
        
        if not tracks:
            print(f"   ⚠️  No tracks found")
            return 0
        
        # Mark album as in-progress
        self.db.start_album(album_id, album_name, len(tracks))
        
        downloaded = 0
        failed = 0
        
        for track in tracks:
            video_id = track.get('videoId')
            if not video_id:
                continue
            
            if self.db.is_downloaded(video_id):
                downloaded += 1
                self.db.update_album_track(album_id)
                continue
            
            metadata = {
                'title': track.get('title'),
                'artist': track.get('artists', [{}])[0].get('name') if track.get('artists') else None,
                'album': album_name,
                'track_number': track.get('trackNumber'),
                'year': track.get('year'),
                'source': f'album:{album_id}'
            }
            
            if self.download_song(video_id, metadata):
                downloaded += 1
                self.db.update_album_track(album_id)
            else:
                failed += 1
        
        # Only mark complete if ALL tracks downloaded
        if failed == 0 and downloaded == len(tracks):
            print(f"   ✅ Album complete: {downloaded}/{len(tracks)} tracks")
        elif failed > 0:
            print(f"   ⚠️  Album incomplete: {downloaded}/{len(tracks)} tracks, {failed} failed")
        
        return downloaded
    
    def download_playlist(self, playlist_id, playlist_name):
        """Download playlist"""
        print(f"\n📋 Downloading playlist: {playlist_name}")
        tracks = self.get_playlist_tracks(playlist_id)
        
        if not tracks:
            print(f"   ⚠️  No tracks found")
            return 0
        
        self.db.start_playlist(playlist_id, playlist_name, len(tracks))
        
        downloaded = 0
        for i, track in enumerate(tracks, 1):
            video_id = track.get('videoId')
            if not video_id:
                continue
            
            if self.db.is_downloaded(video_id):
                downloaded += 1
                self.db.update_playlist_track(playlist_id)
                continue
            
            metadata = {
                'title': track.get('title'),
                'artist': track.get('artists', [{}])[0].get('name') if track.get('artists') else None,
                'album': playlist_name,
                'track_number': i,
                'source': f'playlist:{playlist_id}'
            }
            
            if self.download_song(video_id, metadata):
                downloaded += 1
                self.db.update_playlist_track(playlist_id)
            
            if i % 20 == 0:
                print(f"   Progress: {i}/{len(tracks)}...")
        
        print(f"   ✅ Playlist: {downloaded}/{len(tracks)} tracks")
        return downloaded
    
    def download_liked_songs(self, limit=5000):
        """Download all liked songs"""
        print("\n" + "="*60)
        print("❤️  DOWNLOADING LIKED SONGS")
        print("="*60)
        
        songs = self.get_liked_songs(limit=limit)
        downloaded = 0
        skipped = 0
        
        for i, song in enumerate(songs, 1):
            video_id = song.get('videoId')
            if not video_id:
                continue
            
            if self.db.is_downloaded(video_id):
                skipped += 1
                continue
            
            metadata = {
                'title': song.get('title'),
                'artist': song.get('artists', [{}])[0].get('name') if song.get('artists') else None,
                'album': song.get('album', {}).get('name') if song.get('album') else None,
                'source': 'liked_songs'
            }
            
            if self.download_song(video_id, metadata):
                downloaded += 1
            
            if i % 50 == 0:
                print(f"   Progress: {i}/{len(songs)}... ({downloaded} new, {skipped} skipped)")
        
        print(f"\n✅ Liked songs: {downloaded} new, {skipped} skipped")
        return downloaded
    
    def download_all_albums(self, limit=1000):
        """Download all saved albums"""
        print("\n" + "="*60)
        print("💿 DOWNLOADING SAVED ALBUMS")
        print("="*60)
        
        albums = self.get_saved_albums(limit=limit)
        total = 0
        
        for album in albums:
            album_id = album.get('browseId')
            album_name = album.get('title', 'Unknown')
            
            if album_id:
                total += self.download_album(album_id, album_name)
        
        print(f"\n✅ Albums: {total} total tracks")
        return total
    
    def download_all_playlists(self, limit=500):
        """Download all playlists"""
        print("\n" + "="*60)
        print("📋 DOWNLOADING PLAYLISTS")
        print("="*60)
        
        playlists = self.get_library_playlists(limit=limit)
        total = 0
        
        for playlist in playlists:
            playlist_id = playlist.get('playlistId')
            playlist_name = playlist.get('title', 'Unknown')
            
            if playlist_id:
                total += self.download_playlist(playlist_id, playlist_name)
        
        print(f"\n✅ Playlists: {total} total tracks")
        return total
    
    def download_all(self):
        """Download entire library"""
        total = 0
        total += self.download_liked_songs()
        total += self.download_all_albums()
        total += self.download_all_playlists()
        
        stats = self.db.get_stats()
        print("\n" + "="*60)
        print(f"🎉 COMPLETE! Database: {stats['songs']} songs, {stats['albums']} albums, {stats['playlists']} playlists")
        print(f"📁 Location: {self.download_dir}")
        print("="*60)
        return total


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Download YouTube Music library')
    parser.add_argument('--liked', action='store_true', help='Download liked songs')
    parser.add_argument('--albums', action='store_true', help='Download saved albums')
    parser.add_argument('--playlists', action='store_true', help='Download playlists')
    parser.add_argument('--all', action='store_true', help='Download everything')
    parser.add_argument('--dir', default=DOWNLOAD_DIR, help='Download directory')
    parser.add_argument('--auth', default=AUTH_FILE, help='Auth file')
    parser.add_argument('--limit', type=int, default=5000, help='Limit for liked songs')
    
    args = parser.parse_args()
    
    if not (args.liked or args.albums or args.playlists or args.all):
        args.all = True
    
    downloader = YTMusicDownloader(auth_file=args.auth, download_dir=args.dir)
    
    if args.all:
        downloader.download_all()
    else:
        if args.liked:
            downloader.download_liked_songs(limit=args.limit)
        if args.albums:
            downloader.download_all_albums()
        if args.playlists:
            downloader.download_all_playlists()


if __name__ == '__main__':
    main()
