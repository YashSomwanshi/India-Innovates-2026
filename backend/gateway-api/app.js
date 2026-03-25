/**
 * Gateway API — Central pipeline orchestrator
 * Port: 4000
 * 
 * Orchestrates: STT → Translation → LLM → TTS → Avatar
 * Supports REST API + WebSocket for real-time interaction.
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config(); // Ensure dotenv is loaded so process.env is populated

// LAYER 7: RUNTIME SAFETY CHECK
const requiredEnvs = ['GATEWAY_PORT', 'OLLAMA_URL'];
requiredEnvs.forEach(key => {
  if (!process.env[key]) {
    throw new Error(`CRITICAL: Missing ${key} in environment variables. Do not commit secrets.`);
  }
});

const app = express();
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

const PORT = parseInt(process.env.GATEWAY_PORT || '4000');

// Service URLs
const SERVICES = {
  stt: process.env.STT_URL || 'http://localhost:5001',
  translate: process.env.TRANSLATE_URL || 'http://localhost:5002',
  llm: process.env.LLM_URL || 'http://localhost:5003',
  tts: process.env.TTS_URL || 'http://localhost:5004',
  avatar: process.env.AVATAR_URL || 'http://localhost:5005',
};

// ─── Helper: call a service ───
async function callService(name, endpoint, options = {}) {
  const url = `${SERVICES[name]}${endpoint}`;
  try {
    const res = await fetch(url, {
      method: options.method || 'POST',
      headers: options.headers || { 'Content-Type': 'application/json' },
      body: options.body,
      signal: AbortSignal.timeout(120000), // 2 min timeout
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`${name} service error (${res.status}): ${errText}`);
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'TimeoutError') throw new Error(`${name} service timeout`);
    throw err;
  }
}

// ─── Helper: Live Data Fetching & Caching ───
const liveDataCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function sanitizeHtml(str) {
  if (!str) return '';
  // Basic validation: strip HTML, multiple spaces, keep it alphanumeric + basic punctuation
  return str.replace(/<\/?[^>]+(>|$)/g, "").replace(/\s+/g, " ").trim();
}

async function fetchLiveData(query) {
  const q = query.toLowerCase();
  
  // 1. Check Cache (Layer 6)
  if (liveDataCache.has(q)) {
    const entry = liveDataCache.get(q);
    if (Date.now() - entry.timestamp < CACHE_TTL) {
      return entry.data;
    }
    liveDataCache.delete(q);
  }

  let structuredData = { source: 'fallback', data: [] };

  try {
    if (q.includes('weather')) {
       // Open free weather API (extract city if present)
       const cityMatch = q.match(/in\s+([a-zA-Z]+)/i) || q.match(/for\s+([a-zA-Z]+)/i);
       const city = cityMatch ? cityMatch[1] : '';
       const res = await fetch(`https://wttr.in/${city}?format=3`, { signal: AbortSignal.timeout(5000) });
       if (res.ok) {
         const text = await res.text();
         if (text) structuredData = { source: 'weather', data: [text.trim()] };
       }
    } else {
       // Mock fallback / Wikipedia search for generic news/info
       const searchTerms = encodeURIComponent(query.replace(/(today|latest|current|recent|news|now|price|weather)/ig, '').trim() || 'India events');
       const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${searchTerms}&utf8=&format=json`, { signal: AbortSignal.timeout(5000) });
       if (res.ok) {
           const json = await res.json();
           const snippet = sanitizeHtml(json.query?.search?.[0]?.snippet); // strip HTML safely (Layer 8)
           if (snippet) {
             structuredData = { source: 'search', data: [`Top search result for "${decodeURIComponent(searchTerms)}": ${snippet}`] };
           }
       }
    }
  } catch (err) {
    console.error('[Gateway] Live Data API error:', err.message); // Fallback error logging (Layer 5)
  }

  // 2. Validate empty
  if (!structuredData.data || structuredData.data.length === 0) {
    structuredData = { source: 'fallback', data: [] };
  }
  
  liveDataCache.set(q, { timestamp: Date.now(), data: structuredData });
  return structuredData;
}

// ─── Health Check ───
app.get('/api/health', async (req, res) => {
  const checks = {};
  for (const [name, url] of Object.entries(SERVICES)) {
    try {
      const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
      const data = await r.json();
      checks[name] = { status: 'ok', ...data };
    } catch {
      checks[name] = { status: 'unreachable' };
    }
  }
  res.json({ gateway: 'ok', port: PORT, services: checks });
});

// ─── Speech-to-Text ───
app.post('/api/speech-to-text', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file' });

    // Use Node's built-in FormData + Blob (works with built-in fetch)
    const form = new globalThis.FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype || 'audio/webm' });
    const filename = req.file.originalname || 'recording.webm';
    form.append('audio', blob, filename);

    const sttRes = await fetch(`${SERVICES.stt}/transcribe`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(60000),
    });

    const data = await sttRes.json();
    res.json(data);
  } catch (err) {
    console.error('[Gateway] STT error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Translate ───
app.post('/api/translate', async (req, res) => {
  try {
    const result = await callService('translate', '/translate', {
      body: JSON.stringify(req.body),
    });
    res.json(result);
  } catch (err) {
    console.error('[Gateway] Translate error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Generate Response (LLM) ───
app.post('/api/generate-response', async (req, res) => {
  try {
    const result = await callService('llm', '/generate', {
      body: JSON.stringify(req.body),
    });
    res.json(result);
  } catch (err) {
    console.error('[Gateway] LLM error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Text-to-Speech ───
app.post('/api/text-to-speech', async (req, res) => {
  try {
    const result = await callService('tts', '/synthesize', {
      body: JSON.stringify(req.body),
    });
    // Rewrite audio URL to proxy through gateway
    if (result.audio_url) {
      result.audio_url = `${SERVICES.tts}${result.audio_url}`;
    }
    res.json(result);
  } catch (err) {
    console.error('[Gateway] TTS error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Generate Avatar Video ───
app.post('/api/generate-avatar-video', async (req, res) => {
  try {
    const result = await callService('avatar', '/generate-avatar-video', {
      body: JSON.stringify(req.body),
    });
    res.json(result);
  } catch (err) {
    console.error('[Gateway] Avatar error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Audio Proxy (solves CORS for frontend audio playback) ───
app.get('/api/audio/:fileId', async (req, res) => {
  try {
    const audioRes = await fetch(`${SERVICES.tts}/audio/${req.params.fileId}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!audioRes.ok) return res.status(404).json({ error: 'Audio not found' });
    const contentType = audioRes.headers.get('Content-Type') || 'audio/mpeg';
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=3600');
    const buffer = Buffer.from(await audioRes.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'Audio proxy error' });
  }
});

// ─── Stream Pipeline (SSE) ───
app.post('/api/stream', async (req, res) => {
  const { message, language, history } = req.body;
  if (!message) return res.status(400).json({ error: 'Missing "message"' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const targetLang = language || 'en';

  // 1. Check for quick cached queries (Layer 6 & 10)
  const quickAnswers = {
    'hi': 'Hello! How can I help you today?',
    'hello': 'Hi there! What can I assist you with?',
    'namaste': 'Namaste! How may I help you?',
    'how are you': 'I am doing well, thank you for asking! How can I help you regarding government services?'
  };
  const lowerMsg = message.toLowerCase().trim();
  if (quickAnswers[lowerMsg]) {
    const ans = quickAnswers[lowerMsg];
    res.write(`data: ${JSON.stringify({ type: 'text', chunk: ans })}\n\n`);
    try {
      const ttsResult = await callService('tts', '/synthesize', {
        body: JSON.stringify({ text: ans, language: targetLang, gender: 'male' }),
      });
      if (ttsResult.file_id) {
        res.write(`data: ${JSON.stringify({ type: 'audio', url: `/api/audio/${ttsResult.file_id}`, index: 0 })}\n\n`);
      }
    } catch (e) {
      console.warn('TTS skip:', e.message);
    }
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    return res.end();
  }

  // 2. Stream from LLM
  try {
    let processedMessage = message;
    if (targetLang !== 'en') {
      const translateResult = await callService('translate', '/translate', {
        body: JSON.stringify({ text: message, source_lang: targetLang, target_lang: 'en' }),
      });
      processedMessage = translateResult.translated_text || message;
    }

    const ttsTasks = [];
    let sentenceIndex = 0;

    const processSentence = async (sentence, idx) => {
      let finalSentence = sentence;
      if (targetLang !== 'en') {
        try {
          const tr = await callService('translate', '/translate', {
             body: JSON.stringify({ text: sentence, source_lang: 'en', target_lang: targetLang }),
          });
          finalSentence = tr.translated_text || sentence;
        } catch(e) {}
      }
      
      try {
        const ttsResult = await callService('tts', '/synthesize', {
          body: JSON.stringify({ text: finalSentence, language: targetLang, gender: 'male' }),
        });
        if (ttsResult.file_id) {
          res.write(`data: ${JSON.stringify({ type: 'audio', url: `/api/audio/${ttsResult.file_id}`, index: idx })}\n\n`);
        }
      } catch (e) {
        // ignore TTS errors here
      }
    };

    // Pre-filler for instant partial speech (Layer 5 / 7)
    // Check for real-time intent to customize the filler
    const liveDataKeywords = /(today|latest|current|recent|news|now|price|weather)/i;
    let fetchedData = { source: 'fallback', data: [] };
    let isLiveDataQuery = liveDataKeywords.test(processedMessage);

    console.log("Query:", processedMessage);                        // Layer 10
    console.log("Use Live Data:", isLiveDataQuery);                 // Layer 10

    if (targetLang === 'en') {
       let filler = "";
       if (isLiveDataQuery) {
           filler = "Let me check the latest information. ";
       } else {
           const fillers = ["Sure let me think about that. ", "Let's take a look. ", "Okay, I can help with that. "];
           filler = fillers[Math.floor(Math.random() * fillers.length)];
       }
       res.write(`data: ${JSON.stringify({ type: 'text', chunk: filler })}\n\n`);
       ttsTasks.push(processSentence(filler.trim(), sentenceIndex++));
    }

    // 3. Real-Time Data Fetch (Layer 2 & 4)
    if (isLiveDataQuery) {
       fetchedData = await fetchLiveData(processedMessage);
       console.log("Live Data:", fetchedData);                      // Layer 10
    }

    // We need to fetch from llm-service/generate-stream
    const llmRes = await fetch(`${SERVICES.llm}/generate-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
         message: processedMessage, 
         language: 'en', 
         history: history || [],
         live_data: fetchedData // Layer 3: Augment LLM Input structured
      }),
    });

    if (!llmRes.ok) throw new Error('LLM Stream failed');

    const reader = llmRes.body.getReader();
    const decoder = new TextDecoder();
    
    let buffer = '';
    let jsonBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      jsonBuffer += decoder.decode(value, { stream: true });
      const lines = jsonBuffer.split('\n');
      jsonBuffer = lines.pop(); // keep incomplete line
      
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.response) {
            const token = parsed.response;
            res.write(`data: ${JSON.stringify({ type: 'text', chunk: token })}\n\n`);
            
            buffer += token;
            const sentenceMatch = buffer.match(/([^.?!]+[.?!]+(?:\s+|$))(.*)/);
            if (sentenceMatch) {
               const sentence = sentenceMatch[1];
               buffer = sentenceMatch[2] || '';
               ttsTasks.push(processSentence(sentence.trim(), sentenceIndex++));
            }
          }
        } catch (e) {
            // ignore JSON parse error on single events
        }
      }
    }
    
    if (buffer.trim()) {
      ttsTasks.push(processSentence(buffer.trim(), sentenceIndex++));
    }
    
    // Wait for all TTS chunks to be sent
    await Promise.allSettled(ttsTasks);
    
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
    res.end();
  }
});

// ─── Full Pipeline (text input) ───
app.post('/api/pipeline', async (req, res) => {
  const startTime = Date.now();
  const { message, language, history } = req.body;

  if (!message) return res.status(400).json({ error: 'Missing "message"' });

  const targetLang = language || 'en';
  const stages = [];

  try {
    // Stage 1: Detect language of input (if not English)
    let inputLang = 'en';
    let processedMessage = message;

    if (targetLang !== 'en') {
      // Translate user message to English for LLM
      const translateResult = await callService('translate', '/translate', {
        body: JSON.stringify({ text: message, source_lang: targetLang, target_lang: 'en' }),
      });
      processedMessage = translateResult.translated_text || message;
      stages.push({ stage: 'translate_input', time: Date.now() - startTime });
    }

    // Stage 2: Get LLM response (in English)
    const llmResult = await callService('llm', '/generate', {
      body: JSON.stringify({ message: processedMessage, language: 'en', history: history || [] }),
    });
    const englishResponse = llmResult.response;
    stages.push({ stage: 'llm', time: Date.now() - startTime });

    // Stage 3: Translate response to target language
    let finalResponse = englishResponse;
    if (targetLang !== 'en') {
      const translateResult = await callService('translate', '/translate', {
        body: JSON.stringify({ text: englishResponse, source_lang: 'en', target_lang: targetLang }),
      });
      finalResponse = translateResult.translated_text || englishResponse;
      stages.push({ stage: 'translate_output', time: Date.now() - startTime });
    }

    // Stage 4: Text-to-Speech
    let audioUrl = null;
    try {
      const ttsResult = await callService('tts', '/synthesize', {
        body: JSON.stringify({ text: finalResponse, language: targetLang, gender: 'male' }),
      });
      audioUrl = ttsResult.file_id ? `/api/audio/${ttsResult.file_id}` : null;
      stages.push({ stage: 'tts', time: Date.now() - startTime });
    } catch (e) {
      console.warn('[Gateway] TTS unavailable, skipping audio');
    }

    // Stage 5: Avatar metadata
    let avatarData = null;
    try {
      avatarData = await callService('avatar', '/generate-avatar-video', {
        body: JSON.stringify({ audio_url: audioUrl, text: finalResponse, language: targetLang }),
      });
      stages.push({ stage: 'avatar', time: Date.now() - startTime });
    } catch (e) {
      console.warn('[Gateway] Avatar unavailable');
    }

    const totalTime = Date.now() - startTime;

    res.json({
      response: finalResponse,
      original_response: englishResponse,
      language: targetLang,
      audio_url: audioUrl,
      avatar: avatarData,
      pipeline: { stages, total_time_ms: totalTime },
    });

  } catch (err) {
    console.error('[Gateway] Pipeline error:', err.message);
    res.status(500).json({ error: err.message, stages });
  }
});

// ─── Demo endpoint ───
app.get('/api/demo', async (req, res) => {
  try {
    const demoResult = await callService('llm', '/generate', {
      body: JSON.stringify({
        message: 'Explain the Digital India scheme in 3 sentences.',
        language: 'en',
        history: []
      }),
    });
    res.json({
      demo: true,
      question: 'Explain the Digital India scheme in 3 sentences.',
      response: demoResult.response,
    });
  } catch (err) {
    res.status(500).json({ error: 'Demo requires LLM service. Start Ollama first.' });
  }
});

// ─── WebSocket for real-time interaction ───
wss.on('connection', (ws) => {
  console.log('[WS] Client connected');

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'text') {
        // Send pipeline stages in real-time
        ws.send(JSON.stringify({ type: 'status', stage: 'processing', message: 'Generating response...' }));

        const { message, language, history } = msg;
        const targetLang = language || 'en';

        // LLM
        let processedMsg = message;
        if (targetLang !== 'en') {
          ws.send(JSON.stringify({ type: 'status', stage: 'translating_input' }));
          const tr = await callService('translate', '/translate', {
            body: JSON.stringify({ text: message, source_lang: targetLang, target_lang: 'en' }),
          });
          processedMsg = tr.translated_text || message;
        }

        ws.send(JSON.stringify({ type: 'status', stage: 'thinking' }));
        const llmResult = await callService('llm', '/generate', {
          body: JSON.stringify({ message: processedMsg, language: 'en', history: history || [] }),
        });

        let finalResponse = llmResult.response;
        if (targetLang !== 'en') {
          ws.send(JSON.stringify({ type: 'status', stage: 'translating_output' }));
          const tr = await callService('translate', '/translate', {
            body: JSON.stringify({ text: finalResponse, source_lang: 'en', target_lang: targetLang }),
          });
          finalResponse = tr.translated_text || finalResponse;
        }

        // TTS
        let audioUrl = null;
        try {
          ws.send(JSON.stringify({ type: 'status', stage: 'synthesizing_voice' }));
          const ttsResult = await callService('tts', '/synthesize', {
            body: JSON.stringify({ text: finalResponse, language: targetLang }),
          });
          audioUrl = ttsResult.file_id ? `/api/audio/${ttsResult.file_id}` : null;
        } catch (e) { /* TTS optional */ }

        ws.send(JSON.stringify({
          type: 'response',
          response: finalResponse,
          language: targetLang,
          audio_url: audioUrl,
        }));
      }

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }

    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', error: err.message }));
    }
  });

  ws.on('close', () => console.log('[WS] Client disconnected'));
});

// ─── Start server ───
server.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║   AI Avatar Gateway API — Port ${PORT}      ║`);
  console.log(`╠══════════════════════════════════════════╣`);
  console.log(`║  REST:  http://localhost:${PORT}/api/health  ║`);
  console.log(`║  WS:    ws://localhost:${PORT}/ws            ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);
});
