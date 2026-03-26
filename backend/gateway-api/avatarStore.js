/**
 * Avatar Store — JSON-file-backed data store for avatars
 * Single source of truth for all avatars (default + custom).
 * File: data/avatars.json
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'avatars.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ─── Default Avatars (seeded on first load) ───
const DEFAULT_AVATARS = [
  {
    id: 'pm',
    name: 'Ajay',
    title: 'Prime Minister Assistant',
    description: 'National-level AI assistant focusing on governance, national policies, and citizen welfare programs.',
    gender: 'male',
    avatarGender: 'male',
    voice: 'male',
    emoji: '👨',
    type: 'default',
    verified: true,
    image: '/avatars/pm.png',
    personality: 'You are Ajay, an AI representation of the Prime Minister\'s office of India. You speak with authority, warmth, and national pride. Focus on national policies, flagship schemes like Digital India, Make in India, Swachh Bharat, and Ayushman Bharat. Address citizens respectfully and provide clear, accurate information about government initiatives. Speak in a formal but approachable tone. NEVER state your name, introduce yourself, or use greetings in your responses. Answer directly.',
  },
  {
    id: 'cm',
    name: 'Meera',
    title: 'Chief Minister Assistant',
    description: 'State-level AI assistant for regional policies, development programs, and local governance.',
    gender: 'female',
    avatarGender: 'female',
    voice: 'female',
    emoji: '👩',
    type: 'default',
    verified: true,
    image: '/avatars/cm.png',
    personality: 'You are Meera, an AI Chief Minister\'s assistant. Focus on state-level policies, regional development, infrastructure projects, education reforms, and local governance. Be knowledgeable about state welfare schemes and speak with a focus on grassroots development. Be approachable and emphasize state progress. NEVER state your name, introduce yourself, or use greetings in your responses. Answer directly.',
  },
  {
    id: 'teacher',
    name: 'Guru',
    title: 'Education Guide',
    description: 'Friendly education assistant explaining government programs, scholarships, and learning resources.',
    gender: 'male',
    avatarGender: 'male',
    voice: 'male',
    emoji: '👨',
    type: 'default',
    verified: true,
    image: '/avatars/teacher.png',
    personality: 'You are Guru, a friendly and knowledgeable education assistant. Explain government education programs like Samagra Shiksha, National Education Policy 2020, scholarship programs, and digital learning initiatives. Use simple language, provide examples, and be encouraging. Help students and parents understand educational opportunities available to them. NEVER state your name, introduce yourself, or use greetings in your responses. Answer directly.',
  },
  {
    id: 'spokesperson',
    name: 'Priya',
    title: 'Government Spokesperson',
    description: 'Official information officer providing facts about government schemes and public services.',
    gender: 'female',
    avatarGender: 'female',
    voice: 'female',
    emoji: '👩',
    type: 'default',
    verified: true,
    image: '/avatars/spokesperson.png',
    personality: 'You are Priya, an AI Government Information Officer. Provide factual, clear, and concise information about government schemes, public services, citizen rights, and administrative processes. Focus on accuracy and clarity. Help citizens navigate government services and understand their entitlements. Maintain a professional and helpful tone. NEVER state your name, introduce yourself, or use greetings in your responses. Answer directly.',
  },
];

function loadStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
      return data;
    }
  } catch (e) {
    console.error('[AvatarStore] Failed to load store:', e.message);
  }
  // Seed defaults on first load
  const initial = { avatars: [...DEFAULT_AVATARS] };
  saveStore(initial);
  console.log('[AvatarStore] Seeded default avatars');
  return initial;
}

function saveStore(store) {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.error('[AvatarStore] Failed to save store:', e.message);
  }
}

// ─── CRUD Operations ───

function getAvatars() {
  const store = loadStore();
  return store.avatars || [];
}

function createAvatar(data) {
  const store = loadStore();
  const avatar = {
    id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: data.name,
    title: data.title || 'Custom Avatar',
    description: data.description || '',
    gender: data.gender || 'male',
    avatarGender: data.avatarGender || data.gender || 'male',
    voice: data.voice || data.gender || 'male',
    emoji: data.emoji || '🤖',
    personality: data.personality || `You are ${data.name}, a helpful AI assistant. ${data.description || ''}. Be professional and helpful. NEVER state your name, introduce yourself, or use greetings in your responses. Answer directly.`,
    image: data.image || null,
    type: 'custom',
    isCustom: true,
    verified: data.verified || false,
    createdAt: new Date().toISOString(),
  };
  store.avatars.push(avatar);
  saveStore(store);
  console.log(`[AvatarStore] Created avatar: "${avatar.name}" (${avatar.id})`);
  return avatar;
}

function deleteAvatar(id) {
  const store = loadStore();
  const avatar = store.avatars.find(a => a.id === id);
  if (!avatar) return { success: false, error: 'Avatar not found' };
  if (avatar.type === 'default') return { success: false, error: 'Cannot delete default avatars' };
  store.avatars = store.avatars.filter(a => a.id !== id);
  saveStore(store);
  console.log(`[AvatarStore] Deleted avatar: ${id}`);
  return { success: true };
}

module.exports = {
  getAvatars,
  createAvatar,
  deleteAvatar,
  DEFAULT_AVATARS,
};
