#!/usr/bin/env python3
"""
Fix ID3 tags for all MP3 files in /mnt/openclaw/music.
Parses filename pattern: Artist-Album-NN-Title.mp3
Sets: artist, album, title (clean), track number, album artist
Uses mutagen for in-place tag editing (no re-encoding).
"""

import re
import sys
from pathlib import Path
from mutagen.easyid3 import EasyID3
from mutagen.id3 import ID3, APIC, error as ID3Error

MUSIC_DIR = Path("/mnt/openclaw/music")

def parse_filename(filepath):
    """Parse Artist-Album-NN-Title.mp3 pattern."""
    stem = filepath.stem
    # Pattern: Artist-Album-NN-Title
    # Track number is always 2 digits followed by dash
    match = re.match(r'^(.+?)-(.+?)-(\d{2})-(.+)$', stem)
    if match:
        artist = match.group(1)
        album = match.group(2)
        track_num = int(match.group(3))
        title = match.group(4)
        return artist, album, track_num, title
    return None, None, None, None

def fix_tags(filepath, artist, album, track_num, title):
    """Fix ID3 tags in-place using mutagen."""
    try:
        try:
            audio = EasyID3(str(filepath))
        except ID3Error:
            # No existing tags, create new
            audio = EasyID3()
        
        audio['artist'] = artist
        audio['albumartist'] = artist
        audio['album'] = album
        audio['title'] = title
        audio['tracknumber'] = [str(track_num)]
        audio['discnumber'] = ['1']
        
        audio.save(str(filepath))
        return True
    except Exception as e:
        print(f"      Error tagging {filepath.name}: {e}")
        return False

def main():
    print("🎵 ID3 Tag Fixer (mutagen)")
    print("=" * 60)
    
    mp3_files = list(MUSIC_DIR.rglob("*.mp3"))
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
        
        if fix_tags(filepath, artist, album, track_num, clean_title):
            fixed += 1
        else:
            failed += 1
    
    print()
    print("=" * 60)
    print("✅ ID3 Tag Fix Complete!")
    print(f"   Fixed: {fixed}")
    print(f"   Failed: {failed}")
    print(f"   Unparseable filenames: {no_parse}")
    print(f"   Total processed: {total}")

if __name__ == '__main__':
    main()