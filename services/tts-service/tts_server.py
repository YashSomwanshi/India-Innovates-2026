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
_loop = None
_loop_thread = None
_loop_lock = threading.Lock()


def _ensure_loop():
    """Create or restart the persistent event loop if needed."""
    global _loop, _loop_thread
    with _loop_lock:
        if _loop is None or _loop.is_closed():
            _loop = asyncio.new_event_loop()
            _loop_thread = threading.Thread(target=_loop.run_forever, daemon=True)
            _loop_thread.start()
        return _loop


# Start the loop on import
_ensure_loop()


def run_async(coro):
    """Run an async coroutine on the persistent event loop. Thread-safe."""
    loop = _ensure_loop()
    future = asyncio.run_coroutine_threadsafe(coro, loop)
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

    # ── Try edge-tts first (high quality, needs internet) ──
    import time
    edge_available = False
    try:
        import edge_tts
        edge_available = True
    except ImportError:
        print("[TTS] edge-tts not installed, using offline fallback", file=sys.stderr)

    if edge_available:
        max_retries = 2
        for attempt in range(max_retries):
            try:
                if os.path.exists(output_path):
                    try:
                        os.unlink(output_path)
                    except OSError:
                        pass

                async def generate():
                    communicate = edge_tts.Communicate(text, voice, rate=rate)
                    await communicate.save(output_path)

                run_async(generate())

                if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                    return jsonify({
                        "audio_url": f"/audio/{file_id}",
                        "file_id": file_id,
                        "voice": voice,
                        "language": language,
                        "format": "mp3"
                    })
                else:
                    print(f"[TTS] edge-tts attempt {attempt + 1}/{max_retries}: file empty", file=sys.stderr)

            except Exception as e:
                print(f"[TTS] edge-tts attempt {attempt + 1}/{max_retries} failed: {e}", file=sys.stderr)

            if attempt < max_retries - 1:
                time.sleep(0.5)

        print("[TTS] edge-tts failed, falling back to offline pyttsx3", file=sys.stderr)

    # ── Offline fallback: pyttsx3 (uses Windows SAPI5 voices) ──
    try:
        import pyttsx3
        import wave
        import struct

        # pyttsx3 outputs WAV; we'll save as .wav and serve that
        wav_path = os.path.join(OUTPUT_DIR, f"tts_{file_id}.wav")

        engine = pyttsx3.init()
        engine.setProperty("rate", 160)
        engine.setProperty("volume", 1.0)

        # Try to pick a female/male voice
        voices = engine.getProperty("voices")
        if voices:
            if gender == "female":
                for v in voices:
                    if "zira" in v.name.lower() or "female" in v.name.lower():
                        engine.setProperty("voice", v.id)
                        break
            else:
                for v in voices:
                    if "david" in v.name.lower() or "male" in v.name.lower():
                        engine.setProperty("voice", v.id)
                        break

        engine.save_to_file(text, wav_path)
        engine.runAndWait()

        if os.path.exists(wav_path) and os.path.getsize(wav_path) > 0:
            return jsonify({
                "audio_url": f"/audio/{file_id}",
                "file_id": file_id,
                "voice": "pyttsx3-offline",
                "language": language,
                "format": "wav"
            })
        else:
            return jsonify({"error": "Offline TTS also failed to generate audio"}), 500

    except Exception as e:
        print(f"[TTS] Offline fallback error: {e}", file=sys.stderr)
        return jsonify({"error": f"Both online and offline TTS failed: {e}"}), 500


@app.route("/audio/<file_id>", methods=["GET"])
def get_audio(file_id):
    """Serve generated audio file (mp3 from edge-tts or wav from pyttsx3)."""
    # Sanitize file_id to prevent path traversal
    safe_id = "".join(c for c in file_id if c.isalnum() or c == "-")

    # Check for mp3 first (edge-tts), then wav (pyttsx3 fallback)
    mp3_path = os.path.join(OUTPUT_DIR, f"tts_{safe_id}.mp3")
    wav_path = os.path.join(OUTPUT_DIR, f"tts_{safe_id}.wav")

    if os.path.exists(mp3_path):
        return send_file(mp3_path, mimetype="audio/mpeg")
    elif os.path.exists(wav_path):
        return send_file(wav_path, mimetype="audio/wav")
    else:
        return jsonify({"error": "Audio file not found"}), 404


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
