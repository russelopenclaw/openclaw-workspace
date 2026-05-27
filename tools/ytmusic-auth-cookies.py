#!/usr/bin/env python3
"""
YouTube Music Authentication via Browser Cookies

This script helps you extract cookies from your browser to authenticate with YouTube Music.
"""

from ytmusicapi import YTMusic
import json
import sys

def setup_cookies():
    print("YouTube Music Cookie Authentication")
    print("=" * 50)
    print("\nThis method uses your browser's YouTube cookies for authentication.")
    print("\nSteps:")
    print("1. Open YouTube Music in your browser (music.youtube.com)")
    print("2. Make sure you're logged in")
    print("3. Open Developer Tools (F12)")
    print("4. Go to Network tab")
    print("5. Refresh the page")
    print("6. Click on any request to 'music.youtube.com'")
    print("7. Copy the 'Cookie' header value")
    print("8. Paste it below\n")
    
    print("Alternative (easier): Use the browser extension method:")
    print("1. Install 'Get cookies.txt' extension for your browser")
    print("   - Chrome: https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc")
    print("   - Firefox: https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/")
    print("2. Go to music.youtube.com")
    print("3. Use the extension to export cookies")
    print("4. Save as 'ytmusic-cookies.txt'\n")
    
    response = input("Which method? (1=manual cookie paste, 2=exported file, 3=skip): ").strip()
    
    if response == "1":
        print("\nPaste your cookie string (starts with '__Secure-3PAPISID=...'):")
        cookies = input("> ").strip()
        
        if len(cookies) > 50:
            filepath = "/home/kevin/.openclaw/workspace/ytmusic-cookies.txt"
            with open(filepath, 'w') as f:
                f.write(cookies)
            print(f"\n✅ Cookies saved to: {filepath}")
            print("\nUsage: YTMusic('ytmusic-cookies.txt')")
            return filepath
        else:
            print("❌ Cookie string too short. Please try again.")
            return None
            
    elif response == "2":
        filepath = input("Enter path to cookies.txt file: ").strip()
        try:
            with open(filepath, 'r') as f:
                content = f.read()
                if len(content) > 100:
                    # Copy to workspace
                    dest = "/home/kevin/.openclaw/workspace/ytmusic-cookies.txt"
                    with open(dest, 'w') as out:
                        out.write(content)
                    print(f"\n✅ Cookies copied to: {dest}")
                    print("\nUsage: YTMusic('ytmusic-cookies.txt')")
                    return dest
                else:
                    print("❌ File seems too small. Are you sure it's the right file?")
                    return None
        except FileNotFoundError:
            print(f"❌ File not found: {filepath}")
            return None
            
    else:
        print("\nSkipping authentication setup.")
        print("\nYou can still use YTMusic() without auth for basic browsing,")
        print("but library management requires authentication.")
        return None

def test_auth(filepath=None):
    """Test if authentication works"""
    try:
        ytm = YTMusic(filepath) if filepath else YTMusic()
        print("\n🔍 Testing connection...")
        
        # Try a simple operation
        if filepath:
            # Try to get library (requires auth)
            try:
                playlists = ytm.get_library_playlists(limit=1)
                print(f"✅ Authentication successful!")
                print(f"   Found {len(playlists)} playlist(s) (limit 1)")
                return True
            except Exception as e:
                print(f"⚠️  Auth file loaded but library access failed: {e}")
                return False
        else:
            # Anonymous - just test search
            results = ytm.search("test", limit=1)
            print(f"✅ Anonymous access works (search returned {len(results)} results)")
            print("   For library access, set up cookies authentication")
            return True
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    filepath = setup_cookies()
    if filepath:
        test_auth(filepath)
