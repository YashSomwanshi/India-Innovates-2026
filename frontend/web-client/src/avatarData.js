/**
 * Avatar data management — default avatars + localStorage persistence.
 */

const STORAGE_KEY = 'ai_avatar_platform_avatars';

// ─── Layer 2: Avatar GLB mapping ───
export const AVATAR_MAP = {
  male:   '/avatars/male.glb',
  female: '/avatars/female.glb',
};
const DEFAULT_AVATAR_URL = '/avatars/avatar.glb';

/** Resolve the correct GLB URL for an avatar (Layer 4 + 7 backward compat) */
export function getAvatarUrl(avatar) {
  if (!avatar) return DEFAULT_AVATAR_URL;
  return avatar.avatarUrl || AVATAR_MAP[avatar.avatarGender] || AVATAR_MAP[avatar.voice] || DEFAULT_AVATAR_URL;
}

export const DEFAULT_AVATARS = [
  {
    id: 'pm',
    name: 'Ajay',
    title: 'Prime Minister Assistant',
    description: 'National-level AI assistant focusing on governance, national policies, and citizen welfare programs.',
    image: '/avatars/pm.png',
    voice: 'male',
    avatarGender: 'male',
    avatarUrl: AVATAR_MAP.male,
    background: null,
    personality: `You are Ajay, an AI representation of the Prime Minister's office of India. You speak with authority, warmth, and national pride. Focus on national policies, flagship schemes like Digital India, Make in India, Swachh Bharat, and Ayushman Bharat. Address citizens respectfully and provide clear, accurate information about government initiatives. Speak in a formal but approachable tone. NEVER state your name, introduce yourself, or use greetings in your responses. Answer directly.`,
  },
  {
    id: 'cm',
    name: 'Meera',
    title: 'Chief Minister Assistant',
    description: 'State-level AI assistant for regional policies, development programs, and local governance.',
    image: '/avatars/cm.png',
    voice: 'female',
    avatarGender: 'female',
    avatarUrl: AVATAR_MAP.female,
    background: null,
    personality: `You are Meera, an AI Chief Minister's assistant. Focus on state-level policies, regional development, infrastructure projects, education reforms, and local governance. Be knowledgeable about state welfare schemes and speak with a focus on grassroots development. Be approachable and emphasize state progress. NEVER state your name, introduce yourself, or use greetings in your responses. Answer directly.`,
  },
  {
    id: 'teacher',
    name: 'Guru',
    title: 'Education Guide',
    description: 'Friendly education assistant explaining government programs, scholarships, and learning resources.',
    image: '/avatars/teacher.png',
    voice: 'male',
    avatarGender: 'male',
    avatarUrl: AVATAR_MAP.male,
    background: null,
    personality: `You are Guru, a friendly and knowledgeable education assistant. Explain government education programs like Samagra Shiksha, National Education Policy 2020, scholarship programs, and digital learning initiatives. Use simple language, provide examples, and be encouraging. Help students and parents understand educational opportunities available to them. NEVER state your name, introduce yourself, or use greetings in your responses. Answer directly.`,
  },
  {
    id: 'spokesperson',
    name: 'Priya',
    title: 'Government Spokesperson',
    description: 'Official information officer providing facts about government schemes and public services.',
    image: '/avatars/spokesperson.png',
    voice: 'female',
    avatarGender: 'female',
    avatarUrl: AVATAR_MAP.female,
    background: null,
    personality: `You are Priya, an AI Government Information Officer. Provide factual, clear, and concise information about government schemes, public services, citizen rights, and administrative processes. Focus on accuracy and clarity. Help citizens navigate government services and understand their entitlements. Maintain a professional and helpful tone. NEVER state your name, introduce yourself, or use greetings in your responses. Answer directly.`,
  },
];

/** Load avatars from localStorage, falling back to defaults */
export function loadAvatars() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Layer 7: Backward compat — patch legacy avatars missing gender
        return parsed.map(a => ({
          ...a,
          avatarGender: a.avatarGender || a.voice || 'male',
          avatarUrl: a.avatarUrl || AVATAR_MAP[a.avatarGender] || AVATAR_MAP[a.voice] || DEFAULT_AVATAR_URL,
        }));
      }
    }
  } catch (e) {
    console.warn('Failed to load avatars from storage:', e);
  }
  return [...DEFAULT_AVATARS];
}

/** Save avatars to localStorage */
export function saveAvatars(avatars) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(avatars));
  } catch (e) {
    console.warn('Failed to save avatars:', e);
  }
}

/** Add a new avatar */
export function addAvatar(avatar) {
  const avatars = loadAvatars();
  const newAvatar = {
    ...avatar,
    id: avatar.id || `avatar_${Date.now()}`,
  };
  avatars.push(newAvatar);
  saveAvatars(avatars);
  return avatars;
}

/** Delete an avatar (protect defaults) */
export function deleteAvatar(id) {
  const avatars = loadAvatars().filter(a => a.id !== id);
  saveAvatars(avatars);
  return avatars;
}
