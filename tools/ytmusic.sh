#!/bin/bash
# YouTube Music Downloader - Wrapper Script
# Usage: ./ytmusic.sh <command> [options]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="/home/linuxbrew/.linuxbrew/bin/python3"
cd "$SCRIPT_DIR/ytmusic"

case "${1:-help}" in
    "liked")
        shift
        $PYTHON cli.py liked "$@"
        ;;
    "albums")
        shift
        $PYTHON cli.py albums "$@"
        ;;
    "all")
        shift
        $PYTHON cli.py all "$@"
        ;;
    "batch")
        shift
        $PYTHON cli.py batch "$@"
        ;;
    "organize")
        shift
        $PYTHON organize.py "$@"
        ;;
    "help"|"-h"|"--help")
        echo "🎵 YouTube Music Downloader"
        echo ""
        echo "Usage: $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  liked [--limit N] [--batch]   Download liked songs"
        echo "  albums [--parallel]           Download saved albums"
        echo "  all [--limit N]               Download liked + albums"
        echo "  batch [--limit N]             Download only remaining songs"
        echo "  organize [--no-tags]          Organize library + fix tags"
        echo "  help                          Show this help"
        echo ""
        echo "Examples:"
        echo "  $0 liked --limit 500"
        echo "  $0 albums --parallel"
        echo "  $0 organize"
        ;;
    *)
        echo "Unknown command: $1"
        echo "Run '$0 help' for usage."
        exit 1
        ;;
esac
