#!/usr/bin/env python3
"""
Lightweight HTTP API for local Whisper transcription.
Runs on port 8777 by default.
POST /transcribe - upload audio file, returns JSON transcript
GET  /health     - health check
"""
import argparse
import json
import os
import sys
import tempfile
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

# Add venv to path
VENV = "/home/kevin/.openclaw/workspace/whisper-env"
sys.path.insert(0, os.path.join(VENV, "lib", "python3.12", "site-packages"))

model = None
model_size = "base"

def get_model():
    global model
    if model is None:
        from faster_whisper import WhisperModel
        print(f"Loading Whisper model '{model_size}'...")
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        print("Model loaded.")
    return model

class WhisperHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.send_json({"status": "ok", "model": model_size, "loaded": model is not None})
        else:
            self.send_error(404)
    
    def do_POST(self):
        if self.path == "/transcribe":
            self.handle_transcribe()
        else:
            self.send_error(404)
    
    def handle_transcribe(self):
        content_length = int(self.headers.get('Content-Length', 0))
        content_type = self.headers.get('Content-Type', 'audio/wav')
        
        if content_length == 0:
            self.send_json({"error": "No audio data"}, status=400)
            return
        
        # Read audio data
        audio_data = self.rfile.read(content_length)
        
        # Save to temp file
        ext = ".wav"
        if "mp3" in content_type:
            ext = ".mp3"
        elif "m4a" in content_type:
            ext = ".m4a"
        elif "ogg" in content_type:
            ext = ".ogg"
        elif "webm" in content_type:
            ext = ".webm"
        elif "mp4" in content_type:
            ext = ".mp4"
        elif "flac" in content_type:
            ext = ".flac"
        
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
            f.write(audio_data)
            temp_path = f.name
        
        try:
            m = get_model()
            start = time.time()
            
            segments, info = m.transcribe(
                temp_path,
                language=None,  # Auto-detect
                beam_size=5,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=500),
            )
            
            transcript_segments = []
            full_text = []
            for seg in segments:
                transcript_segments.append({
                    "start": round(seg.start, 2),
                    "end": round(seg.end, 2),
                    "text": seg.text.strip()
                })
                full_text.append(seg.text.strip())
            
            elapsed = time.time() - start
            
            result = {
                "text": " ".join(full_text),
                "segments": transcript_segments,
                "language": info.language,
                "language_probability": round(info.language_probability, 4),
                "duration": round(info.duration, 2),
                "processing_time": round(elapsed, 2),
                "speed_ratio": round(info.duration / elapsed, 2) if elapsed > 0 else 0,
                "model": model_size
            }
            
            self.send_json(result)
        except Exception as e:
            self.send_json({"error": str(e)}, status=500)
        finally:
            os.unlink(temp_path)
    
    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def log_message(self, format, *args):
        print(f"[WhisperAPI] {args[0] if args else ''}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8777)
    parser.add_argument("--model", default="base",
                       choices=["tiny", "base", "small", "medium", "large-v3"])
    args = parser.parse_args()
    model_size = args.model
    
    server = HTTPServer(("0.0.0.0", args.port), WhisperHandler)
    server.timeout = 1800  # 30 min timeout for long transcriptions
    print(f"Whisper API running on port {args.port} (model: {model_size})")
    print(f"POST /transcribe - upload audio file")
    print(f"GET  /health - health check")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.server_close()