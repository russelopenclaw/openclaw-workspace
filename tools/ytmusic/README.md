# YouTube Music Downloader

Consolidated YouTube Music download and organization tools.

## Setup

**Auth file required:** `/home/kevin/.openclaw/workspace/ytmusic-auth.json`

**Install dependencies:**
```bash
pip install ytmusicapi mutagen
```

## Usage

### Download Songs

```bash
cd /home/kevin/.openclaw/workspace/tools/ytmusic

# Download 100 liked songs
python cli.py liked

# Download 500 liked songs
python cli.py liked --limit 500

# Download only remaining (not already tracked)
python cli.py liked --batch

# Download saved albums (sequential)
python cli.py albums

# Download albums with 4 parallel workers
python cli.py albums --parallel

# Download everything (liked + albums)
python cli.py all
```

### Organize Library

```bash
# Full organization + ID3 tag fix
python organize.py

# Organize only, skip ID3 tags
python organize.py --no-tags

# Just cleanup flat files
python organize.py --cleanup
```

## File Structure

Output format:
```
/mnt/openclaw/music/
├── Artist One/
│   └── Album Name/
│       ├── Artist One-Album Name-01-Song Title.mp3
│       ├── Artist One-Album Name-02-Another Song.mp3
│       └── ...
└── Artist Two/
    └── Their Album/
        └── ...
```

Filename pattern: `Artist-Album-NN-Title.mp3`

## Tracking Files

- `~/.ytmusic-downloader/downloaded.json` - List of downloaded video IDs
- `~/.ytmusic-downloader/albums-complete.json` - List of completed album IDs
- `~/.ytmusic-downloader/albums-progress.json` - Incomplete album progress

## Legacy Scripts

The old scripts in `tools/` are now deprecated:
- `ytmusic-download.sh` → `python cli.py all`
- `ytmusic-download-batch.sh` → `python cli.py liked --batch`
- `ytmusic-download-complete.py` → `python cli.py liked --limit 1000`
- `ytmusic-download-favorites.py` → `python cli.py liked`
- `ytmusic-download-parallel.py` → `python cli.py albums --parallel`
- `ytmusic-cleanup.sh` → `python organize.py`
- `fix-id3-tags.py` → Included in `python organize.py`

Keep the old scripts until you verify the new ones work, then delete them.

## Module API

```python
from ytmusic import (
    load_auth,
    download_track,
    get_liked_songs,
    get_library_albums,
    clean_name,
    load_downloaded,
    save_downloaded
)

# Example
ytm = load_auth()
tracks = get_liked_songs(ytm, limit=100)
for track in tracks:
    status, error = download_track(
        track['videoId'],
        track['title'],
        track['artists'][0]['name'],
        track['album']['name'],
        track.get('trackNumber', 0)
    )
```
