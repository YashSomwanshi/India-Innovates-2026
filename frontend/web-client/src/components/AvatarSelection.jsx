import { useState } from 'react';
import { loadAvatars, addAvatar, deleteAvatar, DEFAULT_AVATARS } from '../avatarData';
import AvatarCreator from './AvatarCreator';

/**
 * AvatarSelection — Grid page for choosing an AI assistant.
 * Props:
 *   onSelect(avatar) — called when user picks an avatar
 */
export default function AvatarSelection({ onSelect }) {
  const [avatars, setAvatars] = useState(() => loadAvatars());
  const [showCreator, setShowCreator] = useState(false);

  function handleCreate(newAvatar) {
    const updated = addAvatar(newAvatar);
    setAvatars(updated);
    setShowCreator(false);
  }

  function handleDelete(id) {
    if (DEFAULT_AVATARS.some(a => a.id === id)) return; // protect defaults
    const updated = deleteAvatar(id);
    setAvatars(updated);
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

      {/* Grid */}
      <div className="select-grid">
        {avatars.map(avatar => (
          <div key={avatar.id} className="avatar-card" onClick={() => onSelect(avatar)}>
            <div className="card-img-wrap">
              {avatar.image ? (
                <img src={avatar.image} alt={avatar.name} className="card-img" />
              ) : (
                <div className="card-img-placeholder">{avatar.name.charAt(0)}</div>
              )}
            </div>
            <div className="card-body">
              <h3 className="card-name">{avatar.name}</h3>
              <p className="card-title">{avatar.title}</p>
              <p className="card-desc">{avatar.description}</p>
            </div>
            <div className="card-footer">
              <span className="card-badge">{avatar.voice === 'female' ? '👩' : '👨'} {avatar.voice}</span>
              <button className="card-select-btn">Start Chat →</button>
            </div>
            {/* Delete button for custom avatars */}
            {!DEFAULT_AVATARS.some(d => d.id === avatar.id) && (
              <button
                className="card-delete"
                onClick={(e) => { e.stopPropagation(); handleDelete(avatar.id); }}
                title="Delete this avatar"
              >✕</button>
            )}
          </div>
        ))}

        {/* Add New Card */}
        <div className="avatar-card add-card" onClick={() => setShowCreator(true)}>
          <div className="add-icon">+</div>
          <h3 className="card-name">Create New</h3>
          <p className="card-title">Add a custom AI assistant</p>
        </div>
      </div>

      {/* Creator Modal */}
      {showCreator && (
        <AvatarCreator
          onSave={handleCreate}
          onClose={() => setShowCreator(false)}
        />
      )}
    </div>
  );
}
