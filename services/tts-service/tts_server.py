"""
TTS Service — Text-to-Speech using edge-tts
Port: 5004
High-quality multilingual TTS with Microsoft Azure voices.
Uses a persistent event loop in a background thread to avoid asyncio.run() issues.
"""

import os
import sys
import asyncio
import threading
import uuid
import json
from pathlib import Path
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Output directory for generated audio
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Persistent event loop in background thread (fixes asyncio.run() failures)
_loop = asyncio.new_event_loop()
_loop_thread = threading.Thread(target=_loop.run_forever, daemon=True)
_loop_thread.start()


def run_async(coro):
    """Run an async coroutine on the persistent event loop. Thread-safe."""
    future = asyncio.run_coroutine_threadsafe(coro, _loop)
    return future.result(timeout=60)


# Voice mappings for Indian languages
VOICE_MAP = {
    "en": "en-IN-NeerjaNeural",
    "hi": "hi-IN-SwaraNeural",
    "mr": "mr-IN-AarohiNeural",
    "ta": "ta-IN-PallaviNeural",
    "te": "te-IN-ShrutiNeural",
    "bn": "bn-IN-TanishaaNeural",
}

VOICE_MAP_MALE = {
    "en": "en-IN-PrabhatNeural",
    "hi": "hi-IN-MadhurNeural",
    "mr": "mr-IN-ManoharNeural",
    "ta": "ta-IN-ValluvarNeural",
    "te": "te-IN-MohanNeural",
    "bn": "bn-IN-BashkarNeural",
}


@app.route("/health", methods=["GET"])
def health():
    try:
        import edge_tts
        return jsonify({"service": "tts-service", "status": "ok", "port": 5004, "engine": "edge-tts"})
    except ImportError:
        return jsonify({"service": "tts-service", "status": "error", "error": "edge-tts not installed"})


@app.route("/synthesize", methods=["POST"])
def synthesize():
    try:
        import edge_tts
    except ImportError:
        return jsonify({"error": "edge-tts not installed. Run: pip install edge-tts"}), 503

    data = request.json
    if not data or "text" not in data:
        return jsonify({"error": "Missing 'text' field"}), 400

    text = data["text"]
    language = data.get("language", "en")
    gender = data.get("gender", "female")
    rate = data.get("rate", "+0%")

    # Select voice
    voice_map = VOICE_MAP if gender == "female" else VOICE_MAP_MALE
    voice = voice_map.get(language, VOICE_MAP.get("en"))

    # Generate unique filename
    file_id = str(uuid.uuid4())[:8]
    output_path = os.path.join(OUTPUT_DIR, f"tts_{file_id}.mp3")

    try:
        async def generate():
            communicate = edge_tts.Communicate(text, voice, rate=rate)
            await communicate.save(output_path)

        # Use persistent event loop — reliable across multiple calls
        run_async(generate())

        # Verify file was created
        if not os.path.exists(output_path):
            return jsonify({"error": "Audio file was not generated"}), 500

        return jsonify({
            "audio_url": f"/audio/{file_id}",
            "file_id": file_id,
            "voice": voice,
            "language": language,
            "format": "mp3"
        })

    except Exception as e:
        print(f"[TTS] Error: {e}", file=sys.stderr)
        return jsonify({"error": str(e)}), 500


@app.route("/audio/<file_id>", methods=["GET"])
def get_audio(file_id):
    """Serve generated audio file."""
    # Sanitize file_id to prevent path traversal
    safe_id = "".join(c for c in file_id if c.isalnum() or c == "-")
    file_path = os.path.join(OUTPUT_DIR, f"tts_{safe_id}.mp3")
    if not os.path.exists(file_path):
        return jsonify({"error": "Audio file not found"}), 404
    return send_file(file_path, mimetype="audio/mpeg")


@app.route("/text-to-speech", methods=["POST"])
def text_to_speech():
    """Alias for /synthesize."""
    return synthesize()


@app.route("/voices", methods=["GET"])
def list_voices():
    return jsonify({"female": VOICE_MAP, "male": VOICE_MAP_MALE})


# Cleanup old files on startup
def cleanup_old_files():
    import time
    now = time.time()
    count = 0
    for f in Path(OUTPUT_DIR).glob("tts_*.mp3"):
        if now - f.stat().st_mtime > 3600:
            f.unlink(missing_ok=True)
            count += 1
    if count:
        print(f"[TTS] Cleaned up {count} old audio files")


if __name__ == "__main__":
    cleanup_old_files()
    port = int(os.environ.get("TTS_PORT", 5004))
    print(f"[TTS Service] Starting on port {port}...")
    print(f"[TTS Service] Voices: {list(VOICE_MAP.keys())}")
    print(f"[TTS Service] Async loop: persistent thread (reliable)")
    app.run(host="0.0.0.0", port=port, debug=False)
