#!/home/linuxbrew/.linuxbrew/bin/python3
"""
YouTube Music Library Organizer
Combines cleanup, reorganization, and ID3 tag fixing.

Usage:
    python organize.py              # Full organize + tags
    python organize.py --no-tags    # Organize only, skip ID3 fix
"""

import argparse
import json
import re
import shutil
from pathlib import Path
from typing import Optional, Tuple

try:
    from mutagen.easyid3 import EasyID3
    from mutagen.id3 import ID3, ID3Error
    HAS_MUTAGEN = True
except ImportError:
    HAS_MUTAGEN = False
    print("⚠️  mutagen not installed. Install with: pip install mutagen")

from . import load_auth, load_downloaded, clean_name, DEFAULT_DOWNLOAD_DIR, DEFAULT_AUTH_FILE


def get_metadata_for_all_songs(downloaded: list) -> list:
    """Fetch metadata for all downloaded songs from YouTube Music."""
    print("📋 Getting metadata for all downloaded songs...")
    
    ytm = load_auth()
    metadata = []
    
    for i, video_id in enumerate(downloaded, 1):
        try:
            song = ytm.get_song(video_id)
            if not song:
                continue
            
            title = song.get('title', 'Unknown')
            artists = song.get('artists', [{}])
            artist = artists[0].get('name', 'Unknown') if artists else 'Unknown'
            album = song.get('album', {}).get('name', 'Unknown') if song.get('album') else 'Unknown'
            track_num = song.get('trackNumber', 0) or 0
            
            # Try to get better track number from album
            album_id = song.get('album', {}).get('id')
            if album_id and not song.get('trackNumber'):
                try:
                    album_data = ytm.get_album(album_id)
                    for track in album_data.get('tracks', []):
                        if track.get('videoId') == video_id:
                            track_num = track.get('trackNumber', track_num) or track_num
                            break
                except Exception:
                    pass
            
            metadata.append({
                'video_id': video_id,
                'title': title,
                'artist': artist,
                'album': album,
                'track_num': track_num
            })
            
            if i % 50 == 0:
                print(f"  Processed {i}/{len(downloaded)} songs...")
                
        except Exception as e:
            print(f"  Error processing {video_id}: {e}")
            metadata.append({
                'video_id': video_id,
                'title': 'Unknown',
                'artist': 'Unknown',
                'album': 'Unknown',
                'track_num': 0
            })
    
    print(f"✅ Metadata collected for {len(metadata)} songs")
    return metadata


def parse_filename(filepath: Path) -> Tuple[Optional[str], Optional[str], Optional[int], Optional[str]]:
    """Parse Artist-Album-NN-Title.mp3 pattern."""
    stem = filepath.stem
    match = re.match(r'^(.+?)-(.+?)-(\d{2})-(.+)$', stem)
    if match:
        return match.group(1), match.group(2), int(match.group(3)), match.group(4)
    return None, None, None, None


def organize_files(metadata: list, download_dir: Path = DEFAULT_DOWNLOAD_DIR) -> dict:
    """Organize files into Artist/Album/ structure."""
    print()
    print("📁 Organizing files...")
    print("Target structure: Artist/Album/Artist-Album-NN-Title.mp3")
    print()
    
    organized = 0
    moved = 0
    duplicates = 0
    errors = 0
    
    for song in metadata:
        video_id = song['video_id']
        title = song['title']
        artist = song['artist']
        album = song['album']
        track_num = song['track_num'] or 0
        
        artist_clean = clean_name(artist)
        album_clean = clean_name(album)
        title_clean = clean_name(title)
        track_formatted = f"{track_num:02d}"
        
        # New filename and path
        filename = f"{artist_clean}-{album_clean}-{track_formatted}-{title_clean}.mp3"
        artist_dir = download_dir / artist_clean
        album_dir = artist_dir / album_clean
        new_path = album_dir / filename
        
        # Check if already in correct location
        if new_path.exists():
            organized += 1
            continue
        
        # Find the old file
        old_file = None
        
        # Search by video_id in filename
        for mp3_file in download_dir.rglob("*.mp3"):
            if video_id[:8] in mp3_file.name:
                old_file = mp3_file
                break
        
        # Search by title/artist
        if not old_file:
            for mp3_file in download_dir.rglob(f"*{title_clean[:20]}*.mp3"):
                if artist_clean.lower() in str(mp3_file).lower():
                    old_file = mp3_file
                    break
        
        # Search root directory
        if not old_file:
            for mp3_file in download_dir.glob("*.mp3"):
                if title_clean.lower() in mp3_file.name.lower():
                    old_file = mp3_file
                    break
        
        if not old_file:
            errors += 1
            continue
        
        # Create directory structure and move
        album_dir.mkdir(parents=True, exist_ok=True)
        
        try:
            if old_file.exists():
                shutil.move(str(old_file), str(new_path))
                moved += 1
                print(f"  📁 {artist} - {album} - {track_formatted} - {title}")
            else:
                errors += 1
        except Exception as e:
            print(f"  ❌ Error moving {old_file.name}: {e}")
            errors += 1
    
    print(f"\n✅ Organized: {moved} files moved, {organized} already organized, {errors} errors")
    return {'moved': moved, 'organized': organized, 'errors': errors}


def fix_id3_tags(download_dir: Path = DEFAULT_DOWNLOAD_DIR) -> dict:
    """Fix ID3 tags for all MP3 files based on filename pattern."""
    if not HAS_MUTAGEN:
        print("⚠️  Skipping ID3 tag fix (mutagen not installed)")
        return {'fixed': 0, 'failed': 0, 'no_parse': 0}
    
    print()
    print("🏷️  Fixing ID3 tags...")
    
    mp3_files = list(download_dir.rglob("*.mp3"))
    total = len(mp3_files)
    print(f"Found {total} MP3 files")
    
    fixed = 0
    failed = 0
    no_parse = 0
    
    for i, filepath in enumerate(mp3_files, 1):
        if i % 1000 == 0:
            print(f"  Progress: {i}/{total} ({fixed} fixed, {failed} failed)")
        
        artist, album, track_num, title = parse_filename(filepath)
        
        if artist is None:
            no_parse += 1
            continue
        
        # Clean up title - remove "Artist - " prefix if present
        clean_title = title
        if clean_title.startswith(f"{artist} - "):
            clean_title = clean_title[len(artist) + 3:]
        
        try:
            try:
                audio = EasyID3(str(filepath))
            except ID3Error:
                audio = EasyID3()
            
            audio['artist'] = artist
            audio['albumartist'] = artist
            audio['album'] = album
            audio['title'] = clean_title
            audio['tracknumber'] = [str(track_num)]
            audio['discnumber'] = ['1']
            
            audio.save(str(filepath))
            fixed += 1
            
        except Exception as e:
            print(f"      Error tagging {filepath.name}: {e}")
            failed += 1
    
    print()
    print("=" * 60)
    print("✅ ID3 Tag Fix Complete!")
    print(f"   Fixed: {fixed}")
    print(f"   Failed: {failed}")
    print(f"   Unparseable: {no_parse}")
    
    return {'fixed': fixed, 'failed': failed, 'no_parse': no_parse}


def cleanup_old_files(download_dir: Path = DEFAULT_DOWNLOAD_DIR) -> dict:
    """Remove old flat files and empty directories."""
    print()
    print("🧹 Cleaning up...")
    
    # Remove flat files in root
    flat_files = list(download_dir.glob("*.mp3"))
    for f in flat_files:
        f.unlink()
    
    flat_webp = list(download_dir.glob("*.webp"))
    for f in flat_webp:
        f.unlink()
    
    # Remove empty directories
    empty_dirs = 0
    for dirpath in sorted(download_dir.iterdir(), reverse=True):
        if dirpath.is_dir():
            for subdir in dirpath.rglob("*"):
                if subdir.is_dir() and not any(subdir.iterdir()):
                    try:
                        subdir.rmdir()
                        empty_dirs += 1
                    except Exception:
                        pass
    
    print(f"✅ Removed {len(flat_files)} flat files, {len(flat_webp)} images, {empty_dirs} empty dirs")
    
    return {'flat_files': len(flat_files), 'empty_dirs': empty_dirs}


def main():
    parser = argparse.ArgumentParser(
        description='YouTube Music Library Organizer',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python organize.py              # Full organize + ID3 tags
  python organize.py --no-tags    # Organize only, skip ID3 fix
  python organize.py --cleanup    # Just cleanup flat files
        """
    )
    
    parser.add_argument(
        '--no-tags',
        action='store_true',
        help='Skip ID3 tag fixing'
    )
    parser.add_argument(
        '--cleanup',
        action='store_true',
        help='Only cleanup flat files, skip organize/tags'
    )
    
    args = parser.parse_args()
    
    print("🎵 YouTube Music Library Organizer")
    print("=" * 60)
    
    if args.cleanup:
        cleanup_old_files()
        return
    
    # Load downloaded songs
    downloaded = load_downloaded()
    print(f"Tracking {len(downloaded)} downloaded songs")
    
    # Get metadata
    metadata = get_metadata_for_all_songs(list(downloaded))
    
    # Organize files
    organize_result = organize_files(metadata)
    
    # Fix ID3 tags (unless skipped)
    if not args.no_tags:
        tags_result = fix_id3_tags()
    else:
        tags_result = {'fixed': 0, 'failed': 0, 'no_parse': 0}
    
    # Cleanup
    cleanup_result = cleanup_old_files()
    
    # Summary
    print()
    print("=" * 60)
    print("✅ Organization Complete!")
    print(f"   Files moved: {organize_result['moved']}")
    print(f"   ID3 tags fixed: {tags_result['fixed']}")
    print(f"   Flat files removed: {cleanup_result['flat_files']}")


if __name__ == '__main__':
    main()
