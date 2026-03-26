/**
 * Shared Configuration — Single source of truth for URLs and constants.
 * Used by BOTH web-client and mobile-app.
 *
 * ⚠ ALL URLs come from here. No customIp overrides anywhere.
 */

// ─── Platform Detection (React Native–safe) ───
let _platformOS = 'web';
try {
  const RN = require('react-native');
  _platformOS = RN?.Platform?.OS || 'web';
} catch (_) {
  _platformOS = 'web';
}

const isMobile = _platformOS !== 'web';
const isWeb = _platformOS === 'web';

console.log(`[CONFIG] Platform detected: ${_platformOS} (isMobile=${isMobile}, isWeb=${isWeb})`);

// ─── LAN IP — Single Source of Truth ───
// Change this to your machine's local IP for mobile testing.
// Find it with: ipconfig (Windows) or ifconfig (Mac/Linux)
const LAN_IP = '192.168.1.9';

/**
 * Get the base API URL.
 * Web:    relative URLs (same origin)
 * Mobile: http://<LAN_IP>:4000
 */
function getApiUrl() {
  if (isWeb) return '';
  const url = `http://${LAN_IP}:4000`;
  console.log('[CONFIG] API URL:', url);
  return url;
}

/**
 * Get the WebSocket URL.
 * Web:    derives from window.location
 * Mobile: ws://<LAN_IP>:4000/ws
 */
function getWsUrl() {
  if (isWeb) {
    const loc = typeof window !== 'undefined' ? window?.location : null;
    if (loc?.protocol && loc?.host) {
      const protocol = loc.protocol === 'https:' ? 'wss' : 'ws';
      return `${protocol}://${loc.host}/ws`;
    }
    return `ws://${LAN_IP}:4000/ws`;
  }
  const url = `ws://${LAN_IP}:4000/ws`;
  console.log('[CONFIG] WS URL:', url);
  return url;
}

/**
 * Get the web client URL (for mobile WebView avatar rendering).
 * Always: http://<LAN_IP>:5173
 */
function getWebClientUrl() {
  const url = `http://${LAN_IP}:5173`;
  console.log('[CONFIG] Web Client URL:', url);
  return url;
}

// ─── Avatar Personas ───
const AVATAR_IDS = {
  PM: 'pm',
  CM: 'cm',
  TEACHER: 'teacher',
  SPOKESPERSON: 'spokesperson',
};

// ─── Language Map ───
const SPEECH_LANG_MAP = {
  en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN', ta: 'ta-IN', te: 'te-IN', bn: 'bn-IN',
};

const LANG_NAMES = {
  en: 'English', hi: 'Hindi', mr: 'Marathi', ta: 'Tamil', te: 'Telugu', bn: 'Bengali',
};

// ─── Pipeline Stages ───
const PIPELINE_STAGES = {
  LISTENING: 'listening',
  PROCESSING: 'processing',
  TRANSLATING_INPUT: 'translating_input',
  THINKING: 'thinking',
  TRANSLATING_OUTPUT: 'translating_output',
  SYNTHESIZING: 'synthesizing_voice',
  SPEAKING: 'speaking',
  PREPARING_BROADCAST: 'preparing_broadcast',
};

const STAGE_LABELS = {
  listening: 'Listening…',
  processing: 'Processing…',
  translating_input: 'Translating…',
  thinking: 'Thinking…',
  translating_output: 'Translating…',
  synthesizing_voice: 'Generating voice…',
  speaking: 'Speaking…',
  preparing_broadcast: 'Preparing broadcast…',
  translating: 'Translating…',
};

module.exports = {
  isMobile,
  isWeb,
  LAN_IP,
  getApiUrl,
  getWsUrl,
  getWebClientUrl,
  AVATAR_IDS,
  SPEECH_LANG_MAP,
  LANG_NAMES,
  PIPELINE_STAGES,
  STAGE_LABELS,
};
