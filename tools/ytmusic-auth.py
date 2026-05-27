#!/usr/bin/env python3
"""YouTube Music OAuth authentication setup"""
from ytmusicapi import setup_oauth, YTMusic
import json

def setup_auth():
    print("YouTube Music Authentication Setup")
    print("=" * 40)
    print("\nOpening browser for authorization...")
    print("Authorize the app, then come back here.\n")
    
    # Start OAuth flow with default credentials
    # open_browser=True will try to open your default browser
    try:
        token = setup_oauth(open_browser=True)
        
        print("\n✅ Authentication successful!")
        
        # Save to file
        filepath = "/home/kevin/.openclaw/workspace/ytmusic-auth.json"
        with open(filepath, 'w') as f:
            json.dump(token.to_dict(), f, indent=2)
        
        print(f"💾 Token saved to: {filepath}")
        print("\nUsage: YTMusic(auth='ytmusic-auth.json')")
        return token
        
    except KeyboardInterrupt:
        print("\n\n❌ Cancelled by user")
        return None
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\n" + "=" * 40)
        print("Manual setup instructions:")
        print("=" * 40)
        print("1. Run this command:")
        print("   python3 -c 'from ytmusicapi import setup_oauth; setup_oauth(open_browser=True)'")
        print("\n2. A browser will open - authorize the app")
        print("\n3. The token will be saved automatically to ytmusic-auth.json")
        return None

if __name__ == "__main__":
    setup_auth()
