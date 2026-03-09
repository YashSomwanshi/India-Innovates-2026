/**
 * Avatar Service — 2D Avatar metadata provider
 * Port: 5005
 * Provides avatar configuration and audio URL mapping.
 * The actual avatar animation is rendered client-side using Canvas/SVG.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = parseInt(process.env.AVATAR_PORT || '5005');

// Avatar profiles
const AVATARS = {
  disha: {
    name: 'Disha',
    description: 'AI Civic Assistant for Government of India',
    appearance: {
      skinTone: '#D4A574',
      hairColor: '#2C1810',
      eyeColor: '#3D2914',
      outfit: 'formal_saree',
      outfitColor: '#1a5276',
      accentColor: '#f39c12'
    },
    expressions: ['neutral', 'happy', 'thinking', 'speaking'],
    defaultExpression: 'neutral'
  }
};

// Health check
app.get('/health', (req, res) => {
  res.json({
    service: 'avatar-service',
    status: 'ok',
    port: PORT,
    mode: 'client-side-rendering',
    avatars: Object.keys(AVATARS)
  });
});

// Get avatar profile
app.get('/avatar/:id', (req, res) => {
  const avatar = AVATARS[req.params.id];
  if (!avatar) return res.status(404).json({ error: 'Avatar not found' });
  res.json(avatar);
});

// Generate avatar video metadata
app.post('/generate-avatar-video', (req, res) => {
  const { audio_url, text, language, avatar_id } = req.body;

  if (!audio_url) {
    return res.status(400).json({ error: 'Missing audio_url' });
  }

  const avatar = AVATARS[avatar_id || 'disha'];

  // Return metadata for client-side rendering
  res.json({
    avatar: avatar || AVATARS.disha,
    audio_url,
    text: text || '',
    language: language || 'en',
    render_mode: 'client-side',
    animation: {
      type: 'lip-sync',
      fps: 30,
      blend_shapes: ['mouthOpen', 'mouthSmile', 'eyeBlink'],
    }
  });
});

// List available avatars
app.get('/avatars', (req, res) => {
  res.json({ avatars: AVATARS });
});

app.listen(PORT, () => {
  console.log(`[Avatar Service] Running on port ${PORT}`);
  console.log(`[Avatar Service] Mode: Client-side rendering`);
  console.log(`[Avatar Service] Avatars: ${Object.keys(AVATARS).join(', ')}`);
});
