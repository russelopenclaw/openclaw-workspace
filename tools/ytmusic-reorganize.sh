#!/bin/bash
# Reorganize YouTube Music library: move flat files to Artist/Album/ structure

set -e

DOWNLOAD_DIR="/mnt/openclaw/music"

echo "🔄 Reorganizing YouTube Music Library"
echo "====================================="
echo ""

# Count current state
flat_files=$(find "$DOWNLOAD_DIR" -maxdepth 1 -name "*.mp3" | wc -l)
dirs=$(find "$DOWNLOAD_DIR" -mindepth 1 -type d | wc -l)
echo "Current state: $flat_files flat files, $dirs directories"
echo ""

# Move flat files to proper structure
echo "📁 Moving flat files to Artist/Album/ structure..."

for file in "$DOWNLOAD_DIR"/*.mp3; do
    [ -f "$file" ] || continue
    
    filename=$(basename "$file")
    
    # Parse filename: Artist-Album-TrackNum-Title.mp3
    # Extract parts using parameter expansion
    base="${filename%.mp3}"
    
    # Try to extract artist (first part before -)
    artist=$(echo "$base" | cut -d'-' -f1)
    
    # Try to extract album (second part)
    album=$(echo "$base" | cut -d'-' -f2)
    
    # If we can't parse it, use "Unknown"
    [ -z "$artist" ] && artist="Unknown"
    [ -z "$album" ] && album="Unknown"
    
    # Create directory
    target_dir="$DOWNLOAD_DIR/$artist/$album"
    mkdir -p "$target_dir"
    
    # Move file
    mv "$file" "$target_dir/"
    echo "  ✓ $artist / $album / $filename"
done

# Clean up empty directories
echo ""
echo "🗑️  Cleaning up empty directories..."
find "$DOWNLOAD_DIR" -mindepth 1 -type d -empty -delete 2>/dev/null || true

# Count final state
flat_files_final=$(find "$DOWNLOAD_DIR" -maxdepth 1 -name "*.mp3" | wc -l)
dirs_final=$(find "$DOWNLOAD_DIR" -mindepth 1 -type d | wc -l)
echo ""
echo "✅ Reorganization complete!"
echo "Final state: $flat_files_final flat files, $dirs_final directories"
echo ""
echo "Sample structure:"
find "$DOWNLOAD_DIR" -type d | head -15
