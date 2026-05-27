#!/bin/bash
# YouTube Music Downloader v3
# Downloads liked songs and albums to /mnt/openclaw/music
# Filename format: Artist-Album-TrackNum-Title.mp3 (flat structure)

set -e

DOWNLOAD_DIR="/mnt/openclaw/music"
DOWNLOADED_FILE="$HOME/.ytmusic-downloader/downloaded.json"
AUTH_FILE="/home/kevin/.openclaw/workspace/ytmusic-auth.json"
ALBUMS_FILE="$HOME/.ytmusic-downloader/albums.json"

# Create directories
mkdir -p "$DOWNLOAD_DIR"
mkdir -p "$(dirname "$DOWNLOADED_FILE")"

# Initialize files if not exists
if [ ! -f "$DOWNLOADED_FILE" ]; then
    echo "[]" > "$DOWNLOADED_FILE"
fi
if [ ! -f "$ALBUMS_FILE" ]; then
    echo "[]" > "$ALBUMS_FILE"
fi

echo "🎵 YouTube Music Downloader v3"
echo "=============================="
echo "Download dir: $DOWNLOAD_DIR"
echo "Filename format: Artist-Album-TrackNum-Title.mp3"
echo ""

# Download liked songs (gets track numbers from albums)
download_liked() {
    local limit="${1:-100}"
    
    echo "❤️  DOWNLOADING LIKED SONGS (limit: $limit)"
    echo "----------------------------------------"
    
    # Get liked songs with album info, then fetch track numbers
    /home/linuxbrew/.linuxbrew/bin/python3 << PYTHON
from ytmusicapi import YTMusic
import json

ytm = YTMusic('$AUTH_FILE')
liked = ytm.get_liked_songs(limit=$limit)
tracks = liked.get('tracks', [])

print(f"Processing {len(tracks)} liked songs...")

for i, track in enumerate(tracks, 1):
    video_id = track.get('videoId', '')
    title = track.get('title', 'Unknown')
    artists = track.get('artists', [])
    artist = artists[0].get('name', 'Unknown') if artists else 'Unknown'
    album_info = track.get('album', {})
    album_id = album_info.get('id') if album_info else None
    album = album_info.get('name', 'Unknown') if album_info else 'Unknown'
    
    # Try to get track number from album
    track_num = track.get('trackNumber')
    if not track_num and album_id:
        try:
            album_data = ytm.get_album(album_id)
            album_tracks = album_data.get('tracks', [])
            for at in album_tracks:
                if at.get('videoId') == video_id:
                    track_num = at.get('trackNumber')
                    break
        except:
            pass
    
    if not track_num:
        track_num = 0
    
    # Print for bash to consume
    print(f"{video_id}|{title}|{artist}|{album}|{track_num}")

    if i % 20 == 0:
        print(f"PROGRESS: {i}/{len(tracks)}", flush=True)
PYTHON
}

# Process each track from stdin
process_tracks() {
    local count=0
    local ok=0
    local skip=0
    local fail=0
    
    while IFS='|' read -r video_id title artist album track_num; do
        [ -z "$video_id" ] && continue
        [ "$video_id" = "PROGRESS:" ] && { echo "  $title"; continue; }
        
        count=$((count + 1))
        
        # Check if already downloaded
        if grep -q "\"$video_id\"" "$DOWNLOADED_FILE" 2>/dev/null; then
            echo "⏭️  [$count] $artist - $title"
            skip=$((skip + 1))
            continue
        fi
        
        # Clean names for filename
        artist_clean=$(echo "$artist" | sed 's/[\\/:"*?<>|]/_/g')
        album_clean=$(echo "$album" | sed 's/[\\/:"*?<>|]/_/g')
        title_clean=$(echo "$title" | sed 's/[\\/:"*?<>|]/_/g')
        
        # Format track number with leading zero
        track_formatted=$(printf "%02d" "$track_num")
        
        # Output filename: Artist/Album/Artist-Album-TrackNum-Title.mp3
        artist_dir="$DOWNLOAD_DIR/$artist_clean"
        album_dir="$artist_dir/$album_clean"
        mkdir -p "$album_dir"
        filename="${artist_clean}-${album_clean}-${track_formatted}-${title_clean}.mp3"
        output_file="$album_dir/$filename"
        
        echo "⬇️  [$count] $artist - $title (Track $track_formatted)"
        
        url="https://music.youtube.com/watch?v=$video_id"
        
        # Download with yt-dlp
        if timeout 120 yt-dlp \
            -x --audio-format mp3 --audio-quality 0 \
            --embed-metadata --embed-thumbnail --add-metadata \
            -o "$output_file" \
            --no-cookies \
            --no-warnings \
            "$url" 2>&1 | grep -E "(Download|ERROR)" | tail -2; then
            
            # Mark as downloaded
            python3 << PYMARK
import json
with open('$DOWNLOADED_FILE') as f:
    data = json.load(f)
if '$video_id' not in data:
    data.append('$video_id')
with open('$DOWNLOADED_FILE', 'w') as f:
    json.dump(data, f)
PYMARK
            echo "   ✅ Done"
            ok=$((ok + 1))
        else
            echo "   ❌ Failed"
            fail=$((fail + 1))
        fi
    done
    
    echo ""
    echo "✅ Complete: $ok downloaded, $skip skipped, $fail failed"
}

# Download saved albums
download_albums() {
    echo ""
    echo "💿 DOWNLOADING SAVED ALBUMS"
    echo "---------------------------"
    
    /home/linuxbrew/.linuxbrew/bin/python3 << PYTHON
from ytmusicapi import YTMusic
import json

ytm = YTMusic('$AUTH_FILE')
album_list = ytm.get_library_albums(limit=500)

# Load completed albums
with open('$ALBUMS_FILE') as f:
    completed = json.load(f)

for album in album_list:
    album_id = album.get('browseId', '')
    album_name = album.get('title', 'Unknown')
    
    if album_id in completed:
        print(f"SKIP|{album_id}|{album_name}")
        continue
    
    try:
        album_data = ytm.get_album(album_id)
        tracks = album_data.get('tracks', [])
        print(f"ALBUM|{album_id}|{album_name}|{len(tracks)}")
        
        for track in tracks:
            video_id = track.get('videoId', '')
            title = track.get('title', 'Unknown')
            artists = track.get('artists', [])
            artist = artists[0].get('name', 'Unknown') if artists else 'Unknown'
            track_num = track.get('trackNumber', 0) or 0
            
            print(f"TRACK|{video_id}|{title}|{artist}|{album_name}|{track_num}")
    except Exception as e:
        print(f"ERROR|{album_id}|{album_name}|{str(e)}")
PYTHON
}

# Process album tracks
process_album_tracks() {
    local current_album=""
    local album_total=0
    local album_ok=0
    local total_albums=0
    local total_tracks=0
    
    while IFS='|' read -r type id name extra; do
        case "$type" in
            "SKIP")
                echo "⏭️  Album complete: $name"
                total_albums=$((total_albums + 1))
                ;;
            "ALBUM")
                current_album="$id"
                album_total="$extra"
                album_ok=0
                echo ""
                echo "💿 Album: $name ($album_total tracks)"
                ;;
            "TRACK")
                local video_id="$id"
                local title="$name"
                local artist_album
                IFS='|' read -r artist album track_num <<< "$extra"
                
                # Check if downloaded
                if grep -q "\"$video_id\"" "$DOWNLOADED_FILE" 2>/dev/null; then
                    album_ok=$((album_ok + 1))
                    total_tracks=$((total_tracks + 1))
                    echo "  ⏭️  Track $track_num: $title"
                    continue
                fi
                
                # Clean names
                artist_clean=$(echo "$artist" | sed 's/[\\/:"*?<>|]/_/g')
                album_clean=$(echo "$album" | sed 's/[\\/:"*?<>|]/_/g')
                title_clean=$(echo "$title" | sed 's/[\\/:"*?<>|]/_/g')
                track_formatted=$(printf "%02d" "$track_num")
                
                # Create directory structure: Artist/Album/
                artist_dir="$DOWNLOAD_DIR/$artist_clean"
                album_dir="$artist_dir/$album_clean"
                mkdir -p "$album_dir"
                
                filename="${artist_clean}-${album_clean}-${track_formatted}-${title_clean}.mp3"
                output_file="$album_dir/$filename"
                
                echo "  ⬇️  Track $track_num: $title"
                
                url="https://music.youtube.com/watch?v=$video_id"
                
                if timeout 120 yt-dlp \
                    -x --audio-format mp3 --audio-quality 0 \
                    --embed-metadata --embed-thumbnail --add-metadata \
                    -o "$output_file" \
                    --no-cookies \
                    --no-warnings \
                    "$url" 2>&1 | grep -E "(Download|ERROR)" | tail -1; then
                    
                    # Mark downloaded
                    python3 << PYMARK2
import json
with open('$DOWNLOADED_FILE') as f:
    data = json.load(f)
if '$video_id' not in data:
    data.append('$video_id')
with open('$DOWNLOADED_FILE', 'w') as f:
    json.dump(data, f)
PYMARK2
                    album_ok=$((album_ok + 1))
                    total_tracks=$((total_tracks + 1))
                    echo "     ✅ Done"
                else
                    echo "     ❌ Failed"
                fi
                ;;
            "ERROR")
                echo "❌ Album error: $name - $extra"
                ;;
        esac
    done
    
    # Mark album complete if all tracks downloaded
    if [ -n "$current_album" ] && [ $album_ok -eq $album_total ]; then
        python3 << PYALBUM
import json
with open('$ALBUMS_FILE') as f:
    data = json.load(f)
if '$current_album' not in data:
    data.append('$current_album')
with open('$ALBUMS_FILE', 'w') as f:
    json.dump(data, f)
PYALBUM
        echo "   ✅ Album complete!"
        total_albums=$((total_albums + 1))
    elif [ -n "$current_album" ]; then
        echo "   ⚠️  Album incomplete: $album_ok/$album_total"
    fi
    
    echo ""
    echo "✅ Albums: $total_albums complete, $total_tracks tracks"
}

# Clean up old directory structure
cleanup_dirs() {
    echo ""
    echo "🧹 Cleaning up old directories..."
    
    # Move any files from subdirectories to root
    find "$DOWNLOAD_DIR" -mindepth 3 -name "*.mp3" -type f | while read -r file; do
        mv "$file" "$DOWNLOAD_DIR/" 2>/dev/null || true
    done
    
    # Remove empty directories
    find "$DOWNLOAD_DIR" -mindepth 1 -type d -empty -delete 2>/dev/null || true
    
    echo "✅ Cleanup complete"
}

# Main
case "${1:-all}" in
    "liked")
        download_liked "${2:-100}" | process_tracks
        ;;
    "albums")
        download_albums | process_album_tracks
        ;;
    "cleanup")
        cleanup_dirs
        ;;
    "all")
        download_liked "${2:-100}" | process_tracks
        download_albums | process_album_tracks
        cleanup_dirs
        ;;
    *)
        echo "Usage: $0 [liked|albums|cleanup|all] [limit]"
        exit 1
        ;;
esac

echo ""
echo "=============================="
downloaded_count=$(/home/linuxbrew/.linuxbrew/bin/python3 -c "import json; print(len(json.load(open('$DOWNLOADED_FILE'))))")
album_count=$(/home/linuxbrew/.linuxbrew/bin/python3 -c "import json; print(len(json.load(open('$ALBUMS_FILE'))))")
echo "Total: $downloaded_count songs, $album_count albums"
echo "Location: $DOWNLOAD_DIR"
