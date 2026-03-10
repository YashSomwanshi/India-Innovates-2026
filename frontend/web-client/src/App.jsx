import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import { Leva } from 'leva';
import { Scenario } from './components/Scenario';
import LanguageSelector from './components/LanguageSelector';

const GATEWAY_URL = '';

const QUICK_QUESTIONS = [
  'What is Digital India?',
  'Explain Ayushman Bharat scheme',
  'How to apply for PM Kisan?',
  'What is Swachh Bharat Mission?',
  'Tell me about Make in India',
  'How does Skill India work?',
];

const SPEECH_LANG_MAP = {
  en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN', ta: 'ta-IN', te: 'te-IN', bn: 'bn-IN',
};

const BACKGROUNDS = [
  { id: 'none', label: 'None', value: null },
  { id: 'gradient', label: 'Gradient', value: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' },
  { id: 'office', label: 'Office', value: 'url(/backgrounds/office.png)' },
  { id: 'workspace', label: 'Workspace', value: 'url(/backgrounds/workspace.png)' },
  { id: 'conference', label: 'Conference', value: 'url(/backgrounds/conference.png)' },
  { id: 'library', label: 'Library', value: 'url(/backgrounds/library.png)' },
];

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState('en');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [pipelineStage, setPipelineStage] = useState(null);
  const [serviceHealth, setServiceHealth] = useState({});
  const [conversationMode, setConversationMode] = useState(false);

  // UI state
  const [chatOpen, setChatOpen] = useState(false);
  const [bgPanelOpen, setBgPanelOpen] = useState(false);
  const [selectedBg, setSelectedBg] = useState('none');
  const [customBg, setCustomBg] = useState(null);

  const chatEndRef = useRef(null);
  const audioRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const fileInputRef = useRef(null);

  const isLoadingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const conversationModeRef = useRef(false);
  const languageRef = useRef('en');

  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { conversationModeRef.current = conversationMode; }, [conversationMode]);
  useEffect(() => { languageRef.current = language; }, [language]);

  function getAudioContext() {
    if (!audioCtxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AC();
      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      analyser.connect(audioCtxRef.current.destination);
      analyserRef.current = analyser;
    }
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    return { ctx: audioCtxRef.current, analyser: analyserRef.current };
  }

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  async function checkHealth() {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/health`);
      const data = await res.json();
      setServiceHealth(data.services || {});
    } catch { setServiceHealth({}); }
  }

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isLoading) return;
    const userMsg = { role: 'user', content: text.trim(), time: new Date().toLocaleTimeString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setPipelineStage('thinking');
    try {
      const res = await fetch(`${GATEWAY_URL}/api/pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(), language,
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const text2 = await res.text();
      let data;
      try { data = JSON.parse(text2); } catch { throw new Error('Gateway is not responding.'); }
      if (data.error) throw new Error(data.error);
      const assistantMsg = {
        role: 'assistant', content: data.response,
        time: new Date().toLocaleTimeString(), audioUrl: data.audio_url,
        pipelineTime: data.pipeline?.total_time_ms,
      };
      setMessages(prev => [...prev, assistantMsg]);
      setPipelineStage(null);
      if (data.audio_url) playAudio(data.audio_url);
      else if (conversationMode) setTimeout(() => startListening(), 500);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant', content: `Error: ${err.message}`,
        time: new Date().toLocaleTimeString(), isError: true,
      }]);
      setPipelineStage(null);
    } finally { setIsLoading(false); }
  }, [language, messages, isLoading, conversationMode]);

  const sendMessageRef = useRef(sendMessage);
  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

  function playAudio(url) {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.onended = null; audioRef.current.onerror = null; }
    const { ctx, analyser } = getAudioContext();
    const audio = new Audio(url);
    try { const source = ctx.createMediaElementSource(audio); source.connect(analyser); } catch (e) { console.warn('AudioContext error:', e); }
    audioRef.current = audio;
    setIsSpeaking(true);
    audio.play().catch(() => { setIsSpeaking(false); if (conversationMode) setTimeout(() => startListening(), 500); });
    audio.onended = () => { setIsSpeaking(false); if (conversationModeRef.current) setTimeout(() => startListening(), 600); };
    audio.onerror = () => { setIsSpeaking(false); if (conversationModeRef.current) setTimeout(() => startListening(), 500); };
  }

  function startListening() {
    if (isLoadingRef.current || isSpeakingRef.current || recognitionRef.current) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = SPEECH_LANG_MAP[languageRef.current] || 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;
    setIsListening(true);
    let finalTranscript = '';
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += t; else interim += t;
      }
      setInput(finalTranscript + interim);
    };
    recognition.onend = () => {
      recognitionRef.current = null; setIsListening(false);
      if (finalTranscript.trim()) { setInput(''); sendMessageRef.current(finalTranscript.trim()); }
    };
    recognition.onerror = () => { recognitionRef.current = null; setIsListening(false); };
    recognition.start();
  }

  function toggleListening() {
    if (recognitionRef.current) { recognitionRef.current.stop(); return; }
    startListening();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); getAudioContext(); sendMessage(input); }
  }

  // Background helpers
  function getBackgroundStyle() {
    if (customBg) return { backgroundImage: `url(${customBg})`, backgroundSize: 'cover', backgroundPosition: 'center' };
    const bg = BACKGROUNDS.find(b => b.id === selectedBg);
    if (!bg || !bg.value) return {};
    if (bg.value.startsWith('url')) return { backgroundImage: bg.value, backgroundSize: 'cover', backgroundPosition: 'center' };
    return { background: bg.value };
  }

  function handleCustomBgUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setCustomBg(reader.result); setSelectedBg('custom'); };
    reader.readAsDataURL(file);
  }

  const langNames = { en: 'English', hi: 'Hindi', mr: 'Marathi', ta: 'Tamil', te: 'Telugu', bn: 'Bengali' };

  return (
    <div className="app">
      <Leva collapsed hidden />

      {/* ══ Header ══ */}
      <header className="header">
        <div className="header-left">
          <div className="logo">A</div>
          <div className="logo-text">
            <span className="logo-name">Ajay</span>
            <span className="logo-sub">AI Civic Assistant</span>
          </div>
        </div>
        <div className="header-right">
          <LanguageSelector language={language} onChange={setLanguage} />
          <button className="hdr-btn" onClick={() => setBgPanelOpen(p => !p)} title="Virtual Background">
            🖼️ Background
          </button>
          <button className={`hdr-btn ${chatOpen ? 'active' : ''}`} onClick={() => setChatOpen(p => !p)} title="Toggle Chat">
            💬 Chat
          </button>
        </div>
      </header>

      {/* ══ Main Area ══ */}
      <div className={`main ${chatOpen ? 'chat-visible' : ''}`}>

        {/* ── Avatar Stage ── */}
        <div className="stage">
          <div className="video-window" style={getBackgroundStyle()}>
            <Canvas shadows camera={{ position: [0, 0, 0], fov: 10 }} style={{ width: '100%', height: '100%' }}>
              <Suspense fallback={null}>
                <Scenario isSpeaking={isSpeaking} isListening={isListening} analyserRef={analyserRef} />
              </Suspense>
            </Canvas>
            <Loader />
          </div>

          {/* Name under video */}
          <div className="nameplate">
            <h1>Ajay</h1>
            <p>AI Civic Assistant · Government of India</p>
          </div>

          {/* Status indicator */}
          {(isSpeaking || isListening || isLoading) && (
            <div className={`status-pill ${isSpeaking ? 'speaking' : isListening ? 'listening' : 'thinking'}`}>
              {isSpeaking && <><div className="bars"><span/><span/><span/><span/><span/></div> Speaking</>}
              {isListening && <><div className="pulse-dot"/> Listening…</>}
              {isLoading && !isSpeaking && !isListening && <><div className="dots"><span/><span/><span/></div> Thinking</>}
            </div>
          )}

          {/* ── Mic Button (centered below avatar) ── */}
          <button
            className={`mic-main ${isListening ? 'active' : ''} ${isSpeaking ? 'speaking' : ''}`}
            onClick={() => { getAudioContext(); toggleListening(); }}
            disabled={isLoading && !isListening}
            title={isListening ? 'Stop listening' : 'Speak to Ajay'}
            id="mic-button"
          >
            {isListening ? '⏹' : '🎤'}
          </button>

          {/* Conversation mode toggle */}
          <button
            className={`auto-btn ${conversationMode ? 'on' : ''}`}
            onClick={() => { getAudioContext(); setConversationMode(p => !p); }}
          >
            {conversationMode ? '🔄 Auto-conversation ON' : '💬 Auto-conversation OFF'}
          </button>
        </div>

        {/* ── Chat Panel (slides from right) ── */}
        <aside className={`chat-panel ${chatOpen ? 'open' : ''}`}>
          <div className="chat-top">
            <span className="chat-title">Chat</span>
            <button className="chat-close" onClick={() => setChatOpen(false)}>✕</button>
          </div>

          <div className="chat-msgs">
            {messages.length === 0 && (
              <div className="empty">
                <div className="empty-icon">🇮🇳</div>
                <h3>Welcome</h3>
                <p>Ask Ajay about government schemes, public services, or educational programs.</p>
                <div className="chips">
                  {QUICK_QUESTIONS.map((q, i) => (
                    <button key={i} className="chip" onClick={() => { getAudioContext(); sendMessage(q); }}>{q}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`msg ${msg.role}`}>
                {msg.role === 'assistant' && <div className="msg-avatar">A</div>}
                <div className="msg-body">
                  <div className="msg-text">{msg.content}</div>
                  <div className="msg-time">{msg.time}{msg.pipelineTime && ` · ${(msg.pipelineTime/1000).toFixed(1)}s`}</div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="msg assistant">
                <div className="msg-avatar">A</div>
                <div className="msg-body"><div className="typing"><span/><span/><span/></div></div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="chat-input">
            <div className="input-wrap">
              <textarea
                className="input-field"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Ajay anything…"
                rows={1}
                disabled={isLoading}
                id="text-input"
              />
              <button className="send-btn" onClick={() => { getAudioContext(); sendMessage(input); }} disabled={!input.trim() || isLoading} id="send-button">➤</button>
            </div>
          </div>
        </aside>
      </div>

      {/* ══ Background Selector Panel ══ */}
      {bgPanelOpen && (
        <div className="bg-overlay" onClick={() => setBgPanelOpen(false)}>
          <div className="bg-panel" onClick={e => e.stopPropagation()}>
            <div className="bg-panel-header">
              <span>Virtual Background</span>
              <button className="bg-close" onClick={() => setBgPanelOpen(false)}>✕</button>
            </div>
            <div className="bg-grid">
              {BACKGROUNDS.map(bg => (
                <button
                  key={bg.id}
                  className={`bg-thumb ${selectedBg === bg.id && !customBg ? 'selected' : ''}`}
                  onClick={() => { setSelectedBg(bg.id); setCustomBg(null); }}
                  style={bg.value?.startsWith('url') ? { backgroundImage: bg.value, backgroundSize: 'cover', backgroundPosition: 'center' } : bg.value ? { background: bg.value } : {}}
                >
                  <span className="bg-label">{bg.label}</span>
                </button>
              ))}

              {/* Custom upload */}
              <button className={`bg-thumb upload ${customBg ? 'selected' : ''}`} onClick={() => fileInputRef.current?.click()}
                style={customBg ? { backgroundImage: `url(${customBg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
              >
                <span className="bg-label">{customBg ? 'Custom' : '+ Upload'}</span>
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCustomBgUpload} />
          </div>
        </div>
      )}
    </div>
  );
}
