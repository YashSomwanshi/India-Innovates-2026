# 🇮🇳 AI Avatar Civic Communication Platform

> **India Innovates 2026** — AI-powered digital avatar for governance, education, and public outreach.

Disha is a multilingual AI avatar that helps citizens understand government schemes, answer questions about public services, and deliver educational content — all running **locally** with open-source models.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Web Client (:5173)                      │
│   React + Vite │ Avatar Canvas │ Mic │ Chat │ Lang Picker   │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP / WebSocket
┌──────────────────────────▼──────────────────────────────────┐
│                   Gateway API (:4000)                        │
│         Pipeline Orchestration + REST + WebSocket            │
└───┬──────┬──────┬──────┬──────┬─────────────────────────────┘
    │      │      │      │      │
┌───▼──┐ ┌─▼──┐ ┌▼───┐ ┌▼───┐ ┌▼──────┐
│ STT  │ │Trans│ │LLM │ │TTS │ │Avatar │
│:5001 │ │:5002│ │:5003│ │:5004│ │:5005  │
│Whisper│ │Ollama│ │Llama3│ │Edge│ │Canvas │
└──────┘ └─────┘ └─────┘ └────┘ └───────┘
```

## Speech Pipeline

```
🎤 Voice Input → STT (Whisper) → Language Detection
                                       ↓
                              Translation (Ollama)
                                       ↓
                               LLM Response (Llama3)
                                       ↓
                              Translation → Target Lang
                                       ↓
                              TTS (Edge-TTS) → Audio
                                       ↓
                           Avatar Animation (Canvas 2D)
```

## Supported Languages

| Code | Language | Native     |
|------|----------|------------|
| en   | English  | English    |
| hi   | Hindi    | हिन्दी      |
| mr   | Marathi  | मराठी       |
| ta   | Tamil    | தமிழ்      |
| te   | Telugu   | తెలుగు      |
| bn   | Bengali  | বাংলা       |

---

## Quick Start

### Prerequisites

- **Node.js** 18+ ([nodejs.org](https://nodejs.org))
- **Python** 3.9+ ([python.org](https://python.org))
- **Ollama** ([ollama.com](https://ollama.com))

### Automated Setup (Windows)

```bash
cd ai-avatar-platform
scripts\setup.bat
```

### Manual Setup

```bash
# 1. Install Ollama and pull llama3
ollama pull llama3

# 2. Install Node dependencies
cd services/translation-service && npm install && cd ../..
cd services/llm-service && npm install && cd ../..
cd services/avatar-service && npm install && cd ../..
cd backend/gateway-api && npm install && cd ../..
cd frontend/web-client && npm install && cd ../..

# 3. Install Python dependencies
cd services/stt-service && pip install -r requirements.txt && cd ../..
cd services/tts-service && pip install -r requirements.txt && cd ../..
```

### Start the Platform

```bash
node scripts/start-all.js
```

Open **http://localhost:5173** in your browser.

---

## API Endpoints

| Method | Endpoint                   | Description                         |
|--------|---------------------------|-------------------------------------|
| GET    | `/api/health`             | Service health status               |
| POST   | `/api/speech-to-text`     | Upload audio → transcription        |
| POST   | `/api/translate`          | Translate text between languages    |
| POST   | `/api/generate-response`  | Get LLM response                    |
| POST   | `/api/text-to-speech`     | Convert text to audio               |
| POST   | `/api/generate-avatar-video` | Get avatar rendering metadata    |
| POST   | `/api/pipeline`           | Full pipeline (text → response + audio) |
| GET    | `/api/demo`               | Demo response about Digital India   |
| WS     | `/ws`                     | Real-time WebSocket communication   |

---

## Services

| Service     | Port  | Tech              | Description                    |
|-------------|-------|-------------------|--------------------------------|
| STT         | 5001  | faster-whisper    | Speech-to-text + language detection |
| Translation | 5002  | Ollama/Llama3     | Multilingual translation       |
| LLM         | 5003  | Ollama/Llama3     | Governance-focused AI responses |
| TTS         | 5004  | edge-tts          | High-quality multilingual speech |
| Avatar      | 5005  | Canvas 2D         | Avatar rendering metadata      |
| Gateway     | 4000  | Express + WS      | Pipeline orchestration         |
| Frontend    | 5173  | React + Vite      | Web client UI                  |

---

## Demo

1. Start the platform: `node scripts/start-all.js`
2. Open http://localhost:5173
3. Try these prompts:
   - "What is Digital India?"
   - "Explain Ayushman Bharat scheme"
   - Switch to Hindi and ask: "PM Kisan ke baare mein batao"

---

## Folder Structure

```
ai-avatar-platform/
├── services/
│   ├── stt-service/          # Speech-to-Text (Python)
│   ├── translation-service/  # Translation (Node.js)
│   ├── llm-service/          # LLM wrapper (Node.js)
│   ├── tts-service/          # Text-to-Speech (Python)
│   └── avatar-service/       # Avatar metadata (Node.js)
├── backend/
│   └── gateway-api/          # Central orchestrator (Node.js)
├── frontend/
│   └── web-client/           # React UI (Vite)
├── config/
│   └── system-prompt.txt     # Avatar personality
├── scripts/
│   ├── start-all.js          # Multi-service launcher
│   └── setup.bat             # Windows automated setup
├── .env                      # Configuration
├── package.json
└── README.md
```

---

## Tech Stack

| Layer       | Technology                 |
|-------------|---------------------------|
| Frontend    | React 18 + Vite           |
| Backend     | Node.js + Express         |
| AI (STT)    | faster-whisper (Python)   |
| AI (LLM)    | Ollama + Llama3           |
| AI (TTS)    | edge-tts (Microsoft)      |
| Translation | Ollama LLM-based          |
| Avatar      | Canvas 2D + Web Audio API |
| Real-time   | WebSocket                 |

---

*Built for India Innovates 2026 — Civic Technology Hackathon*
