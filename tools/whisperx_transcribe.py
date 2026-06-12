#!/usr/bin/env python3
"""
WhisperX transcription with speaker diarization.
Usage: python3 whisperx_transcribe.py <audio_file> [--min-speakers N] [--max-speakers N] [--model base|small|medium]
"""
import argparse
import json
import os
import sys
import time
import warnings

warnings.filterwarnings("ignore")
os.environ["HF_HOME"] = os.path.expanduser("~/.huggingface")
# Read token from file (takes precedence over env var, since env may have stale value)
_hf_token_path = os.path.expanduser("~/.huggingface/token")
if os.path.exists(_hf_token_path):
    with open(_hf_token_path) as f:
        os.environ["HF_TOKEN"] = f.read().strip()
    os.environ["HUGGING_FACE_HUB_TOKEN"] = os.environ["HF_TOKEN"]

def main():
    parser = argparse.ArgumentParser(description="WhisperX transcription with speaker diarization")
    parser.add_argument("audio_file", help="Path to audio file")
    parser.add_argument("--min-speakers", type=int, default=2, help="Min number of speakers")
    parser.add_argument("--max-speakers", type=int, default=2, help="Max number of speakers")
    parser.add_argument("--model", default="base", help="Whisper model size (base, small, medium)")
    parser.add_argument("--language", default="en", help="Language code")
    parser.add_argument("--output", help="Output JSON path (default: <input>.diarized.json)")
    parser.add_argument("--output-md", help="Output markdown path (default: <input>_diarized.md)")
    args = parser.parse_args()

    if not os.path.exists(args.audio_file):
        print(f"Error: File not found: {args.audio_file}")
        sys.exit(1)

    start = time.time()

    # Step 1: Load model and transcribe
    from whisperx import load_model, load_audio, align, load_align_model, assign_word_speakers
    from whisperx.diarize import DiarizationPipeline

    print(f"[{time.time()-start:.1f}s] Loading Whisper {args.model} model...")
    model = load_model(args.model, device="cpu", compute_type="int8", language=args.language)
    print(f"[{time.time()-start:.1f}s] Model loaded")

    # Step 2: Load audio
    print(f"[{time.time()-start:.1f}s] Loading audio...")
    audio = load_audio(args.audio_file)
    print(f"[{time.time()-start:.1f}s] Audio loaded ({len(audio)/16000:.1f}s)")

    # Step 3: Transcribe
    print(f"[{time.time()-start:.1f}s] Transcribing...")
    result = model.transcribe(audio, language=args.language)
    print(f"[{time.time()-start:.1f}s] Transcription: {len(result['segments'])} segments")

    # Step 4: Align word timestamps
    print(f"[{time.time()-start:.1f}s] Aligning words...")
    model_a, metadata = load_align_model(args.language, "cpu")
    result_aligned = align(
        result["segments"],
        model_a,
        metadata,
        audio,
        "cpu",
    )
    print(f"[{time.time()-start:.1f}s] Aligned: {len(result_aligned['segments'])} segments")

    # Step 5: Diarize
    print(f"[{time.time()-start:.1f}s] Running speaker diarization (min={args.min_speakers}, max={args.max_speakers})...")
    hf_token = os.environ.get("HF_TOKEN")
    diarize_model = DiarizationPipeline(
        model_name="pyannote/speaker-diarization-3.1",
        token=hf_token,
    )
    diarize_df = diarize_model(audio, min_speakers=args.min_speakers, max_speakers=args.max_speakers)
    print(f"[{time.time()-start:.1f}s] Diarization complete")

    # Step 6: Assign speakers
    final = assign_word_speakers(diarize_df, result_aligned)
    print(f"[{time.time()-start:.1f}s] Speakers assigned")

    # Save JSON
    output_json = args.output or args.audio_file.rsplit(".", 1)[0] + ".diarized.json"
    with open(output_json, "w") as f:
        json.dump(final, f, indent=2, ensure_ascii=False, default=str)
    print(f"[{time.time()-start:.1f}s] Saved JSON: {output_json}")

    # Save readable markdown
    output_md = args.output_md or args.audio_file.rsplit(".", 1)[0] + "_diarized.md"
    speakers = set()
    md_lines = []
    for seg in final["segments"]:
        spk = seg.get("speaker", "UNKNOWN")
        speakers.add(spk)
        md_lines.append(f"**{spk}**: {seg['text'].strip()}")

    md = f"# Transcript: {os.path.basename(args.audio_file)}\n\n"
    md += f"- Model: Whisper {args.model}\n"
    md += f"- Speakers detected: {len(speakers)} ({', '.join(sorted(speakers))})\n"
    md += f"- Duration: {len(audio)/16000:.1f}s\n"
    md += f"- Processing time: {time.time()-start:.1f}s\n\n---\n\n"
    md += "\n\n".join(md_lines)

    with open(output_md, "w") as f:
        f.write(md)
    print(f"[{time.time()-start:.1f}s] Saved markdown: {output_md}")

    # Print preview
    print(f"\n--- Preview (first 15 lines) ---")
    for line in md_lines[:15]:
        print(f"  {line}")

    print(f"\nTotal time: {time.time()-start:.1f}s")
    print(f"Speakers: {', '.join(sorted(speakers))}")


if __name__ == "__main__":
    main()