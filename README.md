# 🇮🇳 AI Avatar — Civic Communication Platform

> **India Innovates 2026** — An AI-powered, multilingual avatar platform for real-time civic communication.

Citizens interact with 3D AI avatars representing government officials through natural voice conversations — in **6 Indian languages**. The platform runs on **web and mobile** with full cross-platform synchronization.

---

## ✨ Features

- **3D Avatar Interaction** — Realistic male/female GLB avatars with real-time lip-sync
- **Full Voice Pipeline** — Voice In → STT → LLM → TTS → Avatar speaks back
- **Multilingual Support** — English, Hindi, Marathi, Tamil, Telugu, Bengali
- **Gender-Specific Voices** — Male/female TTS voices matched to avatar gender
- **Cross-Platform** — React web app + React Native (Expo) mobile app
- **Avatar Management** — Create, delete, and sync custom avatars across devices
- **Verified Badge System** — Default government avatars marked as verified
- **Broadcast System** — Avatars can broadcast messages to followers
- **Follow System** — Users can follow avatars and receive notifications
- **Real-Time Sync** — WebSocket-based live updates across all connected clients
- **Echo Prevention** — Microphone auto-mutes during avatar speech
- **Offline STT** — CPU-based Whisper model (no GPU/CUDA required)

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐
│   Web Client    │     │   Mobile App     │
│  (React + Vite) │     │ (Expo + WebView) │
│  Three.js / R3F │     │                  │
└────────┬────────┘     └────────┬─────────┘
         │  REST / WebSocket     │
         └──────────┬────────────┘
                    │
          ┌─────────▼─────────┐
          │   Gateway API     │
          │   (Node.js:4000)  │
          │  ┌──────────────┐ │
          │  │ Avatar Store │ │  ← Single Source of Truth
          │  │ (JSON file)  │ │
          │  └──────────────┘ │
          └──┬────┬────┬──────┘
             │    │    │
     ┌───────▼┐ ┌─▼──┐ ┌▼───────┐
     │  STT   │ │LLM │ │  TTS   │
     │:5001   │ │:11434│ │:5002  │
     │Whisper │ │Ollama│ │edge-tts│
     └────────┘ └─────┘ └────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Web Frontend** | React 18, Vite, Three.js, React Three Fiber |
| **Mobile App** | React Native (Expo), WebView |
| **Gateway API** | Node.js, Express, WebSocket (ws) |
| **STT Service** | Python, faster-whisper (CPU mode) |
| **LLM Service** | Ollama (Llama 3) |
| **TTS Service** | Python, edge-tts (Microsoft Neural Voices) |
| **Translation** | Ollama-based translation pipeline |
| **Data Store** | JSON file-backed storage |
| **3D Avatars** | GLB models with morph target lip-sync |
| **Shared Logic** | Cross-platform JS module (web + mobile) |

---

## 📁 Folder Structure

```
ai-avatar-platform/
├── backend/
│   └── gateway-api/          # Central API server (port 4000)
│       ├── app.js            # Express + WebSocket server
│       ├── avatarStore.js    # Avatar CRUD (JSON-backed)
│       ├── broadcastStore.js # Broadcast storage
│       └── data/             # Runtime data (gitignored)
├── frontend/
│   └── web-client/           # React + Vite web app
│       ├── src/
│       │   ├── App.jsx       # Main app with voice pipeline
│       │   ├── AvatarView.jsx# 3D avatar renderer (Three.js)
│       │   └── components/   # UI components
│       └── public/
│           └── avatars/      # Avatar images + GLB models
├── mobile-app/               # React Native (Expo) app
│   ├── screens/
│   │   ├── AvatarSelectScreen.js
│   │   ├── AvatarCallScreen.js
│   │   └── CreateAvatarScreen.js
│   └── App.js
├── services/
│   ├── stt-service/          # Speech-to-Text (port 5001)
│   ├── tts-service/          # Text-to-Speech (port 5002)
│   ├── llm-service/          # LLM config (Ollama)
│   └── translation-service/  # Translation pipeline
├── shared/                   # Cross-platform shared code
│   ├── config/constants.js   # URLs, IPs, language maps
│   └── services/
│       ├── api.js            # REST API functions
│       └── ws.js             # WebSocket client
├── scripts/
│   ├── start-all.js          # Start all services at once
│   └── setup.bat             # Windows setup script
├── .env.example              # Environment template
└── README.md                 # ← You are here
```

---

## 🚀 Setup & Run

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.9+ with pip
- **Ollama** installed and running ([ollama.com](https://ollama.com))
- **Expo CLI** (`npm install -g expo-cli`) — for mobile

### 1. Clone & Install

```bash
git clone https://github.com/YashSomwanshi/India-Innovates-2026.git
cd ai-avatar-platform

# Install root + gateway dependencies
npm install
cd backend/gateway-api && npm install && cd ../..

# Install web client
cd frontend/web-client && npm install && cd ../..

# Install mobile app
cd mobile-app && npm install && cd ../..

# Install Python services
pip install flask flask-cors faster-whisper edge-tts
```

### 2. Configure Environment

```bash
# Copy the example env file
cp .env.example .env
```

Edit `.env` — set your LAN IP:
```env
GATEWAY_PORT=4000
OLLAMA_URL=http://localhost:11434
```

Also update `shared/config/constants.js`:
```js
const LAN_IP = '192.168.1.9'; // ← Your machine's LAN IP
```

> **Find your LAN IP:** Run `ipconfig` (Windows) or `ifconfig` (Mac/Linux)

### 3. Pull Ollama Model

```bash
ollama pull llama3
```

### 4. Start All Services

```bash
# Start everything at once:
node scripts/start-all.js
```

Or start individually:

| Service | Command | Port |
|---------|---------|------|
| Gateway API | `cd backend/gateway-api && node app.js` | 4000 |
| STT Service | `cd services/stt-service && python stt_server.py` | 5001 |
| TTS Service | `cd services/tts-service && python tts_server.py` | 5002 |
| Web Client | `cd frontend/web-client && npm run dev` | 5173 |
| Ollama | `ollama serve` | 11434 |

### 5. Run Mobile App

```bash
cd mobile-app
npx expo start
```

Scan the QR code with **Expo Go** on your phone (must be on same WiFi network).

---

## 🔊 Voice Pipeline

The end-to-end voice interaction flow:

```
User speaks → Microphone captures audio
    ↓
Audio → STT Service (faster-whisper) → Text
    ↓
Text → Gateway → Ollama LLM (Llama 3) → Response text
    ↓
Response → TTS Service (edge-tts) → Audio file
    ↓
Audio URL → Frontend → 3D Avatar speaks with lip-sync
    ↓
Avatar finishes → Microphone re-enables → Loop
```

**Echo Prevention:** The microphone is physically disabled during avatar speech to prevent feedback loops.

---

## 🤖 Avatar Sync System

All avatars are stored on the **backend** (single source of truth):

| Feature | Details |
|---------|---------|
| **Storage** | `backend/gateway-api/data/avatars.json` |
| **Default Avatars** | 4 pre-configured government personas (protected from deletion) |
| **Custom Avatars** | Users can create via web or mobile |
| **Sync** | WebSocket broadcasts `AVATAR_UPDATED` event to all clients |
| **Verified Badge** | Default avatars show ✔ Verified (blue badge) |
| **Delete Protection** | Default avatars cannot be deleted (`type: "default"`) |

**API Endpoints:**
- `GET /api/avatars` — List all avatars
- `POST /api/avatars/create` — Create custom avatar
- `DELETE /api/avatars/:id` — Delete custom avatar

---

## 🌐 Environment Notes

| Environment | API URL | Notes |
|-------------|---------|-------|
| **Web (dev)** | Relative (`/api/...`) | Vite proxy forwards to localhost:4000 |
| **Mobile** | `http://<LAN_IP>:4000` | Must use LAN IP, not localhost |

> ⚠️ **Mobile apps cannot use `localhost`** — they run on a physical device. Always use your machine's LAN IP address.

---

## 🔧 Troubleshooting

### STT: "cublas64_12.dll not found"
The STT service runs in **CPU-only mode** by default. If you see CUDA errors:
```python
# In stt_server.py — already configured:
model = WhisperModel("base", device="cpu", compute_type="int8")
```

### Mobile: "Network request failed"
1. Ensure phone and computer are on the **same WiFi**
2. Check `shared/config/constants.js` → `LAN_IP` matches your machine
3. Firewall: allow inbound connections on ports 4000, 5173

### Mobile: "AbortSignal.timeout is not a function"
Already fixed — the shared API uses `AbortController` + `setTimeout` instead.

### Mobile: "Only one Recording object"
Already fixed — recording lifecycle properly cleans previous instance before creating new one.

---

## 🗣️ Supported Languages

| Code | Language | TTS Voice (Male) | TTS Voice (Female) |
|------|----------|-------------------|---------------------|
| `en` | English | en-IN-PrabhatNeural | en-IN-NeerjaNeural |
| `hi` | Hindi | hi-IN-MadhurNeural | hi-IN-SwaraNeural |
| `mr` | Marathi | mr-IN-ManoharNeural | mr-IN-AarohiNeural |
| `ta` | Tamil | ta-IN-ValluvarNeural | ta-IN-PallaviNeural |
| `te` | Telugu | te-IN-MohanNeural | te-IN-ShrutiNeural |
| `bn` | Bengali | bn-IN-BashkarNeural | bn-IN-TanishaaNeural |

---

## 🔮 Future Scope

- **Admin Dashboard** — Manage avatars, broadcasts, and user analytics
- **Multi-turn Memory** — Persistent conversation history per user
- **Document Q&A** — Upload PDFs for avatar to reference
- **Sign Language Avatar** — Accessibility support for hearing-impaired users
- **Regional Dialect Support** — Sub-dialect recognition and response
- **Deployment** — Docker containerization + cloud hosting

---

## 👥 Team

**India Innovates 2026** — AI Avatar Civic Communication Platform

---

## 📄 License

This project was built for the India Innovates 2026 hackathon.

---

<p align="center">
  <b>Built with ❤️ for Digital India</b>
</p>
