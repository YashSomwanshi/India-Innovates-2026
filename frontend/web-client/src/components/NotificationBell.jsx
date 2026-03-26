import { useState, useRef, useEffect } from 'react';

/**
 * NotificationBell — 🔔 icon with dropdown notification panel.
 * Props:
 *   notifications: [{ broadcast: { id, avatarId, title, message, timestamp }, read: bool }]
 *   onWatch(broadcast) — when user clicks "Watch"
 *   onClear() — clear all notifications
 *   avatarMap — { avatarId: { name, ... } }
 */
export default function NotificationBell({ notifications = [], onWatch, onClear, avatarMap = {} }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function formatTime(ts) {
    try {
      const d = new Date(ts);
      const now = new Date();
      const diff = now - d;
      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      return d.toLocaleDateString();
    } catch { return ''; }
  }

  return (
    <div className="notif-bell-wrap" ref={panelRef}>
      <button className="notif-bell-btn" onClick={() => setOpen(p => !p)} title="Notifications">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-panel-header">
            <span className="notif-panel-title">🔔 Notifications</span>
            {notifications.length > 0 && (
              <button className="notif-clear-btn" onClick={() => { onClear?.(); }}>Clear all</button>
            )}
          </div>
          <div className="notif-panel-list">
            {notifications.length === 0 ? (
              <div className="notif-empty">No notifications yet</div>
            ) : (
              notifications.map((n, i) => {
                const bc = n.broadcast;
                const avatar = avatarMap[bc.avatarId];
                const avatarName = avatar?.name || bc.avatarId;
                return (
                  <div key={bc.id || i} className={`notif-item ${n.read ? '' : 'unread'}`}>
                    <div className="notif-item-icon">📢</div>
                    <div className="notif-item-body">
                      <div className="notif-item-title">
                        <strong>{avatarName}</strong>: {bc.title}
                      </div>
                      <div className="notif-item-msg">{bc.message.slice(0, 80)}{bc.message.length > 80 ? '…' : ''}</div>
                      <div className="notif-item-time">{formatTime(bc.timestamp)}</div>
                    </div>
                    <button className="notif-watch-btn" onClick={() => { onWatch?.(bc); setOpen(false); }}>
                      ▶ Watch
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
