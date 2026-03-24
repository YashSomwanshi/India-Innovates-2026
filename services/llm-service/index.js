/**
 * LLM Service — Ollama/Llama3 wrapper
 * Port: 5003
 * Provides governance-focused AI responses via local LLM.
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';
const PORT = parseInt(process.env.LLM_PORT || '5003');

// Load system prompt
let systemPrompt = '';
try {
  const promptPath = path.join(__dirname, '..', '..', 'config', 'system-prompt.txt');
  systemPrompt = fs.readFileSync(promptPath, 'utf-8').trim();
  console.log('[LLM] System prompt loaded');
} catch (e) {
  systemPrompt = 'You are a helpful AI civic assistant for the Government of India named Disha.';
  console.log('[LLM] Using default system prompt');
}

async function generateResponse(userMessage, language = 'en', conversationHistory = []) {
  let prompt = systemPrompt + '\n\n';

  // Add language instruction
  const langNames = { en: 'English', hi: 'Hindi', mr: 'Marathi', ta: 'Tamil', te: 'Telugu', bn: 'Bengali' };
  const langName = langNames[language] || 'English';
  prompt += `Respond in ${langName}.\n\n`;

  // Add conversation history (last 6 exchanges)
  const recentHistory = conversationHistory.slice(-6);
  for (const msg of recentHistory) {
    if (msg.role === 'user') prompt += `User: ${msg.content}\n`;
    else if (msg.role === 'assistant') prompt += `Assistant: ${msg.content}\n`;
  }

  prompt += `User: ${userMessage}\nAssistant:`;

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: 0.5,
        num_predict: 150,
        top_p: 0.9,
      }
    })
  });

  if (!res.ok) throw new Error(`Ollama error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.response?.trim() || 'I apologize, I could not generate a response.';
}

// Health check
app.get('/health', async (req, res) => {
  try {
    const ollamaRes = await fetch(`${OLLAMA_URL}/api/tags`);
    const tags = await ollamaRes.json();
    const hasModel = tags.models?.some(m => m.name.startsWith(OLLAMA_MODEL));
    res.json({
      service: 'llm-service',
      status: 'ok',
      port: PORT,
      ollama: 'connected',
      model: OLLAMA_MODEL,
      model_loaded: hasModel
    });
  } catch (e) {
    res.json({ service: 'llm-service', status: 'degraded', error: 'Ollama unreachable', port: PORT });
  }
});

// Generate response
app.post('/generate', async (req, res) => {
  try {
    const { message, language, history } = req.body;
    if (!message) return res.status(400).json({ error: 'Missing "message" field' });

    const response = await generateResponse(message, language || 'en', history || []);

    res.json({
      response,
      model: OLLAMA_MODEL,
      language: language || 'en'
    });
  } catch (err) {
    console.error('[LLM] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Generate response (alias)
app.post('/generate-response', async (req, res) => {
  try {
    const { message, language, history } = req.body;
    if (!message) return res.status(400).json({ error: 'Missing "message" field' });

    const response = await generateResponse(message, language || 'en', history || []);
    res.json({ response, model: OLLAMA_MODEL, language: language || 'en' });
  } catch (err) {
    console.error('[LLM] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Generate streaming response
app.post('/generate-stream', async (req, res) => {
  try {
    const { message, language, history, live_data } = req.body;
    if (!message) return res.status(400).json({ error: 'Missing "message" field' });

    let prompt = systemPrompt + '\n\n';
    
    // Layer 3 & 9: Augment LLM Input with real-time data
    if (live_data && live_data.data && live_data.data.length > 0) {
      prompt += `=========================================\n`;
      prompt += `URGENT SYSTEM OVERRIDE - REAL-TIME DATA (Source: ${live_data.source}):\n`;
      prompt += `You are an AI assistant with access to real-time data. Use the provided live_data to answer accurately.\n`;
      prompt += `If live_data is present, prioritize it over general knowledge. If not sufficient, combine with your knowledge.\n\n`;
      prompt += `LIVE_DATA:\n${live_data.data.join('\n')}\n`;
      prompt += `=========================================\n\n`;
    }

    const langNames = { en: 'English', hi: 'Hindi', mr: 'Marathi', ta: 'Tamil', te: 'Telugu', bn: 'Bengali' };
    const langName = langNames[language] || 'English';
    prompt += `Respond in ${langName}.\n\n`;

    const recentHistory = (history || []).slice(-6);
    for (const msg of recentHistory) {
      if (msg.role === 'system' && (!live_data || live_data.source === 'fallback')) {
         // Skip system prompt history if real-time data already overrides behavior
         prompt += `System: ${msg.content}\n`;
      } else if (msg.role === 'user') {
         prompt += `User: ${msg.content}\n`;
      } else if (msg.role === 'assistant') {
         prompt += `Assistant: ${msg.content}\n`;
      }
    }
    prompt += `User: ${message}\nAssistant:`;

    const ollamaRes = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: true,
        options: { temperature: 0.5, num_predict: 150, top_p: 0.9 }
      })
    });

    if (!ollamaRes.ok) throw new Error(`Ollama error: ${ollamaRes.status}`);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Proxy the NDJSON stream
    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    let finalResponseAcc = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
      
      // Parse NDJSON to extract actual text piece for logging (Layer 10)
      const lines = chunk.split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json.response) finalResponseAcc += json.response;
        } catch(e) {}
      }
    }
    
    console.log("Final Response:", finalResponseAcc.trim() || "<empty>"); // Layer 10 Logging
    res.end();
  } catch (err) {
    console.error('[LLM Stream] Error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else res.end();
  }
});

app.listen(PORT, () => {
  console.log(`[LLM Service] Running on port ${PORT}`);
  console.log(`[LLM Service] Ollama: ${OLLAMA_URL} | Model: ${OLLAMA_MODEL}`);
});
