/**
 * Broadcast Store — JSON-file-backed data store
 * Manages: users (follows), broadcasts
 * File: data/store.json
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      return JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('[BroadcastStore] Failed to load store:', e.message);
  }
  return { users: {}, broadcasts: [], followerCounts: {} };
}

function saveStore(store) {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.error('[BroadcastStore] Failed to save store:', e.message);
  }
}

// ─── Follow / Unfollow ───

function followAvatar(userId, avatarId) {
  const store = loadStore();
  if (!store.users[userId]) {
    store.users[userId] = { followedAvatars: [] };
  }
  const follows = store.users[userId].followedAvatars;
  if (!follows.includes(avatarId)) {
    follows.push(avatarId);
    store.followerCounts[avatarId] = (store.followerCounts[avatarId] || 0) + 1;
    saveStore(store);
  }
  return { success: true, followedAvatars: follows };
}

function unfollowAvatar(userId, avatarId) {
  const store = loadStore();
  if (!store.users[userId]) return { success: true, followedAvatars: [] };
  const follows = store.users[userId].followedAvatars;
  const idx = follows.indexOf(avatarId);
  if (idx !== -1) {
    follows.splice(idx, 1);
    store.followerCounts[avatarId] = Math.max(0, (store.followerCounts[avatarId] || 1) - 1);
    saveStore(store);
  }
  return { success: true, followedAvatars: follows };
}

function getUserFollows(userId) {
  const store = loadStore();
  return store.users[userId]?.followedAvatars || [];
}

function getFollowers(avatarId) {
  const store = loadStore();
  const followers = [];
  for (const [userId, data] of Object.entries(store.users)) {
    if (data.followedAvatars.includes(avatarId)) {
      followers.push(userId);
    }
  }
  return followers;
}

function getFollowerCounts() {
  const store = loadStore();
  return store.followerCounts || {};
}

// ─── Broadcasts ───

function createBroadcast({ avatarId, title, message, language }) {
  const store = loadStore();
  const broadcast = {
    id: `bc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    avatarId,
    title,
    message,
    language: language || 'en',
    timestamp: new Date().toISOString(),
  };
  store.broadcasts.unshift(broadcast); // newest first
  // Keep max 100 broadcasts
  if (store.broadcasts.length > 100) store.broadcasts = store.broadcasts.slice(0, 100);
  saveStore(store);
  return broadcast;
}

function getBroadcasts(limit = 50) {
  const store = loadStore();
  return store.broadcasts.slice(0, limit);
}

function getBroadcastsByAvatar(avatarId, limit = 20) {
  const store = loadStore();
  return store.broadcasts.filter(b => b.avatarId === avatarId).slice(0, limit);
}

function getBroadcastById(broadcastId) {
  const store = loadStore();
  return store.broadcasts.find(b => b.id === broadcastId) || null;
}

module.exports = {
  followAvatar,
  unfollowAvatar,
  getUserFollows,
  getFollowers,
  getFollowerCounts,
  createBroadcast,
  getBroadcasts,
  getBroadcastsByAvatar,
  getBroadcastById,
};
