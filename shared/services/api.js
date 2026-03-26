/**
 * Shared API Service — Single source of truth for all REST calls.
 * Used by BOTH web-client and mobile-app.
 *
 * Every function returns { success, data?, error? } for consistent error handling.
 * All URLs come from getApiUrl() — no custom IP overrides.
 */

const { getApiUrl } = require('../config/constants');

/**
 * Safe fetch wrapper with error handling.
 * Uses Promise.race for timeout (AbortSignal.timeout not supported in React Native).
 */
async function safeFetch(url, options = {}) {
  const timeout = options.timeout || 30000;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const res = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error');
      return { success: false, error: `HTTP ${res.status}: ${errText}` };
    }
    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return { success: false, error: 'Request timed out' };
    }
    return { success: false, error: err.message || 'Network error' };
  }
}

// ─── Health Check ───

async function getHealth() {
  const base = getApiUrl();
  return safeFetch(`${base}/api/health`, { method: 'GET', timeout: 5000 });
}

// ─── Pipeline (streaming SSE) ───

async function streamPipeline({ message, language, history, signal, onText, onAudio, onDone, onError }) {
  const base = getApiUrl();
  try {
    const res = await fetch(`${base}/api/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({ message, language, history }),
    });
    if (!res.ok) throw new Error('Gateway not responding');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let jsonBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      jsonBuffer += decoder.decode(value, { stream: true });
      const lines = jsonBuffer.split('\n');
      jsonBuffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'text') onText?.(data.chunk);
            else if (data.type === 'audio') onAudio?.(data.url);
            else if (data.type === 'done') onDone?.();
            else if (data.type === 'error') onError?.(data.error);
          } catch (e) { /* ignore parse errors on individual events */ }
        }
      }
    }
    return { success: true };
  } catch (err) {
    if (err.name === 'AbortError') return { success: false, error: 'Aborted' };
    onError?.(err.message);
    return { success: false, error: err.message };
  }
}

// ─── Non-streaming Pipeline ───

async function runPipeline({ message, language, history }) {
  const base = getApiUrl();
  return safeFetch(`${base}/api/pipeline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, language, history }),
  });
}

// ─── Speech-to-Text ───

async function sendAudioForSTT(audioBlobOrUri, filename) {
  const base = getApiUrl();
  try {
    const form = new FormData();

    // React Native: audioBlobOrUri is a file URI string
    // Web: audioBlobOrUri is a Blob
    if (typeof audioBlobOrUri === 'string') {
      // React Native FormData format
      form.append('audio', {
        uri: audioBlobOrUri,
        name: filename || 'recording.m4a',
        type: 'audio/m4a',
      });
    } else {
      // Web Blob format
      form.append('audio', audioBlobOrUri, filename || 'recording.webm');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const res = await fetch(`${base}/api/speech-to-text`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return { success: false, error: `STT failed (${res.status})` };
    }
    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message || 'STT network error' };
  }
}

// ─── Text-to-Speech ───

async function textToSpeech({ text, language, gender }) {
  const base = getApiUrl();
  return safeFetch(`${base}/api/text-to-speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language, gender }),
  });
}

// ─── Follow / Unfollow ───

async function followAvatar(userId, avatarId) {
  const base = getApiUrl();
  return safeFetch(`${base}/api/follow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, avatarId }),
  });
}

async function unfollowAvatar(userId, avatarId) {
  const base = getApiUrl();
  return safeFetch(`${base}/api/unfollow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, avatarId }),
  });
}

async function getFollows(userId) {
  const base = getApiUrl();
  return safeFetch(`${base}/api/follows/${userId}`, { method: 'GET' });
}

async function getFollowerCounts() {
  const base = getApiUrl();
  return safeFetch(`${base}/api/follower-counts`, { method: 'GET' });
}

// ─── Broadcasts ───

async function createBroadcast({ avatarId, title, message, language }) {
  const base = getApiUrl();
  return safeFetch(`${base}/api/broadcast/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatarId, title, message, language }),
  });
}

async function getBroadcasts() {
  const base = getApiUrl();
  return safeFetch(`${base}/api/broadcasts`, { method: 'GET' });
}

async function getBroadcastsByAvatar(avatarId) {
  const base = getApiUrl();
  return safeFetch(`${base}/api/broadcasts/${avatarId}`, { method: 'GET' });
}

// ─── Avatars (Single Source of Truth) ───

async function getAvatars() {
  const base = getApiUrl();
  return safeFetch(`${base}/api/avatars`, { method: 'GET' });
}

async function createCustomAvatar(data) {
  const base = getApiUrl();
  return safeFetch(`${base}/api/avatars/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

async function deleteCustomAvatar(id) {
  const base = getApiUrl();
  return safeFetch(`${base}/api/avatars/${id}`, { method: 'DELETE' });
}

module.exports = {
  safeFetch,
  getHealth,
  streamPipeline,
  runPipeline,
  sendAudioForSTT,
  textToSpeech,
  followAvatar,
  unfollowAvatar,
  getFollows,
  getFollowerCounts,
  createBroadcast,
  getBroadcasts,
  getBroadcastsByAvatar,
  getAvatars,
  createCustomAvatar,
  deleteCustomAvatar,
};
