"""
STT Service — Speech-to-Text using faster-whisper
Port: 5001
Accepts audio upload, returns transcription + detected language.
"""

import os
import sys
import tempfile
import json
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Lazy-load model
_model = None

def get_model():
    global _model
    if _model is None:
        try:
            from faster_whisper import WhisperModel
            model_size = os.environ.get("WHISPER_MODEL", "small")
            # Use GPU if available, else CPU
            try:
                _model = WhisperModel(model_size, device="cuda", compute_type="float16")
                print(f"[STT] Loaded {model_size} model on GPU")
            except Exception:
                _model = WhisperModel(model_size, device="cpu", compute_type="int8")
                print(f"[STT] Loaded {model_size} model on CPU")
        except ImportError:
            print("[STT] faster-whisper not installed. Install with: pip install faster-whisper")
            return None
    return _model


LANGUAGE_MAP = {
    "en": "english",
    "hi": "hindi",
    "mr": "marathi",
    "ta": "tamil",
    "te": "telugu",
    "bn": "bengali",
}


@app.route("/health", methods=["GET"])
def health():
    model = get_model()
    return jsonify({
        "service": "stt-service",
        "status": "ok" if model else "model_not_loaded",
        "port": 5001
    })


@app.route("/transcribe", methods=["POST"])
def transcribe():
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided. Send as 'audio' field."}), 400

    audio_file = request.files["audio"]

    # Save to temp file
    suffix = os.path.splitext(audio_file.filename)[1] if audio_file.filename else ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name

    try:
        model = get_model()
        if not model:
            return jsonify({"error": "Whisper model not loaded"}), 503

        # Transcribe
        segments, info = model.transcribe(tmp_path, beam_size=5)

        text_parts = []
        for segment in segments:
            text_parts.append(segment.text)

        full_text = " ".join(text_parts).strip()
        detected_lang = info.language if info.language else "en"

        return jsonify({
            "text": full_text,
            "language": detected_lang,
            "language_name": LANGUAGE_MAP.get(detected_lang, detected_lang),
            "confidence": round(info.language_probability, 3) if info.language_probability else 0.0,
            "duration": round(info.duration, 2) if info.duration else 0.0
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@app.route("/speech-to-text", methods=["POST"])
def speech_to_text():
    """Alias for /transcribe — matches gateway API naming."""
    return transcribe()


if __name__ == "__main__":
    port = int(os.environ.get("STT_PORT", 5001))
    print(f"[STT Service] Starting on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=False)
