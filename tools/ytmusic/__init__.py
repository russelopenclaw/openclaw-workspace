#!/usr/bin/env python3
# Note: Use /home/linuxbrew/.linuxbrew/bin/python3 for ytmusicapi
"""
YouTube Music Downloader - Core Module
Shared utilities for all ytmusic operations.
"""

import json
import subprocess
import time
from pathlib import Path
from typing import Optional, Tuple, Set
from ytmusicapi import YTMusic

# Configuration
DEFAULT_AUTH_FILE = Path("/home/kevin/.openclaw/workspace/ytmusic-auth.json")
DEFAULT_DOWNLOAD_DIR = Path("/mnt/openclaw/music")
DEFAULT_DOWNLOADED_FILE = Path("/home/kevin/.ytmusic-downloader/downloaded.json")
DEFAULT_ALBUMS_FILE = Path("/home/kevin/.ytmusic-downloader/albums-complete.json")
DEFAULT_ALBUM_PROGRESS_FILE = Path("/home/kevin/.ytmusic-downloader/albums-progress.json")


def clean_name(s: str) -> str:
    """Remove invalid filename characters."""
    return ''.join(c for c in s if c not in r'\/:*?"<>|')


def load_auth(auth_file: Optional[Path] = None) -> YTMusic:
    """Load YTMusic API with auth."""
    auth_path = auth_file or DEFAULT_AUTH_FILE
    return YTMusic(str(auth_path))


def load_downloaded(downloaded_file: Optional[Path] = None) -> Set[str]:
    """Load set of already downloaded video IDs."""
    path = downloaded_file or DEFAULT_DOWNLOADED_FILE
    if path.exists():
        with open(path) as f:
            return set(json.load(f))
    return set()


def save_downloaded(video_ids: Set[str], downloaded_file: Optional[Path] = None) -> None:
    """Save set of downloaded video IDs."""
    path = downloaded_file or DEFAULT_DOWNLOAD_DIR
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w') as f:
        json.dump(list(video_ids), f)


def load_completed_albums(albums_file: Optional[Path] = None) -> Set[str]:
    """Load set of completed album IDs."""
    path = albums_file or DEFAULT_ALBUMS_FILE
    if path.exists():
        with open(path) as f:
            return set(json.load(f))
    return set()


def save_completed_albums(album_ids: Set[str], albums_file: Optional[Path] = None) -> None:
    """Save set of completed album IDs."""
    path = albums_file or DEFAULT_ALBUMS_FILE
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w') as f:
        json.dump(list(album_ids), f)


def get_track_number(track: dict, ytm: YTMusic) -> int:
    """Get track number, fetching from album if needed."""
    track_num = track.get('trackNumber', 0) or 0
    
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
                except Exception:
                    pass
    
    return track_num


def download_track(
    video_id: str,
    title: str,
    artist: str,
    album: str,
    track_num: int,
    download_dir: Optional[Path] = None,
    max_retries: int = 3,
    timeout: int = 180
) -> Tuple[str, Optional[str]]:
    """
    Download a single track with retry logic.
    
    Returns: (status, error_message)
        status: 'ok', 'skip', 'timeout', 'fail', 'error'
    """
    dir_path = download_dir or DEFAULT_DOWNLOAD_DIR
    
    # Clean names
    artist_clean = clean_name(artist)
    album_clean = clean_name(album)
    title_clean = clean_name(title)
    track_formatted = f"{track_num:02d}"
    
    # Create directory: Artist/Album/
    album_dir = dir_path / artist_clean / album_clean
    album_dir.mkdir(parents=True, exist_ok=True)
    
    # Filename: Artist-Album-TrackNum-Title.mp3
    filename = f"{artist_clean}-{album_clean}-{track_formatted}-{title_clean}.mp3"
    output_file = album_dir / filename
    
    # Check if already exists
    if output_file.exists():
        return 'skip', None
    
    # Download
    url = f"https://music.youtube.com/watch?v={video_id}"
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
    
    for attempt in range(1, max_retries + 1):
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
            
            if result.returncode == 0:
                return 'ok', None
            else:
                error_msg = result.stderr[:200] if result.stderr else 'Unknown error'
                
                # Check if retryable
                if 'timeout' in error_msg.lower() or 'timed out' in error_msg.lower() or 'HTTP Error 5' in error_msg:
                    if attempt < max_retries:
                        wait_time = attempt * 5
                        time.sleep(wait_time)
                        continue
                    else:
                        return 'timeout', error_msg
                else:
                    return 'fail', error_msg
                    
        except subprocess.TimeoutExpired:
            if attempt < max_retries:
                wait_time = attempt * 5
                time.sleep(wait_time)
            else:
                return 'timeout', 'Download timed out after all retries'
        except Exception as e:
            return 'error', str(e)
    
    return 'fail', 'Max retries exceeded'


def get_liked_songs(ytm: YTMusic, limit: int = 100) -> list:
    """Fetch liked songs from YouTube Music."""
    liked = ytm.get_liked_songs(limit=limit)
    return liked.get('tracks', [])


def get_library_albums(ytm: YTMusic, limit: int = 500) -> list:
    """Fetch saved albums from YouTube Music library."""
    return ytm.get_library_albums(limit=limit)


def get_album_details(ytm: YTMusic, album_id: str) -> Optional[dict]:
    """Fetch album details including tracks."""
    try:
        return ytm.get_album(album_id)
    except Exception:
        return None
