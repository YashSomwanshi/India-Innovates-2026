/**
 * Shared WebSocket Service — Single source of truth for WS connection.
 * Used by BOTH web-client and mobile-app.
 *
 * Handles: registration, broadcast notifications, pipeline status,
 * broadcast watch, auto-reconnect.
 *
 * URL comes from getWsUrl() — no custom IP overrides.
 */

const { getWsUrl } = require('../config/constants');

/**
 * Create a managed WebSocket connection.
 *
 * @param {string} userId - User ID for registration
 * @param {object} handlers - Event handlers
 * @param {function} handlers.onStatus - Pipeline stage updates ({ stage, message })
 * @param {function} handlers.onResponse - LLM response ({ response, language, audio_url })
 * @param {function} handlers.onBroadcastNotification - New broadcast ({ broadcast })
 * @param {function} handlers.onBroadcastAudio - Broadcast watch result ({ broadcastId, text, audio_url })
 * @param {function} handlers.onRegistered - Registered confirmation ({ userId })
 * @param {function} handlers.onError - Error ({ error })
 * @param {function} handlers.onConnect - Connected
 * @param {function} handlers.onDisconnect - Disconnected
 * @returns {{ ws, send, sendBroadcastWatch, sendTextMessage, close }}
 */
function createWebSocket(userId, handlers = {}) {
  const url = getWsUrl();
  let ws = null;
  let reconnectTimer = null;
  let closed = false;

  function connect() {
    if (closed) return;

    try {
      ws = new WebSocket(url);
    } catch (err) {
      handlers.onError?.({ error: 'WebSocket creation failed: ' + err.message });
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      console.log('[WS Shared] Connected to', url);
      handlers.onConnect?.();
      // Register userId
      try {
        ws.send(JSON.stringify({ type: 'register', userId }));
      } catch (e) {}
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());

        switch (data.type) {
          case 'registered':
            handlers.onRegistered?.(data);
            break;
          case 'status':
            handlers.onStatus?.(data);
            break;
          case 'response':
            handlers.onResponse?.(data);
            break;
          case 'broadcast_notification':
            handlers.onBroadcastNotification?.(data);
            break;
          case 'broadcast_audio':
            handlers.onBroadcastAudio?.(data);
            break;
          case 'error':
            handlers.onError?.(data);
            break;
          case 'pong':
            break;
          default:
            break;
        }
      } catch (e) {
        // Ignore parse errors
      }
    };

    ws.onclose = () => {
      console.log('[WS Shared] Disconnected');
      handlers.onDisconnect?.();
      scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose will fire after this
    };
  }

  function scheduleReconnect() {
    if (closed || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, 3000);
  }

  // ─── Public API ───

  function send(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(typeof message === 'string' ? message : JSON.stringify(message));
        return true;
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  function sendTextMessage({ message, language, history, gender }) {
    return send({ type: 'text', message, language, history, gender });
  }

  function sendBroadcastWatch({ broadcastId, language, gender }) {
    return send({ type: 'broadcast_watch', broadcastId, language, gender });
  }

  function sendPing() {
    return send({ type: 'ping' });
  }

  function close() {
    closed = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      try { ws.close(); } catch (e) {}
      ws = null;
    }
  }

  function isConnected() {
    return ws && ws.readyState === WebSocket.OPEN;
  }

  // Start connection
  connect();

  return {
    send,
    sendTextMessage,
    sendBroadcastWatch,
    sendPing,
    close,
    isConnected,
    getWs: () => ws,
  };
}

module.exports = { createWebSocket };
