import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import AvatarView from './AvatarView.jsx';
import './index.css';

// Simple path-based routing: /avatar-view → mobile WebView renderer
const isAvatarView = window.location.pathname === '/avatar-view';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAvatarView ? <AvatarView /> : <App />}
  </React.StrictMode>
);
