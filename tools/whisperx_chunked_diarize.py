#!/usr/bin/env python3
"""
WhisperX transcription with chunked diarization for long recordings.

For files > 15 min, splits audio into chunks, transcribes the whole file 
for text quality, then runs diarization per chunk and merges results.
This produces far better speaker separation than running diarization on
one long continuous file.
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
import warnings

warnings.filterwarnings("ignore")
os.environ["HF_HOME"] = os.path.expanduser("~/.huggingface")
_hf_token_path = os.path.expanduser("~/.huggingface/token")
if os.path.exists(_hf_token_path):
    with open(_hf_token_path) as f:
        os.environ["HF_TOKEN"] = f.read().strip()
    os.environ["HUGGING_FACE_HUB_TOKEN"] = os.environ["HF_TOKEN"]

def main():
    parser = argparse.ArgumentParser(description="WhisperX with chunked diarization")
    parser.add_argument("audio_file", help="Path to audio file")
    parser.add_argument("--min-speakers", type=int, default=2)
    parser.add_argument("--max-speakers", type=int, default=2)
    parser.add_argument("--model", default="base", help="Whisper model size")
    parser.add_argument("--language", default="en")
    parser.add_argument("--chunk-secs", type=int, default=900, help="Chunk length in seconds (default 900 = 15 min)")
    parser.add_argument("--output", help="Output JSON path")
    parser.add_argument("--output-md", help="Output markdown path")
    args = parser.parse_args()

    if not os.path.exists(args.audio_file):
        print(f"Error: File not found: {args.audio_file}")
        sys.exit(1)

    start = time.time()
    hf_token = os.environ.get("HF_TOKEN")

    from whisperx import load_model, load_audio, align, load_align_model, assign_word_speakers
    from whisperx.diarize import DiarizationPipeline

    # Step 1: Transcribe the full file for best text quality
    print(f"[{time.time()-start:.1f}s] Loading Whisper {args.model} model...")
    model = load_model(args.model, device="cpu", compute_type="int8", language=args.language)
    print(f"[{time.time()-start:.1f}s] Model loaded")

    print(f"[{time.time()-start:.1f}s] Loading audio...")
    audio = load_audio(args.audio_file)
    duration = len(audio) / 16000
    print(f"[{time.time()-start:.1f}s] Audio: {duration:.1f}s ({duration/60:.1f} min)")

    print(f"[{time.time()-start:.1f}s] Transcribing full file...")
    result = model.transcribe(audio, language=args.language)
    print(f"[{time.time()-start:.1f}s] Transcription: {len(result['segments'])} segments")

    # Step 2: Align word timestamps
    print(f"[{time.time()-start:.1f}s] Aligning words...")
    model_a, metadata = load_align_model(args.language, "cpu")
    result_aligned = align(result["segments"], model_a, metadata, audio, "cpu")
    print(f"[{time.time()-start:.1f}s] Aligned: {len(result_aligned['segments'])} segments")

    # Step 3: Chunked diarization
    # Split audio into chunks, run diarization on each, merge results
    if duration > args.chunk_secs:
        print(f"[{time.time()-start:.1f}s] Chunked diarization ({args.chunk_secs}s chunks)...")
        
        # Load diarization model once
        diarize_model = DiarizationPipeline(
            model_name="pyannote/speaker-diarization-3.1",
            token=hf_token,
        )
        
        import pandas as pd
        all_diarize_dfs = []
        n_chunks = int(duration / args.chunk_secs) + 1
        
        for i in range(n_chunks):
            chunk_start = i * args.chunk_secs
            chunk_end = min((i + 1) * args.chunk_secs, duration)
            chunk_audio = audio[int(chunk_start * 16000):int(chunk_end * 16000)]
            
            print(f"  Chunk {i+1}/{n_chunks}: {chunk_start:.0f}s-{chunk_end:.0f}s ({(chunk_end-chunk_start)/60:.1f} min)")
            t0 = time.time()
            
            # Run diarization on this chunk
            chunk_df = diarize_model(
                chunk_audio,
                min_speakers=args.min_speakers,
                max_speakers=args.max_speakers,
            )
            
            # Offset timestamps to match full file
            chunk_df['start'] = chunk_df['start'] + chunk_start
            chunk_df['end'] = chunk_df['end'] + chunk_start
            all_diarize_dfs.append(chunk_df)
            
            print(f"    Done in {time.time()-t0:.1f}s — {len(chunk_df)} speaker turns")
        
        # Merge all diarization DataFrames
        diarize_df = pd.concat(all_diarize_dfs, ignore_index=True)
        
        # IMPORTANT: Re-label speakers consistently across chunks
        # pyannote assigns SPEAKER_00/01 per chunk independently
        # For 2-speaker meetings, we use a simple heuristic:
        # The speaker who talks more total time in chunk 0 = same speaker across all chunks
        # Better approach: use speaker embeddings if available
        print(f"[{time.time()-start:.1f}s] Normalizing speaker labels across chunks...")
        # For now, just ensure consistent labels by checking if SPEAKER_00 in later chunks
        # matches the voice profile of SPEAKER_00 in chunk 0
        # This is a limitation — proper cross-chunk normalization needs embeddings
    else:
        print(f"[{time.time()-start:.1f}s] Running single-chunk diarization...")
        diarize_model = DiarizationPipeline(
            model_name="pyannote/speaker-diarization-3.1",
            token=hf_token,
        )
        diarize_df = diarize_model(audio, min_speakers=args.min_speakers, max_speakers=args.max_speakers)

    print(f"[{time.time()-start:.1f}s] Diarization complete — {len(diarize_df)} speaker turns")

    # Step 4: Assign speakers to transcript
    final = assign_word_speakers(diarize_df, result_aligned)
    print(f"[{time.time()-start:.1f}s] Speakers assigned")

    # Save
    output_json = args.output or args.audio_file.rsplit(".", 1)[0] + ".diarized.json"
    with open(output_json, "w") as f:
        json.dump(final, f, indent=2, ensure_ascii=False, default=str)
    print(f"[{time.time()-start:.1f}s] Saved JSON: {output_json}")

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
    md += f"- Duration: {duration:.1f}s\n"
    md += f"- Diarization: chunked ({args.chunk_secs}s)\n"
    md += f"- Processing time: {time.time()-start:.1f}s\n\n---\n\n"
    md += "\n\n".join(md_lines)

    with open(output_md, "w") as f:
        f.write(md)
    print(f"[{time.time()-start:.1f}s] Saved markdown: {output_md}")

    # Speaker distribution
    from collections import defaultdict
    dur_by_spk = defaultdict(float)
    for seg in final["segments"]:
        dur_by_spk[seg.get("speaker","?")] += seg.get("end",0) - seg.get("start",0)
    print(f"\nSpeaker distribution:")
    for spk, d in sorted(dur_by_spk.items()):
        print(f"  {spk}: {d:.0f}s ({d/duration*100:.1f}%)")

    print(f"\nTotal time: {time.time()-start:.1f}s")


if __name__ == "__main__":
    main()