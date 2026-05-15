#!/usr/bin/env python3
"""
Local Whisper transcription using faster-whisper (CPU).
Usage: python3 whisper-transcribe.py <audio_file> [--model base] [--language en]
Outputs transcript to stdout and <input>.txt
"""
import argparse
import os
import sys
import time

def transcribe(audio_path, model_size="base", language=None):
    from faster_whisper import WhisperModel
    
    print(f"Loading model '{model_size}' (first run downloads ~150MB)...", file=sys.stderr)
    start = time.time()
    
    # Use CPU with INT8 quantization for speed
    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    load_time = time.time() - start
    print(f"Model loaded in {load_time:.1f}s", file=sys.stderr)
    
    print(f"Transcribing: {audio_path}", file=sys.stderr)
    start = time.time()
    
    segments, info = model.transcribe(
        audio_path,
        language=language,
        beam_size=5,
        vad_filter=True,  # Voice activity detection - skips silence
        vad_parameters=dict(min_silence_duration_ms=500),
    )
    
    transcript_lines = []
    for segment in segments:
        timestamp = f"[{segment.start:.1f}s - {segment.end:.1f}s]"
        line = f"{timestamp} {segment.text.strip()}"
        transcript_lines.append(line)
        print(line, file=sys.stderr)
    
    transcribe_time = time.time() - start
    duration = info.duration
    print(f"\nTranscribed {duration:.1f}s of audio in {transcribe_time:.1f}s ({duration/transcribe_time:.1f}x real-time)", file=sys.stderr)
    print(f"Language: {info.language} (probability: {info.language_probability:.2%})", file=sys.stderr)
    
    # Write transcript to file
    txt_path = os.path.splitext(audio_path)[0] + ".txt"
    with open(txt_path, "w") as f:
        f.write(f"Transcription of: {os.path.basename(audio_path)}\n")
        f.write(f"Language: {info.language} ({info.language_probability:.2%})\n")
        f.write(f"Duration: {duration:.1f}s\n")
        f.write(f"Model: {model_size}\n")
        f.write("=" * 60 + "\n\n")
        for line in transcript_lines:
            f.write(line + "\n")
    
    print(f"Transcript saved to: {txt_path}", file=sys.stderr)
    
    # Also output clean text (no timestamps) to stdout
    for segment_lines in transcript_lines:
        # Extract text after timestamp
        parts = segment_lines.split(" ", 2)
        if len(parts) >= 3:
            print(parts[2])
        else:
            print(segment_lines)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Transcribe audio with local Whisper")
    parser.add_argument("audio", help="Path to audio file")
    parser.add_argument("--model", default="base", 
                       choices=["tiny", "base", "small", "medium", "large-v3"],
                       help="Model size (tiny=fastest, large-v3=best accuracy)")
    parser.add_argument("--language", default=None,
                       help="Language code (e.g., 'en'). Auto-detects if omitted.")
    args = parser.parse_args()
    
    if not os.path.exists(args.audio):
        print(f"Error: File not found: {args.audio}", file=sys.stderr)
        sys.exit(1)
    
    transcribe(args.audio, args.model, args.language)