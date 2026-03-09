import { useState, useRef, useEffect } from 'react';

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧', native: 'English' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳', native: 'हिन्दी' },
  { code: 'mr', name: 'Marathi', flag: '🇮🇳', native: 'मराठी' },
  { code: 'ta', name: 'Tamil', flag: '🇮🇳', native: 'தமிழ்' },
  { code: 'te', name: 'Telugu', flag: '🇮🇳', native: 'తెలుగు' },
  { code: 'bn', name: 'Bengali', flag: '🇮🇳', native: 'বাংলা' },
];

export default function LanguageSelector({ language, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const current = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="language-selector" ref={dropdownRef}>
      <button
        className="lang-btn"
        onClick={() => setIsOpen(!isOpen)}
        id="language-selector"
      >
        <span className="lang-flag">{current.flag}</span>
        <span>{current.name}</span>
        <span style={{ fontSize: 10, opacity: 0.6 }}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="lang-dropdown">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              className={`lang-option ${lang.code === language ? 'active' : ''}`}
              onClick={() => {
                onChange(lang.code);
                setIsOpen(false);
              }}
            >
              <span className="lang-flag">{lang.flag}</span>
              <span>{lang.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.6 }}>{lang.native}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
