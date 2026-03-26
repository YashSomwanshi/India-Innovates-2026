import { useState, useEffect } from 'react';
import { getAvatars, createCustomAvatar, deleteCustomAvatar } from '../services/avatarApi';
import { AVATAR_MAP } from '../avatarData';
import AvatarCreator from './AvatarCreator';
import BroadcastModal from './BroadcastModal';
import BroadcastHistory from './BroadcastHistory';

/**
 * AvatarSelection — Grid page for choosing an AI assistant.
 * Fetches avatars from backend API (single source of truth).
 */
export default function AvatarSelection({ onSelect, userId, followedAvatars = [], onFollow, onUnfollow, followerCounts = {}, onWatchBroadcast }) {
  const [avatars, setAvatars] = useState([]);
  const [showCreator, setShowCreator] = useState(false);
  const [broadcastAvatar, setBroadcastAvatar] = useState(null);
  const [loading, setLoading] = useState(true);

  // Build avatar map for BroadcastHistory
  const avatarMap = {};
  avatars.forEach(a => { avatarMap[a.id] = a; });

  // Fetch avatars from backend on mount
  useEffect(() => {
    fetchAvatars();

    // Listen for real-time sync via WebSocket
    function onAvatarUpdated() { fetchAvatars(); }
    window.addEventListener('avatar-updated', onAvatarUpdated);
    return () => window.removeEventListener('avatar-updated', onAvatarUpdated);
  }, []);

  async function fetchAvatars() {
    const res = await getAvatars();
    if (res.success && res.data?.avatars) {
      // Ensure avatarUrl is set for each avatar
      const enriched = res.data.avatars.map(a => ({
        ...a,
        avatarGender: a.avatarGender || a.gender || a.voice || 'male',
        avatarUrl: a.avatarUrl || AVATAR_MAP[a.avatarGender || a.gender || a.voice] || AVATAR_MAP.male,
      }));
      setAvatars(enriched);
    }
    setLoading(false);
  }

  async function handleCreate(newAvatar) {
    const res = await createCustomAvatar(newAvatar);
    if (res.success) {
      await fetchAvatars(); // Auto-refresh
      setShowCreator(false);
    }
  }

  async function handleDelete(id) {
    // Protect defaults (double-check on client side)
    const avatar = avatars.find(a => a.id === id);
    if (!avatar || avatar.type === 'default') return;
    const res = await deleteCustomAvatar(id);
    if (res.success) {
      await fetchAvatars(); // Auto-refresh
    }
  }

  // Separate followed and unfollowed avatars
  const followedList = avatars.filter(a => followedAvatars.includes(a.id));
  const defaultAvatarIds = ['pm', 'cm', 'teacher', 'spokesperson'];

  if (loading) {
    return (
      <div className="select-page" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>⏳</div>
          <p style={{ color: 'var(--text-2)' }}>Loading avatars...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="select-page">
      {/* Header */}
      <header className="select-header">
        <div className="select-brand">
          <div className="select-logo">🇮🇳</div>
          <div>
            <div className="select-brand-name">AI Avatar Platform</div>
            <div className="select-brand-sub">India Innovates 2026</div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="select-hero">
        <h1>Choose an AI Assistant</h1>
        <p>Select a persona to start your conversation</p>
      </div>

      {/* Your Followed Avatars section (only if user follows any) */}
      {followedList.length > 0 && (
        <div className="followed-section">
          <h2 className="followed-section-title">⭐ Your Followed Avatars</h2>
          <div className="followed-chips">
            {followedList.map(avatar => (
              <div key={avatar.id} className="followed-chip" onClick={() => onSelect(avatar)}>
                <span className="followed-chip-icon">{avatar.avatarGender === 'female' ? '👩' : '👨'}</span>
                <span className="followed-chip-name">{avatar.name}</span>
                <span className="followed-chip-badge">Following</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="select-grid">
        {avatars.map(avatar => {
          const isFollowed = followedAvatars.includes(avatar.id);
          const fCount = followerCounts[avatar.id] || 0;
          return (
            <div key={avatar.id} className="avatar-card" onClick={() => onSelect(avatar)}>
              <div className="card-img-wrap">
                {avatar.image ? (
                  <img src={avatar.image} alt={avatar.name} className="card-img" />
                ) : (
                  <div className="card-img-placeholder">{avatar.name.charAt(0)}</div>
                )}
                {/* Follower count badge */}
                {fCount > 0 && (
                  <div className="card-follower-badge">👥 {fCount}</div>
                )}
              </div>
              <div className="card-body">
                <h3 className="card-name">
                  {avatar.name}
                  {avatar.verified && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '6px', fontSize: '10px', fontWeight: 700, color: '#1D9BF0', background: 'rgba(29,155,240,0.08)', padding: '1px 7px', borderRadius: '6px', verticalAlign: 'middle' }}>✔ Verified</span>}
                </h3>
                <p className="card-title">{avatar.title}</p>
                <p className="card-desc">{avatar.description}</p>
              </div>
              <div className="card-footer">
                <span className="card-badge">
                  {avatar.type === 'custom' && <span style={{ color: '#6B7280', marginRight: '4px', fontSize: '10px', fontWeight: 600 }}>CUSTOM</span>}
                  {avatar.avatarGender === 'female' || avatar.voice === 'female' ? '👩' : '👨'} {avatar.avatarGender || avatar.voice}
                </span>
                <button className="card-select-btn">Start Chat →</button>
              </div>

              {/* Follow / Following button */}
              <button
                className={`card-follow-btn ${isFollowed ? 'following' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isFollowed) onUnfollow?.(avatar.id);
                  else onFollow?.(avatar.id);
                }}
                title={isFollowed ? 'Unfollow' : 'Follow'}
              >
                {isFollowed ? '✓ Following' : '+ Follow'}
              </button>

              {/* Broadcast button (admin demo) */}
              <button
                className="card-broadcast-btn"
                onClick={(e) => { e.stopPropagation(); setBroadcastAvatar(avatar); }}
                title="Create Broadcast"
              >
                📢
              </button>

              {/* Delete button for custom avatars */}
              {avatar.type === 'custom' && (
                <button
                  className="card-delete"
                  onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete "${avatar.name}"?`)) handleDelete(avatar.id); }}
                  title="Delete this avatar"
                >✕</button>
              )}
            </div>
          );
        })}

        {/* Add New Card */}
        <div className="avatar-card add-card" onClick={() => setShowCreator(true)}>
          <div className="add-icon">+</div>
          <h3 className="card-name">Create New</h3>
          <p className="card-title">Add a custom AI assistant</p>
        </div>
      </div>

      {/* Broadcast History Section */}
      <BroadcastHistory onWatch={onWatchBroadcast} avatarMap={avatarMap} />

      {/* Creator Modal */}
      {showCreator && (
        <AvatarCreator
          onSave={handleCreate}
          onClose={() => setShowCreator(false)}
        />
      )}

      {/* Broadcast Modal */}
      {broadcastAvatar && (
        <BroadcastModal
          avatar={broadcastAvatar}
          onClose={() => setBroadcastAvatar(null)}
          onCreated={(bc) => { /* toast will come via WebSocket */ }}
        />
      )}
    </div>
  );
}
