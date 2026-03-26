import { useState } from 'react';

/**
 * BroadcastModal — Admin modal to create a broadcast for an avatar.
 * Props:
 *   avatar — { id, name }
 *   onClose() — close the modal
 *   onCreated(broadcast) — callback after broadcast created
 */
export default function BroadcastModal({ avatar, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [language, setLanguage] = useState('en');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setError('Title and message are required');
      return;
    }
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/broadcast/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatarId: avatar.id,
          title: title.trim(),
          message: message.trim(),
          language,
        }),
      });
      const data = await res.json();
      if (data.broadcast) {
        onCreated?.(data.broadcast);
        onClose();
      } else {
        setError(data.error || 'Failed to create broadcast');
      }
    } catch (e) {
      setError('Network error: ' + e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="broadcast-modal" onClick={e => e.stopPropagation()}>
        <div className="broadcast-modal-header">
          <h3>📢 Create Broadcast as {avatar.name}</h3>
          <button className="broadcast-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="broadcast-modal-field">
            <label>Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. West Asia Crisis Address"
              maxLength={100}
            />
          </div>
          <div className="broadcast-modal-field">
            <label>Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="The full broadcast message the avatar will speak..."
              rows={5}
              maxLength={2000}
            />
          </div>
          <div className="broadcast-modal-field">
            <label>Language</label>
            <select value={language} onChange={e => setLanguage(e.target.value)}>
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="mr">Marathi</option>
              <option value="ta">Tamil</option>
              <option value="te">Telugu</option>
              <option value="bn">Bengali</option>
            </select>
          </div>
          {error && <div className="broadcast-modal-error">{error}</div>}
          <button className="broadcast-modal-submit" type="submit" disabled={sending}>
            {sending ? 'Broadcasting...' : '📡 Publish Broadcast'}
          </button>
        </form>
      </div>
    </div>
  );
}
