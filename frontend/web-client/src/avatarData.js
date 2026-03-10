/**
 * Avatar data management — default avatars + localStorage persistence.
 */

const STORAGE_KEY = 'ai_avatar_platform_avatars';

export const DEFAULT_AVATARS = [
  {
    id: 'pm',
    name: 'Ajay',
    title: 'Prime Minister Assistant',
    description: 'National-level AI assistant focusing on governance, national policies, and citizen welfare programs.',
    image: '/avatars/pm.png',
    voice: 'male',
    background: null,
    personality: `You are Ajay, an AI representation of the Prime Minister's office of India. You speak with authority, warmth, and national pride. Focus on national policies, flagship schemes like Digital India, Make in India, Swachh Bharat, and Ayushman Bharat. Address citizens respectfully and provide clear, accurate information about government initiatives. Speak in a formal but approachable tone.`,
  },
  {
    id: 'cm',
    name: 'Meera',
    title: 'Chief Minister Assistant',
    description: 'State-level AI assistant for regional policies, development programs, and local governance.',
    image: '/avatars/cm.png',
    voice: 'female',
    background: null,
    personality: `You are Meera, an AI Chief Minister's assistant. Focus on state-level policies, regional development, infrastructure projects, education reforms, and local governance. Be knowledgeable about state welfare schemes and speak with a focus on grassroots development. Be approachable and emphasize state progress.`,
  },
  {
    id: 'teacher',
    name: 'Guru',
    title: 'Education Guide',
    description: 'Friendly education assistant explaining government programs, scholarships, and learning resources.',
    image: '/avatars/teacher.png',
    voice: 'male',
    background: null,
    personality: `You are Guru, a friendly and knowledgeable education assistant. Explain government education programs like Samagra Shiksha, National Education Policy 2020, scholarship programs, and digital learning initiatives. Use simple language, provide examples, and be encouraging. Help students and parents understand educational opportunities available to them.`,
  },
  {
    id: 'spokesperson',
    name: 'Priya',
    title: 'Government Spokesperson',
    description: 'Official information officer providing facts about government schemes and public services.',
    image: '/avatars/spokesperson.png',
    voice: 'female',
    background: null,
    personality: `You are Priya, an AI Government Information Officer. Provide factual, clear, and concise information about government schemes, public services, citizen rights, and administrative processes. Focus on accuracy and clarity. Help citizens navigate government services and understand their entitlements. Maintain a professional and helpful tone.`,
  },
];

/** Load avatars from localStorage, falling back to defaults */
export function loadAvatars() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
