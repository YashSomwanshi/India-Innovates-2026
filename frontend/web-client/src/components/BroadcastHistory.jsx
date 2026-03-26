import { useState, useEffect } from 'react';

const GATEWAY_URL = '';

/**
 * BroadcastHistory — Section showing recent broadcasts with rewatch option.
 * Props:
 *   onWatch(broadcast) — when user clicks Rewatch
 *   avatarMap — { avatarId: { name, ... } }
 */
export default function BroadcastHistory({ onWatch, avatarMap = {} }) {
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  async function fetchBroadcasts() {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/broadcasts`);
      const data = await res.json();
      setBroadcasts(data.broadcasts || []);
    } catch (e) {
      console.warn('Failed to fetch broadcasts:', e);
    } finally {
      setLoading(false);
    }
  }

  function formatTime(ts) {
    try {
      const d = new Date(ts);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  }

  if (loading) return null;
  if (broadcasts.length === 0) return null;

  return (
    <div className="broadcast-history">
      <h2 className="broadcast-history-title">📺 Recent Broadcasts</h2>
      <div className="broadcast-history-list">
        {broadcasts.slice(0, 10).map(bc => {
          const avatar = avatarMap[bc.avatarId];
          const avatarName = avatar?.name || bc.avatarId;
          return (
            <div key={bc.id} className="broadcast-history-item">
              <div className="broadcast-history-avatar">📢</div>
              <div className="broadcast-history-body">
                <div className="broadcast-history-item-title">
                  <strong>{avatarName}</strong> — {bc.title}
                </div>
                <div className="broadcast-history-item-msg">
                  {bc.message.slice(0, 100)}{bc.message.length > 100 ? '…' : ''}
                </div>
                <div className="broadcast-history-item-time">{formatTime(bc.timestamp)}</div>
              </div>
              <button className="broadcast-history-watch-btn" onClick={() => onWatch?.(bc)}>
                ▶ Rewatch
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
