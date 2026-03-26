import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import { Leva } from 'leva';
import { Scenario } from './components/Scenario';
import LanguageSelector from './components/LanguageSelector';
import AvatarSelection from './components/AvatarSelection';
import { getAvatarUrl } from './avatarData';

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
  { id: 'gradient', label: 'Gradient', value: 'linear-gradient(135deg, #EDE7DA 0%, #F5F1E6 100%)' },
  { id: 'office', label: 'Office', value: 'url(/backgrounds/office.png)' },
  { id: 'workspace', label: 'Workspace', value: 'url(/backgrounds/workspace.png)' },
  { id: 'conference', label: 'Conference', value: 'url(/backgrounds/conference.png)' },
  { id: 'library', label: 'Library', value: 'url(/backgrounds/library.png)' },
];

export default function App() {
  // ── Screen: 'select' or 'call' ──
  const [screen, setScreen] = useState('select');
  const [activeAvatar, setActiveAvatar] = useState(null);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState('en');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [pipelineStage, setPipelineStage] = useState(null);
  const [serviceHealth, setServiceHealth] = useState({});
  const [conversationMode, setConversationMode] = useState(false);
  const [currentText, setCurrentText] = useState('');

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

  const micStreamRef = useRef(null);
  const vadIntervalRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const isUserSpeakingRef = useRef(false);
  const abortControllerRef = useRef(null);
  const latestInputRef = useRef('');

  useEffect(() => { latestInputRef.current = input; }, [input]);

  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);
  useEffect(() => { 
    isSpeakingRef.current = isSpeaking; 
    if (isSpeaking) {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch(e) {}
      }
      if (micStreamRef.current) {
        const track = micStreamRef.current.getAudioTracks()[0];
        if (track) track.enabled = false;
      }
    } else {
      if (isListening) {
        if (micStreamRef.current) {
          const track = micStreamRef.current.getAudioTracks()[0];
          if (track) track.enabled = true;
        }
        if (recognitionRef.current && micStreamRef.current) {
          setTimeout(() => { try { recognitionRef.current.start(); } catch(e){} }, 500);
        }
      }
    }
  }, [isSpeaking, isListening]);
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

  function stopAllSpeechAndAudio() {
    isPlayingRef.current = false;
    audioQueueRef.current = [];
    if (audioRef.current) {
        audioRef.current.pause();
    }
    setIsSpeaking(false);
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
    }
    setPipelineStage(null);
    setIsLoading(false);
  }

  // ── Avatar selection handler ──
  function handleAvatarSelect(avatar) {
    setActiveAvatar(avatar);
    setMessages([]);
    setInput('');
    setChatOpen(false);
    // Use avatar's default background if set
    if (avatar.background) {
      setSelectedBg('custom');
      setCustomBg(avatar.background);
    } else {
      setSelectedBg('none');
      setCustomBg(null);
    }
    setScreen('call');
    
    // Start continuous listening with mic permission after transition
    setTimeout(() => {
        getAudioContext();
        startContinuousListening();
    }, 1000);
  }

  function handleBackToSelect() {
    stopAllSpeechAndAudio();
    if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
    }
    if (vadIntervalRef.current) clearInterval(vadIntervalRef.current);
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    setIsListening(false);
    setScreen('select');
  }

  // ── Build conversation history with personality prompt ──
  function buildHistory() {
    const history = [];
    // Inject personality as system message
    if (activeAvatar?.personality) {
      history.push({ role: 'system', content: activeAvatar.personality });
    }
    // Add last 10 messages
    messages.slice(-10).forEach(m => history.push({ role: m.role, content: m.content }));
    return history;
  }

  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const pipelineStageRef = useRef(null);
  useEffect(() => { pipelineStageRef.current = pipelineStage; }, [pipelineStage]);

  const processAudioQueue = () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;
    const url = audioQueueRef.current.shift();
    
    const { ctx, analyser } = getAudioContext();
    const audio = new Audio(url);
    try { const source = ctx.createMediaElementSource(audio); source.connect(analyser); } catch (e) { console.warn('AudioContext error:', e); }
    audioRef.current = audio;
    setIsSpeaking(true);
    
    audio.play().catch(() => {
       isPlayingRef.current = false;
       setIsSpeaking(false); 
       processAudioQueue(); 
    });
    
    audio.onended = () => {
       isPlayingRef.current = false;
       if (audioQueueRef.current.length > 0) {
         processAudioQueue();
       } else {
         setIsSpeaking(false);
       }
    };
    audio.onerror = () => {
       isPlayingRef.current = false;
       if (audioQueueRef.current.length > 0) processAudioQueue();
       else setIsSpeaking(false);
    };
  };

  const enqueueAudio = (url) => {
    // If url is relative, prepend GATEWAY_URL (which is empty string right now anyway)
    const fullUrl = url.startsWith('http') ? url : `${GATEWAY_URL}${url}`;
    audioQueueRef.current.push(fullUrl);
    processAudioQueue();
  };

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isLoading) return;
    const userMsg = { role: 'user', content: text.trim(), time: new Date().toLocaleTimeString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setPipelineStage('thinking');
    setCurrentText('');
    
    const msgId = Date.now();
    setMessages(prev => [...prev, { id: msgId, role: 'assistant', content: '', time: new Date().toLocaleTimeString() }]);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const res = await fetch(`${GATEWAY_URL}/api/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          message: text.trim(),
          language,
          history: buildHistory(),
        }),
      });
      
      if (!res.ok) throw new Error('Gateway is not responding.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      let jsonBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        jsonBuffer += decoder.decode(value, { stream: true });
        const lines = jsonBuffer.split('\n');
        jsonBuffer = lines.pop(); // Keep incomplete lines
        
        for (const line of lines) {
           if (line.startsWith('data: ')) {
              try {
                 const data = JSON.parse(line.slice(6));
                 if (data.type === 'text') {
                    if (assistantText === '') {
                       setIsLoading(false);
                       setPipelineStage(null); 
                    }
                    assistantText += data.chunk;
                    setCurrentText(assistantText);
                    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: assistantText } : m));
                 } else if (data.type === 'audio') {
                    enqueueAudio(data.url);
                 } else if (data.type === 'done') {
                    setIsLoading(false);
                    setPipelineStage(null);
                 } else if (data.type === 'error') {
                    throw new Error(data.error);
                 }
              } catch (e) {}
           }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
         // Interrupted, silently clean up
         setMessages(prev => prev.filter(m => m.id !== msgId));
      } else {
         setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: `Error: ${err.message}`, isError: true } : m));
      }
      setPipelineStage(null);
      setIsLoading(false);
    }
  }, [language, messages, isLoading, conversationMode, activeAvatar]);

  const sendMessageRef = useRef(sendMessage);
  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

  function startContinuousListening() {
    if (micStreamRef.current || recognitionRef.current) return;

    setIsListening(true);
    
    // 1. Setup VAD (Volume polling)
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      micStreamRef.current = stream;
      const { ctx } = getAudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      vadIntervalRef.current = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avgVolume = sum / dataArray.length;

        const volumeThreshold = 5; // Adjust this if background noise is high
        
        if (avgVolume > volumeThreshold) {
          // Do not listen or interrupt when avatar is speaking
          if (isSpeakingRef.current) return;

          if (!isUserSpeakingRef.current) {
            isUserSpeakingRef.current = true;
          }
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else {
          // Silence detected
          if (isUserSpeakingRef.current && !silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
               isUserSpeakingRef.current = false;
               silenceTimerRef.current = null;
               
               const finalTxt = latestInputRef.current.trim();
               if (finalTxt) {
                   sendMessageRef.current(finalTxt);
                   setInput('');
                   if (recognitionRef.current) {
                      recognitionRef.current.stop();
                      setTimeout(() => { try { recognitionRef.current.start(); } catch(e){} }, 100);
                   }
               }
            }, 1000); // 1000ms silence threshold (Layer 2)
          }
        }
      }, 100);
    }).catch(err => console.error("Mic access denied:", err));

    // 2. Setup Speech Recognition
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = SPEECH_LANG_MAP[languageRef.current] || 'en-IN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      // Prevent listening when avatar is speaking
      if (isSpeakingRef.current) return;

      let interim = '';
      let finalStr = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalStr += t; else interim += t;
      }
      
      const currentFull = finalStr + interim;
      if (currentFull.trim()) setInput(currentFull.trim());

      // Auto-submit if STT yields a final result
      if (finalStr.trim() && !interim.trim()) {
         sendMessageRef.current(finalStr.trim());
         setInput('');
         if (recognitionRef.current) {
             recognitionRef.current.stop();
             setTimeout(() => { try { recognitionRef.current.start(); } catch(e){} }, 100);
         }
      }
    };

    recognition.onend = () => {
      // Keep it continuous, but do NOT restart if avatar is speaking
      if (micStreamRef.current && !isSpeakingRef.current) {
         setTimeout(() => { try { recognition.start(); } catch(e) {} }, 100);
      }
    };
    recognition.onerror = () => {};
    recognition.start();
  }

  function toggleListening() {
    if (micStreamRef.current) {
        const audioTrack = micStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            if (!audioTrack.enabled) setIsListening(false);
            else setIsListening(true);
        }
    } else {
       startContinuousListening();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); getAudioContext(); sendMessage(input); }
  }

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
  const avatarName = activeAvatar?.name || 'Ajay';
  const avatarTitle = activeAvatar?.title || 'AI Civic Assistant';
  const avatarInitial = avatarName.charAt(0);
  const avatarUrl = getAvatarUrl(activeAvatar);

  // Layer 10: Debug Logging
  console.log('Selected Gender:', activeAvatar?.avatarGender || 'default');
  console.log('Avatar URL:', avatarUrl);

  // ═══ SELECTION SCREEN ═══
  if (screen === 'select') {
    return <AvatarSelection onSelect={handleAvatarSelect} />;
  }

  // ═══ VIDEO CALL SCREEN ═══
  return (
    <div className="app">
      <Leva collapsed hidden />

      {/* ── Header ── */}
      <header className="header">
        <div className="header-left">
          <button className="back-btn" onClick={handleBackToSelect} title="Back to avatar selection">←</button>
          <div className="logo">{avatarInitial}</div>
          <div className="logo-text">
            <span className="logo-name">{avatarName}</span>
            <span className="logo-sub">{avatarTitle}</span>
          </div>
        </div>
        <div className="header-right">
          <LanguageSelector language={language} onChange={setLanguage} />
          <button className="hdr-btn" onClick={() => setBgPanelOpen(p => !p)} title="Virtual Background">🖼️ Background</button>
          <button className={`hdr-btn ${chatOpen ? 'active' : ''}`} onClick={() => setChatOpen(p => !p)} title="Toggle Chat">💬 Chat</button>
        </div>
      </header>

      {/* ── Main ── */}
      <div className="main">
        {/* Stage */}
        <div className="stage">
          <div className="video-window" style={getBackgroundStyle()}>
            <Canvas shadows camera={{ position: [0, 0, 0], fov: 10 }} style={{ width: '100%', height: '100%' }}>
              <Suspense fallback={null}>
                <Scenario key={avatarUrl} avatarUrl={avatarUrl} isSpeaking={isSpeaking} isListening={isListening} analyserRef={analyserRef} currentText={currentText} audioRef={audioRef} pipelineStage={pipelineStage} />
              </Suspense>
            </Canvas>
            <Loader />
          </div>

          <div className="nameplate">
            <h1>{avatarName}</h1>
            <p>{avatarTitle} · Government of India</p>
          </div>

          {(isSpeaking || isListening) && (
            <div className={`status-pill ${isSpeaking ? 'speaking' : isListening ? 'listening active' : 'listening'}`}>
              {isSpeaking && <><div className="bars"><span /><span /><span /><span /><span /></div> Speaking</>}
              {isListening && !isSpeaking && <><div className="pulse-dot" /> Listening…</>}
            </div>
          )}

          {/* Google Meet-style control bar */}
          <div className="control-bar" style={{ justifyContent: 'center' }}>
            <button
              className={`mic-btn ${isListening ? 'active' : 'muted'}`}
              onClick={() => { getAudioContext(); toggleListening(); }}
              title={isListening ? 'Mute Microphone' : `Unmute Microphone`}
              id="mic-button"
            >
              {isListening ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" /><path d="M17 16.95A7 7 0 0 1 5 12H3a9 9 0 0 0 8 8.94V23h2v-2.06a8.98 8.98 0 0 0 5.39-2.74" /></svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Chat Backdrop ── */}
      {chatOpen && <div className="chat-backdrop" onClick={() => setChatOpen(false)} />}

      {/* ── Chat Panel (fixed overlay) ── */}
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
              <p>Ask {avatarName} about government schemes, public services, or programs.</p>
              <div className="chips">
                {QUICK_QUESTIONS.map((q, i) => (
                  <button key={i} className="chip" onClick={() => { getAudioContext(); sendMessage(q); }}>{q}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`msg ${msg.role}`}>
              {msg.role === 'assistant' && <div className="msg-avatar">{avatarInitial}</div>}
              <div className="msg-body">
                <div className="msg-text">{msg.content}</div>
                <div className="msg-time">{msg.time}{msg.pipelineTime && ` · ${(msg.pipelineTime / 1000).toFixed(1)}s`}</div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="msg assistant">
              <div className="msg-avatar">{avatarInitial}</div>
              <div className="msg-body"><div className="typing"><span /><span /><span /></div></div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="chat-input">
          <div className="input-wrap">
            <textarea className="input-field" value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={`Ask ${avatarName} anything…`} rows={1} disabled={isLoading} id="text-input" />
            <button className="send-btn" onClick={() => { getAudioContext(); sendMessage(input); }} disabled={!input.trim() || isLoading} id="send-button">➤</button>
          </div>
        </div>
      </aside>

      {/* Background Selector */}
      {bgPanelOpen && (
        <div className="bg-overlay" onClick={() => setBgPanelOpen(false)}>
          <div className="bg-panel" onClick={e => e.stopPropagation()}>
            <div className="bg-panel-header"><span>Virtual Background</span><button className="bg-close" onClick={() => setBgPanelOpen(false)}>✕</button></div>
            <div className="bg-grid">
              {BACKGROUNDS.map(bg => (
                <button key={bg.id} className={`bg-thumb ${selectedBg === bg.id && !customBg ? 'selected' : ''}`}
                  onClick={() => { setSelectedBg(bg.id); setCustomBg(null); }}
                  style={bg.value?.startsWith('url') ? { backgroundImage: bg.value, backgroundSize: 'cover', backgroundPosition: 'center' } : bg.value ? { background: bg.value } : {}}>
                  <span className="bg-label">{bg.label}</span>
                </button>
              ))}
              <button className={`bg-thumb upload ${customBg ? 'selected' : ''}`} onClick={() => fileInputRef.current?.click()}
                style={customBg ? { backgroundImage: `url(${customBg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
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
