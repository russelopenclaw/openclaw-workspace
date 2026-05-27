#!/usr/bin/env python3
"""
Dad Joke Video Generator - VERIFIED TEMPLATE
=============================================
WORKING PARAMETERS - DO NOT CHANGE WITHOUT TESTING

Based on post-mortem analysis 2026-03-09
Fix: Use method='label' (NOT 'caption') to prevent text truncation

Usage:
    python3 generate-video-TEMPLATE.py --joke-id 13
"""

import os
import sys
import argparse
from moviepy import ImageClip, AudioFileClip, CompositeVideoClip, TextClip

# Configuration
JOKE_ID = "12"  # Will be overridden by --joke-id
OUTPUT_DIR = "/home/kevin/.openclaw/workspace/dadtasticdads-output"

# WORKING PARAMETERS (verified 2026-03-09 on Joke #12)
# DO NOT CHANGE THESE without extensive testing
CONFIG = {
    # Text rendering - CRITICAL
    "font": "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "font_size": 36,
    "stroke_width": 2,
    "text_method": "label",  # NOT "caption" - caption truncates letters!
    "text_box_size": (700, 100),  # Explicit bounding box
    
    # Text Y positions (from top of 1280px tall video)
    # Setup text (appears at 1.0s, ends at 4.0s)
    "setup_line1_y": 280,
    "setup_line2_y": 330,
    "setup_line3_y": 380,
    
    # Punchline text (appears at 4.0s, ends at video end)
    "punchline_line1_y": 310,
    "punchline_line2_y": 360,
    "punchline_line3_y": 410,
    
    # Brand watermark (100px from bottom = y position 1050)
    "brand_y": 1050,
    "brand_font_size": 18,
    
    # Timing
    "buffer_start": 1.0,  # 1 second silence at start
    "setup_start": 1.0,   # Setup text appears at 1.0s
    "punchline_start": 4.0,  # Punchline appears at 4.0s (when setup ends)
    "buffer_end": 1.0,    # 1 second silence at end
}

def make_text(text, color, y_pos, duration, start_time):
    """
    Create a TextClip with verified working parameters.
    
    CRITICAL: Uses method='label' with explicit size to prevent text truncation.
    See: https://github.com/Zulko/moviepy/issues/2268
    """
    clip = TextClip(
        text=text,
        font=CONFIG["font"],
        font_size=CONFIG["font_size"],
        color=color,
        stroke_color="black",
        stroke_width=CONFIG["stroke_width"],
        method=CONFIG["text_method"],  # MUST be 'label', NOT 'caption'
        size=CONFIG["text_box_size"],  # Explicit bounding box required
        text_align="center",
        duration=duration
    )
    return clip.with_start(start_time).with_position(("center", y_pos))

def generate_video(joke_id, joke_text, setup_lines, punchline_lines, image_file, audio_file):
    """
    Generate dad joke video with verified working parameters.
    
    Args:
        joke_id: Joke number (e.g., "12")
        joke_text: Full joke text
        setup_lines: List of 3 strings for setup text
        punchline_lines: List of 3 strings for punchline text
        image_file: Path to background image (512x768 or similar)
        audio_file: Path to padded audio file (with 1s buffers)
    
    Returns:
        Path to generated video file
    """
    output_file = f"{OUTPUT_DIR}/dadjoke-{joke_id}-final.mp4"
    
    # Get audio duration
    audio_clip = AudioFileClip(audio_file)
    AUDIO_DUR = audio_clip.duration
    
    print(f"🎵 Audio duration: {AUDIO_DUR:.2f}s")
    print(f"📝 Setup: {CONFIG['setup_start']}s - {CONFIG['punchline_start']}s")
    print(f"💥 Punchline: {CONFIG['punchline_start']}s - {AUDIO_DUR:.2f}s")
    
    # Background - static, no zoom (720x1280)
    print("🖼️  Loading background...")
    bg = ImageClip(image_file).resized((720, 1280)).with_duration(AUDIO_DUR).with_position("center")
    
    # Handle format-based text display
    if punchline_lines and len(punchline_lines) > 0:
        # Setup-punchline format
        print("📝 Creating setup text...")
        setup1 = make_text(setup_lines[0], "white", CONFIG["setup_line1_y"], 
                           CONFIG["punchline_start"]-CONFIG["setup_start"], CONFIG["setup_start"])
        setup2 = make_text(setup_lines[1] if len(setup_lines) > 1 else "", "white", CONFIG["setup_line2_y"], 
                           CONFIG["punchline_start"]-CONFIG["setup_start"], CONFIG["setup_start"])
        setup3 = make_text(setup_lines[2] if len(setup_lines) > 2 else "", "white", CONFIG["setup_line3_y"], 
                           CONFIG["punchline_start"]-CONFIG["setup_start"], CONFIG["setup_start"])
        
        # Punchline text (3 lines, yellow)
        print("💥 Creating punchline text...")
        punch1 = make_text(punchline_lines[0], "yellow", CONFIG["punchline_line1_y"], 
                           AUDIO_DUR-CONFIG["punchline_start"], CONFIG["punchline_start"])
        punch2 = make_text(punchline_lines[1] if len(punchline_lines) > 1 else "", "yellow", CONFIG["punchline_line2_y"], 
                           AUDIO_DUR-CONFIG["punchline_start"], CONFIG["punchline_start"])
        punch3 = make_text(punchline_lines[2] if len(punchline_lines) > 2 else "", "yellow", CONFIG["punchline_line3_y"], 
                           AUDIO_DUR-CONFIG["punchline_start"], CONFIG["punchline_start"])
    else:
        # One-liner format - display all text throughout
        print("📝 Creating one-liner text (displayed throughout video)...")
        if len(setup_lines) > 0:
            setup1 = make_text(setup_lines[0], "white", CONFIG["setup_line1_y"], AUDIO_DUR, CONFIG["setup_start"])
        else:
            setup1 = None
        if len(setup_lines) > 1:
            setup2 = make_text(setup_lines[1], "white", CONFIG["setup_line2_y"], AUDIO_DUR, CONFIG["setup_start"])
        else:
            setup2 = None
        if len(setup_lines) > 2:
            setup3 = make_text(setup_lines[2], "white", CONFIG["setup_line3_y"], AUDIO_DUR, CONFIG["setup_start"])
        else:
            setup3 = None
        
        # No punchline for one-liners (empty lists)
        punch1 = punch2 = punch3 = None
    
    # Brand watermark
    brand = TextClip(
        text="DadtasticDads",
        font=CONFIG["font"],
        font_size=CONFIG["brand_font_size"],
        color="white",
        stroke_color="black",
        stroke_width=2,
        duration=AUDIO_DUR
    ).with_position(("center", CONFIG["brand_y"]))
    
    # Composite
    print("🎬 Compositing...")
    clips = [bg, setup1, setup2, setup3, punch1, punch2, punch3, brand]
    clips = [c for c in clips if c is not None]  # Filter out None values
    video = CompositeVideoClip(clips, size=(720, 1280))
    video = video.with_audio(audio_clip)
    
    # Render
    print("🎥 Rendering...")
    video.write_videofile(
        output_file,
        fps=30,
        codec="libx264",
        audio_codec="aac",
        audio_bitrate="128k",
        preset="medium",
        threads=4,
        logger=None
    )
    
    print(f"\n✅ Generated: {output_file}")
    print(f"   Size: {os.path.getsize(output_file)/1024/1024:.2f} MB")
    
    return output_file

def verify_video(video_file, joke_id):
    """
    MANDATORY: Extract and verify frames before sending.
    
    This function MUST be called before sending video to Kevin.
    If verification fails, the video MUST NOT be sent.
    """
    import subprocess
    
    print("\n🔍 VERIFICATION STEP (MANDATORY)")
    print("=" * 50)
    
    # Extract frame at 2.5s (setup visible)
    setup_frame = f"{OUTPUT_DIR}/frame-verify-{joke_id}-setup.png"
    print(f"Extracting setup frame at 2.5s...")
    subprocess.run([
        "ffmpeg", "-y",
        "-i", video_file,
        "-ss", "2.5",
        "-vframes", "1",
        "-update", "1",
        setup_frame
    ], capture_output=True)
    
    # Extract frame at 5.0s (punchline visible)
    punchline_frame = f"{OUTPUT_DIR}/frame-verify-{joke_id}-punchline.png"
    print(f"Extracting punchline frame at 5.0s...")
    subprocess.run([
        "ffmpeg", "-y",
        "-i", video_file,
        "-ss", "5.0",
        "-vframes", "1",
        "-update", "1",
        punchline_frame
    ], capture_output=True)
    
    print(f"\n✅ Frames extracted:")
    print(f"   Setup: {setup_frame}")
    print(f"   Punchline: {punchline_frame}")
    print(f"\n⚠️  NEXT STEP: Analyze frames with image tool to verify ALL text is visible")
    print(f"   DO NOT SEND until text is verified 100% visible")
    
    return setup_frame, punchline_frame

def main():
    parser = argparse.ArgumentParser(description="Generate Dad Joke video (VERIFIED TEMPLATE)")
    parser.add_argument("--joke-id", required=True, help="Joke ID (e.g., 12, 13, 14)")
    parser.add_argument("--image", help="Path to background image")
    parser.add_argument("--audio", help="Path to padded audio file")
    parser.add_argument("--format", required=True, choices=['one-liner', 'setup-punchline'], help="Joke format")
    parser.add_argument("--setup", required=False, nargs=3, help="3 lines of setup text")
    parser.add_argument("--punchline", required=False, nargs=3, help="3 lines of punchline text")
    parser.add_argument("--text", required=False, nargs='+', help="Text lines for one-liner")
    parser.add_argument("--skip-verify", action="store_true", help="Skip frame verification (NOT RECOMMENDED)")
    args = parser.parse_args()
    
    # Validate arguments based on format
    if args.format == 'one-liner' and not args.text:
        print("--text required for one-liner format")
        sys.exit(1)
    elif args.format == 'setup-punchline' and (not args.setup or not args.punchline):
        print("--setup and --punchline required for setup-punchline format")
        sys.exit(1)
    
    global JOKE_ID
    JOKE_ID = args.joke_id
    
    # Determine format (auto if not specified)
    joke_format = args.format
    
    # Use provided text from command line
    if args.format == 'one-liner':
        setup_lines = args.text
        punchline_lines = args.text  # One-liners display same text throughout
        joke_text = " ".join(setup_lines)
    else:
        setup_lines = args.setup
        punchline_lines = args.punchline
        joke_text = " ".join(setup_lines + punchline_lines)
    
    # Default paths
    image_file = args.image or f"{OUTPUT_DIR}/{JOKE_ID}-background.png"
    audio_file = args.audio or f"{OUTPUT_DIR}/{JOKE_ID}-audio-padded.mp3"
    
    if not os.path.exists(image_file):
        print(f"❌ Image not found: {image_file}")
        sys.exit(1)
    
    if not os.path.exists(audio_file):
        print(f"❌ Audio not found: {audio_file}")
        sys.exit(1)
    
    # Generate video
    video_file = generate_video(JOKE_ID, joke_text, setup_lines, punchline_lines, image_file, audio_file)
    
    # Verify (MANDATORY unless explicitly skipped)
    if not args.skip_verify:
        setup_frame, punchline_frame = verify_video(video_file, JOKE_ID)
        print(f"\n📋 PRE-SEND CHECKLIST:")
        print(f"   □ Analyzed frames: {setup_frame}, {punchline_frame}")
        print(f"   □ ALL text confirmed 100% visible")
        print(f"   □ No letters truncated at bottom")
        print(f"   □ Brand watermark fully visible")
        print(f"   □ Ready to send to Kevin")
    
    return video_file

if __name__ == "__main__":
    main()
