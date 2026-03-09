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
        temperature: 0.7,
        num_predict: 300,
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

app.listen(PORT, () => {
  console.log(`[LLM Service] Running on port ${PORT}`);
  console.log(`[LLM Service] Ollama: ${OLLAMA_URL} | Model: ${OLLAMA_MODEL}`);
});
