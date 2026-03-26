import { useState, useEffect } from 'react';

/**
 * BroadcastToast — Animated popup when a live broadcast arrives.
 * Props:
 *   broadcast: { avatarId, title, message, ... } or null
 *   avatarName: string
 *   onWatch() — user clicks Watch
 *   onDismiss() — user dismisses
 */
export default function BroadcastToast({ broadcast, avatarName, onWatch, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (broadcast) {
      setVisible(true);
      const timer = setTimeout(() => { setVisible(false); onDismiss?.(); }, 10000);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [broadcast]);

  if (!visible || !broadcast) return null;

  return (
    <div className="broadcast-toast">
      <div className="broadcast-toast-icon">📺</div>
      <div className="broadcast-toast-body">
        <div className="broadcast-toast-title">
          <strong>{avatarName || broadcast.avatarId}</strong> is broadcasting
        </div>
        <div className="broadcast-toast-msg">{broadcast.title}</div>
      </div>
      <div className="broadcast-toast-actions">
        <button className="broadcast-toast-watch" onClick={() => { setVisible(false); onWatch?.(); }}>
          ▶ Watch
        </button>
        <button className="broadcast-toast-dismiss" onClick={() => { setVisible(false); onDismiss?.(); }}>
          ✕
        </button>
      </div>
    </div>
  );
}
