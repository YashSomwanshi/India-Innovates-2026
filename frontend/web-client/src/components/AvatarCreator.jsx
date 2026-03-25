import { useState, useRef } from 'react';
import { AVATAR_MAP } from '../avatarData';

/**
 * AvatarCreator — Modal for creating a new avatar.
 * Props:
 *   onSave(avatar) — called with the new avatar data
 *   onClose()      — close the modal
 */
export default function AvatarCreator({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [avatarGender, setAvatarGender] = useState('male');
  const [voice, setVoice] = useState('male');
  const [personality, setPersonality] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const fileRef = useRef(null);

  function handleGenderChange(gender) {
    setAvatarGender(gender);
    setVoice(gender); // Auto-sync voice with gender
  }

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  }

  function handleSave() {
    if (!name.trim() || !title.trim()) return;
    onSave({
      name: name.trim(),
      title: title.trim(),
      description: description.trim() || `Custom AI assistant: ${name}`,
      voice,
      avatarGender,
      avatarUrl: AVATAR_MAP[avatarGender],
      personality: personality.trim() || `You are ${name}, a helpful AI assistant. ${title}. Be professional and helpful.`,
      image: imagePreview,
      background: null,
    });
  }

  return (
    <div className="creator-overlay" onClick={onClose}>
      <div className="creator-modal" onClick={e => e.stopPropagation()}>
        <div className="creator-header">
          <h2>Create New Avatar</h2>
          <button className="creator-close" onClick={onClose}>✕</button>
        </div>

        <div className="creator-body">
          {/* Image Upload */}
          <div className="creator-img-section" onClick={() => fileRef.current?.click()}>
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="creator-img-preview" />
            ) : (
              <div className="creator-img-placeholder">
                <span>📷</span>
                <span>Upload Image</span>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
          </div>

          {/* Fields */}
          <div className="creator-fields">
            <div className="field">
              <label>Name *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Vikram" />
            </div>
            <div className="field">
              <label>Title *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Health Minister Assistant" />
            </div>
            <div className="field">
              <label>Description</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description..." />
            </div>
            <div className="field">
              <label>Avatar Gender *</label>
              <div className="gender-toggle">
                <button
                  type="button"
                  className={`gender-btn ${avatarGender === 'male' ? 'active' : ''}`}
                  onClick={() => handleGenderChange('male')}
                >👨 Male</button>
                <button
                  type="button"
                  className={`gender-btn ${avatarGender === 'female' ? 'active' : ''}`}
                  onClick={() => handleGenderChange('female')}
                >👩 Female</button>
              </div>
            </div>
            <div className="field">
              <label>Voice</label>
              <select value={voice} onChange={e => setVoice(e.target.value)}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div className="field">
              <label>Personality Prompt</label>
              <textarea value={personality} onChange={e => setPersonality(e.target.value)} placeholder="Describe how this avatar should behave..." rows={3} />
            </div>
          </div>
        </div>

        <div className="creator-footer">
          <button className="creator-cancel" onClick={onClose}>Cancel</button>
          <button className="creator-save" onClick={handleSave} disabled={!name.trim() || !title.trim()}>Create Avatar</button>
        </div>
      </div>
    </div>
  );
}
