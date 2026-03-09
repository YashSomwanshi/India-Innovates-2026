/**
 * Translation Service — LLM-based multilingual translation
 * Port: 5002
 * Uses Ollama/Llama3 for translation between 6 Indian languages.
 */

const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';
const PORT = parseInt(process.env.TRANSLATE_PORT || '5002');

const LANGUAGES = {
  en: 'English',
  hi: 'Hindi',
  mr: 'Marathi',
  ta: 'Tamil',
  te: 'Telugu',
  bn: 'Bengali'
};

async function callOllama(prompt) {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.3, num_predict: 500 }
    })
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = await res.json();
  return data.response?.trim() || '';
}

// Health check
app.get('/health', (req, res) => {
  res.json({ service: 'translation-service', status: 'ok', port: PORT, languages: Object.keys(LANGUAGES) });
});

// Translate text
app.post('/translate', async (req, res) => {
  try {
    const { text, source_lang, target_lang } = req.body;

    if (!text) return res.status(400).json({ error: 'Missing "text" field' });
    if (!target_lang) return res.status(400).json({ error: 'Missing "target_lang" field' });

    const sourceName = LANGUAGES[source_lang] || source_lang || 'auto-detect';
    const targetName = LANGUAGES[target_lang] || target_lang;

    // If source and target are the same, return as-is
    if (source_lang === target_lang) {
      return res.json({ translated_text: text, source_lang, target_lang });
    }

    const prompt = `Translate the following text from ${sourceName} to ${targetName}. Return ONLY the translated text, nothing else.\n\nText: "${text}"`;

    const translated = await callOllama(prompt);

    // Clean up: remove quotes if model wrapped the response
    const cleaned = translated.replace(/^["']|["']$/g, '').trim();

    res.json({
      translated_text: cleaned,
      source_lang: source_lang || 'auto',
      target_lang
    });
  } catch (err) {
    console.error('[Translate] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Detect language
app.post('/detect-language', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Missing "text" field' });

    const prompt = `Detect the language of the following text. Reply with ONLY the ISO 639-1 language code (e.g., en, hi, mr, ta, te, bn). Text: "${text}"`;

    const detected = await callOllama(prompt);
    const langCode = detected.toLowerCase().trim().substring(0, 2);

    res.json({
      language: langCode,
      language_name: LANGUAGES[langCode] || langCode,
      confidence: 0.85
    });
  } catch (err) {
    console.error('[Detect] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[Translation Service] Running on port ${PORT}`);
  console.log(`[Translation Service] Ollama: ${OLLAMA_URL} (model: ${OLLAMA_MODEL})`);
});
