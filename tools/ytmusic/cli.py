#!/home/linuxbrew/.linuxbrew/bin/python3
"""
YouTube Music Downloader - CLI
Unified command-line interface for all download operations.

Usage:
    python cli.py liked [--limit 100] [--batch]
    python cli.py albums [--parallel]
    python cli.py all [--limit 100]
    python cli.py batch [--limit 100]
"""

import sys
import argparse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# Import core module
from . import (
    load_auth, load_downloaded, save_downloaded,
    load_completed_albums, save_completed_albums,
    get_track_number, download_track,
    get_liked_songs, get_library_albums, get_album_details,
    clean_name,
    DEFAULT_DOWNLOAD_DIR, DEFAULT_DOWNLOADED_FILE, DEFAULT_ALBUMS_FILE, DEFAULT_ALBUM_PROGRESS_FILE
)


def download_liked(limit: int = 100, batch_only: bool = False) -> dict:
    """Download liked songs."""
    print("🎵 YouTube Music - Liked Songs")
    print("=" * 60)
    
    ytm = load_auth()
    downloaded = load_downloaded()
    
    print(f"📋 Fetching {limit} liked songs...")
    tracks = get_liked_songs(ytm, limit)
    
    # Filter to batch-only (not yet downloaded) if requested
    if batch_only:
        tracks = [t for t in tracks if t.get('videoId') not in downloaded]
        print(f"Remaining to download: {len(tracks)}")
    else:
        print(f"Total liked: {len(tracks)}")
        print(f"Already downloaded: {len(downloaded)}")
    
    if not tracks:
        print("✅ Nothing to download!")
        return {'ok': 0, 'skip': len(downloaded), 'fail': 0}
    
    print()
    
    ok = skip = fail = 0
    failed_list = []
    
    for i, track in enumerate(tracks, 1):
        video_id = track.get('videoId')
        if not video_id:
            continue
        
        title = track.get('title', 'Unknown')
        artists = track.get('artists', [])
        artist = artists[0].get('name', 'Unknown') if artists else 'Unknown'
        album_info = track.get('album', {})
        album = album_info.get('name', 'Unknown') if album_info else 'Unknown'
        track_num = get_track_number(track, ytm)
        
        # Check if already tracked
        if video_id in downloaded:
            skip += 1
            print(f"⏭️  [{i:3d}] {artist} - {title}")
            continue
        
        # Download
        print(f"⬇️  [{i:3d}] {artist} - {title}", end='')
        result, error = download_track(video_id, title, artist, album, track_num)
        
        if result == 'ok' or result == 'skip':
            downloaded.add(video_id)
            ok += 1
            print(f" ✅")
        elif result == 'timeout':
            fail += 1
            failed_list.append((i, artist, title, 'timeout'))
            print(f" ⏱️ (timeout)")
        else:
            fail += 1
            failed_list.append((i, artist, title, error[:50] if error else 'unknown'))
            print(f" ❌ ({result})")
        
        # Save progress every 20 songs
        if i % 20 == 0:
            save_downloaded(downloaded)
            print(f"     ... Progress saved ({i} songs) ...")
    
    # Save final state
    save_downloaded(downloaded)
    
    # Summary
    print()
    print("=" * 60)
    print(f"✅ Complete!")
    print(f"   Downloaded: {ok}")
    print(f"   Skipped:    {skip}")
    print(f"   Failed:     {fail}")
    print(f"   Total tracked: {len(downloaded)} songs")
    
    if failed_list:
        print()
        print(f"❌ Failed downloads ({len(failed_list)}):")
        for num, artist, title, reason in failed_list[:20]:
            print(f"   {num}. {artist} - {title} ({reason})")
        if len(failed_list) > 20:
            print(f"   ... and {len(failed_list) - 20} more")
    
    return {'ok': ok, 'skip': skip, 'fail': fail, 'total': len(downloaded)}


def download_album(album_id: str, album_name: str, album_tracks: list, ytm, completed_albums: set) -> dict:
    """Download a single album. Returns completion status."""
    if not album_tracks:
        return {'complete': False, 'downloaded': 0, 'failed': 0}
    
    first_track = album_tracks[0]
    artists = first_track.get('artists', [])
    artist = artists[0].get('name', 'Unknown') if artists else 'Unknown'
    artist_clean = clean_name(artist)
    album_clean = clean_name(album_name)
    
    downloaded = 0
    failed = 0
    
    for i, track in enumerate(album_tracks, 1):
        video_id = track.get('videoId')
        title = track.get('title', 'Unknown')
        track_num = track.get('trackNumber', i) or i
        
        result, error = download_track(
            video_id, title, artist, album_name, track_num
        )
        
        if result == 'ok' or result == 'skip':
            downloaded += 1
        else:
            failed += 1
            print(f"  ❌ {album_name[:30]} - Track {track_num:02d} ({result})")
    
    complete = (failed == 0 and downloaded == len(album_tracks))
    
    if complete:
        print(f"💿 COMPLETE: {album_name}")
    
    return {'complete': complete, 'downloaded': downloaded, 'failed': failed}


def download_albums(parallel: bool = False, max_workers: int = 4) -> dict:
    """Download saved albums."""
    print("🎵 YouTube Music - Album Download")
    print("=" * 60)
    
    ytm = load_auth()
    completed_albums = load_completed_albums()
    
    print("📋 Fetching saved albums...")
    albums = get_library_albums(ytm)
    
    # Filter to incomplete albums
    incomplete = [a for a in albums if a.get('browseId') not in completed_albums]
    
    print(f"Total: {len(albums)}, Completed: {len(completed_albums)}, To do: {len(incomplete)}")
    print()
    
    total_complete = 0
    total_tracks = 0
    total_failed = 0
    
    if parallel:
        print(f"🔄 Downloading with {max_workers} parallel workers...\n")
        
        # Build work list
        work_items = []
        for album in incomplete:
            album_id = album.get('browseId')
            album_name = album.get('title', 'Unknown')
            album_data = get_album_details(ytm, album_id)
            if album_data and album_data.get('tracks'):
                work_items.append((album_id, album_name, album_data['tracks']))
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(download_album, aid, aname, atracks, ytm, completed_albums): (aid, aname)
                for aid, aname, atracks in work_items
            }
            
            for future in as_completed(futures):
                result = future.result()
                total_tracks += result['downloaded']
                total_failed += result['failed']
                
                if result['complete']:
                    album_id, _ = futures[future]
                    completed_albums.add(album_id)
                    total_complete += 1
    else:
        print("🔄 Downloading sequentially...\n")
        
        for album in incomplete:
            album_id = album.get('browseId')
            album_name = album.get('title', 'Unknown')
            
            album_data = get_album_details(ytm, album_id)
            if not album_data or not album_data.get('tracks'):
                print(f"❌ Error fetching {album_name}")
                continue
            
            print(f"\n💿 Album: {album_name} ({len(album_data['tracks'])} tracks)")
            result = download_album(album_id, album_name, album_data['tracks'], ytm, completed_albums)
            
            total_tracks += result['downloaded']
            total_failed += result['failed']
            
            if result['complete']:
                completed_albums.add(album_id)
                total_complete += 1
    
    # Save state
    save_completed_albums(completed_albums)
    
    print()
    print("=" * 60)
    print(f"✅ Done!")
    print(f"   Albums complete: {total_complete}")
    print(f"   Albums failed:   {len(incomplete) - total_complete}")
    print(f"   Tracks downloaded: {total_tracks}")
    print(f"   Total albums tracked: {len(completed_albums)}")
    
    return {
        'complete': total_complete,
        'failed': len(incomplete) - total_complete,
        'tracks': total_tracks,
        'total_albums': len(completed_albums)
    }


def download_all(limit: int = 100) -> dict:
    """Download both liked songs and albums."""
    print("🎵 YouTube Music - Complete Download")
    print("=" * 60)
    print()
    
    # Download liked songs
    liked_result = download_liked(limit=limit, batch_only=False)
    
    print()
    print("=" * 60)
    print()
    
    # Download albums
    albums_result = download_albums(parallel=False)
    
    return {
        'liked': liked_result,
        'albums': albums_result
    }


def main():
    parser = argparse.ArgumentParser(
        description='YouTube Music Downloader',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python cli.py liked              Download 100 liked songs
  python cli.py liked --limit 500  Download 500 liked songs
  python cli.py liked --batch      Download only remaining (not tracked)
  python cli.py albums             Download saved albums (sequential)
  python cli.py albums --parallel  Download albums with 4 workers
  python cli.py all                Download liked + albums
  python cli.py batch              Alias for liked --batch
        """
    )
    
    parser.add_argument(
        'command',
        choices=['liked', 'albums', 'all', 'batch'],
        help='Download command'
    )
    parser.add_argument(
        '--limit', '-l',
        type=int,
        default=100,
        help='Limit for liked songs (default: 100)'
    )
    parser.add_argument(
        '--batch', '-b',
        action='store_true',
        help='Download only remaining (not already tracked)'
    )
    parser.add_argument(
        '--parallel', '-p',
        action='store_true',
        help='Download albums in parallel (4 workers)'
    )
    parser.add_argument(
        '--workers', '-w',
        type=int,
        default=4,
        help='Number of parallel workers for albums (default: 4)'
    )
    
    args = parser.parse_args()
    
    if args.command == 'liked':
        download_liked(limit=args.limit, batch_only=args.batch)
    elif args.command == 'batch':
        download_liked(limit=args.limit, batch_only=True)
    elif args.command == 'albums':
        download_albums(parallel=args.parallel, max_workers=args.workers)
    elif args.command == 'all':
        download_all(limit=args.limit)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == '__main__':
    main()
