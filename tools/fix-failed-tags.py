#!/usr/bin/env python3
"""Fix ID3 tags for specific failed files."""
import re
from pathlib import Path
from mutagen.easyid3 import EasyID3

MUSIC_DIR = Path("/mnt/openclaw/music")

# Read failed basenames
with open("/tmp/failed-tags.txt") as f:
    basenames = [line.strip() for line in f if line.strip()]

print(f"Fixing {len(basenames)} failed files...")

fixed = 0
not_found = 0
still_failed = 0

for basename in basenames:
    # Find the file
    matches = list(MUSIC_DIR.rglob(basename))
    if not matches:
        not_found += 1
        continue
    
    for filepath in matches:
        stem = filepath.stem
        match = re.match(r'^(.+?)-(.+?)-(\d{2})-(.+)$', stem)
        if match:
            artist, album, track_num, title = match.groups()
            try:
                audio = EasyID3(str(filepath))
                audio['artist'] = artist
                audio['albumartist'] = artist
                audio['album'] = album
                audio['title'] = title
                audio['tracknumber'] = [str(int(track_num))]
                audio['discnumber'] = ['1']
                audio.save(str(filepath))
                fixed += 1
            except Exception as e:
                print(f"  Failed: {basename}: {e}")
                still_failed += 1

print(f"Done: {fixed} fixed, {not_found} not found, {still_failed} still failed")