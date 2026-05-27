#!/usr/bin/env python3
"""
Download ALL albums for specified YouTube Music artists.
- Skips albums already complete on disk
- Fills in missing tracks for partial albums
- Embeds ID3 tags (artist, album, title, track number)
- Handles expanded/deluxe editions with bonus tracks
"""

import json
import subprocess
import time
import os
from pathlib import Path
from ytmusicapi import YTMusic

DOWNLOAD_DIR = Path("/mnt/openclaw/music")
AUTH_FILE = Path("/home/kevin/.openclaw/workspace/ytmusic-auth.json")
PROGRESS_FILE = Path("/home/kevin/.ytmusic-downloader/artist-albums-progress.json")

ARTISTS = {
    "UCvsGftDbjrloucZ931Pl9nQ": "Audiomachine",
    "UCZZYB4UqTyPGjxB9OmocmFg": "NINJA TRACKS",
    "UCE4Knu_Di-7reXKjIXp5o7Q": "Revolt Production Music",
    "UCupMGiV9FqGKaeMnK2XlTAg": "Gothic Storm",
    "UCFFvVq9NF6BcfyxSrB8cArA": "Colossal Trailer Music",
    "UC25tCnonOu_M3ojPEi57nWA": "Brand X Music",
    "UCscP9LRm5_t3nnzd1DF4MRg": "Helen Jane Long",
    "UCEEDEDpIpk3MkqidYDy18VQ": "Jennifer Thomas",
    "UCEu66Ifiso9mvAFyNaX6lDQ": "Phil Rey Gibbons",
    "UCqClQs5M4guCQOy5h6b5vQQ": "Fearless Motivation Instrumentals",
    "UCnBFyPTFVWLepy6pgotCIog": "Twelve Titans Music",
    "UCnfRfrXvDjd7GYH58P13Low": "Mannheim Steamroller",
    "UCNgefy_ffpGQ833EgEfotgg": "Elephant Music",
    "UCILh__r7dhb-_pi083b0kYw": "Really Slow Motion",
}

def clean_name(s):
    return ''.join(c for c in s if c not in r'\/:*?"<>|')

def get_existing_mp3s(album_dir):
    """Get set of track numbers already on disk for an album."""
    existing = {}
    if not album_dir.exists():
        return existing
    for mp3 in album_dir.glob("*.mp3"):
        # Try to extract track number from filename pattern: Artist-Album-NN-Title.mp3
        parts = mp3.stem.split("-")
        if len(parts) >= 3:
            try:
                track_num = int(parts[-2])
                existing[track_num] = mp3
            except ValueError:
                pass
    return existing

def download_track(video_id, artist, album, title, track_num, output_file, max_retries=2):
    """Download a single track with ID3 tag embedding."""
    if not video_id:
        print(f"      ⏭️  No video ID for track {track_num}: {title}")
        return 'skip', 'No video ID'
    
    url = f"https://music.youtube.com/watch?v={video_id}"
    
    for attempt in range(1, max_retries + 1):
        cmd = [
            'yt-dlp', '-x', '--audio-format', 'mp3', '--audio-quality', '0',
            '--embed-metadata', '--embed-thumbnail', '--add-metadata',
            '-o', str(output_file),
            '--no-cookies', '--no-warnings',
            '--socket-timeout', '30', '--retries', '3',
            url
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            if result.returncode == 0:
                # Verify the file was actually created
                if output_file.exists():
                    size = output_file.stat().st_size
                    if size > 10000:  # At least 10KB (real audio)
                        return 'ok', None
                    else:
                        print(f"      ⚠️  File too small ({size}B), retrying...")
                        output_file.unlink(missing_ok=True)
                        if attempt < max_retries:
                            time.sleep(attempt * 3)
                        continue
                return 'ok', None
            else:
                error = result.stderr[:200] if result.stderr else 'Unknown'
                if 'not available' in error.lower():
                    return 'unavailable', error
                if attempt < max_retries:
                    time.sleep(attempt * 3)
                else:
                    return 'fail', error
        except subprocess.TimeoutExpired:
            if attempt < max_retries:
                time.sleep(attempt * 3)
            else:
                return 'timeout', 'Timed out'
        except Exception as e:
            return 'error', str(e)
    
    return 'fail', 'Max retries'

def main():
    print("🎵 YouTube Music - Artist Album Downloader")
    print("=" * 70)
    
    ytm = YTMusic(str(AUTH_FILE))
    
    # Load progress
    progress = {}
    if PROGRESS_FILE.exists():
        progress = json.load(open(PROGRESS_FILE))
    
    total_new = 0
    total_skipped = 0
    total_filled = 0
    total_failed = 0
    
    for channel_id, artist_name in ARTISTS.items():
        print(f"\n🎤 {artist_name}")
        print("-" * 50)
        
        # Get artist's albums
        try:
            artist_data = ytm.get_artist(channel_id)
        except Exception as e:
            print(f"  ❌ Error fetching artist: {e}")
            continue
        
        # Extract albums from artist data
        albums_list = []
        if 'albums' in artist_data:
            if isinstance(artist_data['albums'], dict) and 'results' in artist_data['albums']:
                albums_list = artist_data['albums']['results']
            elif isinstance(artist_data['albums'], list):
                albums_list = artist_data['albums']
        
        # Also check for singles
        singles_list = []
        if 'singles' in artist_data:
            if isinstance(artist_data['singles'], dict) and 'results' in artist_data['singles']:
                singles_list = artist_data['singles']['results']
            elif isinstance(artist_data['singles'], list):
                singles_list = artist_data['singles']
        
        print(f"  Found {len(albums_list)} albums, {len(singles_list)} singles")
        
        # Process each album
        for album_entry in albums_list:
            album_id = album_entry.get('browseId') or album_entry.get('playlistId', '')
            album_title = album_entry.get('title', 'Unknown')
            
            if not album_id:
                continue
            
            # Check progress
            progress_key = f"{channel_id}:{album_id}"
            if progress.get(progress_key, {}).get('status') == 'complete':
                total_skipped += 1
                continue
            
            # Get full album details (includes ALL tracks, not just listed ones)
            try:
                album_data = ytm.get_album(album_id)
            except Exception as e:
                print(f"  ❌ Error fetching album {album_title}: {e}")
                continue
            
            tracks = album_data.get('tracks', [])
            if not tracks:
                print(f"  ⏭️  No tracks: {album_title}")
                continue
            
            # Determine artist name from tracks (may differ from channel)
            track_artist = tracks[0].get('artists', [{}])[0].get('name', artist_name) if tracks else artist_name
            artist_clean = clean_name(track_artist)
            album_clean = clean_name(album_title)
            album_dir = DOWNLOAD_DIR / artist_clean / album_clean
            album_dir.mkdir(parents=True, exist_ok=True)
            
            # Check existing tracks
            existing = get_existing_mp3s(album_dir)
            
            print(f"\n  💿 {album_title} ({len(tracks)} tracks)")
            print(f"     Already have: {len(existing)}/{len(tracks)}")
            
            if len(existing) == len(tracks):
                print(f"     ✅ Complete, skipping")
                progress[progress_key] = {'status': 'complete', 'tracks': len(tracks)}
                total_skipped += 1
                continue
            
            # Download missing tracks
            downloaded = 0
            filled = 0
            failed = 0
            
            for track in tracks:
                video_id = track.get('videoId', '')
                title = track.get('title', 'Unknown')
                track_num = track.get('trackNumber') or 0
                
                # Handle missing track numbers
                if track_num == 0:
                    idx = tracks.index(track) + 1
                    track_num = idx
                
                title_clean = clean_name(title)
                track_fmt = f"{track_num:02d}"
                filename = f"{artist_clean}-{album_clean}-{track_fmt}-{title_clean}.mp3"
                output_file = album_dir / filename
                
                if output_file.exists() and output_file.stat().st_size > 10000:
                    filled += 1
                    continue
                
                print(f"     ⬇️  {track_fmt}. {title}", end='', flush=True)
                result, error = download_track(video_id, track_artist, album_title, title, track_num, output_file)
                
                if result == 'ok':
                    downloaded += 1
                    print(f" ✅")
                elif result == 'unavailable':
                    failed += 1
                    print(f" ❌ (unavailable)")
                elif result == 'skip':
                    failed += 1
                    print(f" ❌ (no video ID)")
                else:
                    failed += 1
                    print(f" ❌ ({result})")
            
            # Check if any bonus/expanded tracks exist
            # Some albums have more tracks than initially listed
            other_versions = album_data.get('other_versions', [])
            if other_versions:
                for ov in other_versions[:2]:  # Check up to 2 other versions
                    ov_id = ov.get('browseId', '')
                    if ov_id and ov_id != album_id:
                        try:
                            ov_data = ytm.get_album(ov_id)
                            ov_tracks = ov_data.get('tracks', [])
                            if len(ov_tracks) > len(tracks):
                                print(f"     🎁 Found expanded version with {len(ov_tracks)} tracks (vs {len(tracks)})")
                                # Download any extra tracks from expanded version
                                for track in ov_tracks:
                                    video_id = track.get('videoId', '')
                                    title = track.get('title', 'Unknown')
                                    track_num = track.get('trackNumber') or 0
                                    if track_num == 0:
                                        track_num = ov_tracks.index(track) + 1
                                    title_clean = clean_name(title)
                                    track_fmt = f"{track_num:02d}"
                                    filename = f"{artist_clean}-{album_clean}-{track_fmt}-{title_clean}.mp3"
                                    output_file = album_dir / filename
                                    
                                    if output_file.exists() and output_file.stat().st_size > 10000:
                                        continue
                                    
                                    print(f"     ⬇️  [bonus] {track_fmt}. {title}", end='', flush=True)
                                    result, error = download_track(video_id, track_artist, album_title, title, track_num, output_file)
                                    if result == 'ok':
                                        downloaded += 1
                                        print(f" ✅")
                                    else:
                                        print(f" ❌ ({result})")
                        except Exception as e:
                            print(f"     ⚠️  Could not fetch expanded version: {e}")
            
            total_downloaded_this = downloaded
            total_new += downloaded
            total_filled += filled
            total_failed += failed
            
            final_existing = len(get_existing_mp3s(album_dir))
            if final_existing >= len(tracks):
                print(f"     ✅ Album COMPLETE: {final_existing}/{len(tracks)}")
                progress[progress_key] = {'status': 'complete', 'tracks': len(tracks)}
            else:
                print(f"     ⚠️  Album INCOMPLETE: {final_existing}/{len(tracks)}")
                progress[progress_key] = {
                    'status': 'incomplete',
                    'tracks': len(tracks),
                    'have': final_existing,
                    'failed': failed
                }
            
            # Save progress every album
            with open(PROGRESS_FILE, 'w') as f:
                json.dump(progress, f, indent=2)
            
            # Small delay between albums
            time.sleep(1)
    
    # Final summary
    print("\n" + "=" * 70)
    print("✅ ARTIST ALBUM DOWNLOAD COMPLETE!")
    print(f"   New tracks downloaded: {total_new}")
    print(f"   Tracks already on disk: {total_filled}")
    print(f"   Albums skipped (complete): {total_skipped}")
    print(f"   Tracks failed/unavailable: {total_failed}")
    print(f"   Progress saved: {PROGRESS_FILE}")
    
    # Save final progress
    with open(PROGRESS_FILE, 'w') as f:
        json.dump(progress, f, indent=2)

if __name__ == '__main__':
    main()