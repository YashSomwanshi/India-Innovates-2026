import { useState, useRef, useEffect, useCallback } from 'react';
import AvatarCanvas from './components/AvatarCanvas';
import LanguageSelector from './components/LanguageSelector';

const GATEWAY_URL = '';  // Uses Vite proxy

const QUICK_QUESTIONS = [
  'What is Digital India?',
  'Explain Ayushman Bharat scheme',
  'How to apply for PM Kisan?',
  'What is Swachh Bharat Mission?',
  'Tell me about Make in India',
  'How does Skill India work?',
];

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState('en');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false); // Auto-listen mode
  const [pipelineStage, setPipelineStage] = useState(null);
  const [serviceHealth, setServiceHealth] = useState({});
  const [conversationMode, setConversationMode] = useState(false); // Talking Tom mode

  const chatEndRef = useRef(null);
  const audioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // Single shared AudioContext + Analyser (persists across all audio plays)
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);

  // Initialize shared AudioContext once
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
    // Resume if suspended (browser autoplay policy)
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return { ctx: audioCtxRef.current, analyser: analyserRef.current };
  }

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Health check on load
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
    } catch {
      setServiceHealth({});
    }
  }

  // Send text message through pipeline
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
          message: text.trim(),
          language,
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const text2 = await res.text();
      let data;
      try {
        data = JSON.parse(text2);
      } catch {
        throw new Error('Gateway is not responding. Run: node scripts/start-all.js');
      }

      if (data.error) throw new Error(data.error);

      const assistantMsg = {
        role: 'assistant',
        content: data.response,
        time: new Date().toLocaleTimeString(),
        audioUrl: data.audio_url,
        pipelineTime: data.pipeline?.total_time_ms,
      };

      setMessages(prev => [...prev, assistantMsg]);
      setPipelineStage(null);

      // Play audio if available
      if (data.audio_url) {
        playAudio(data.audio_url);
      } else {
        // No audio — if conversation mode, auto-listen
        if (conversationMode) {
          setTimeout(() => startListening(), 500);
        }
      }

    } catch (err) {
      console.error('Pipeline error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err.message}. Please make sure all services are running.`,
        time: new Date().toLocaleTimeString(),
        isError: true,
      }]);
      setPipelineStage(null);
    } finally {
      setIsLoading(false);
    }
  }, [language, messages, isLoading, conversationMode]);

  // ─── Play audio with shared AudioContext ───
  function playAudio(url) {
    // Stop any current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
    }

    const { ctx, analyser } = getAudioContext();
    const audio = new Audio(url);

    // Connect this audio element to our shared analyser
    try {
      const source = ctx.createMediaElementSource(audio);
      source.connect(analyser);  // analyser already connected to destination
    } catch (e) {
      console.warn('AudioContext connection failed:', e);
    }

    audioRef.current = audio;
    setIsSpeaking(true);

    audio.play().catch((e) => {
      console.warn('Audio play failed:', e);
      setIsSpeaking(false);
      // If play failed and in conversation mode, still auto-listen
      if (conversationMode) setTimeout(() => startListening(), 500);
    });

    audio.onended = () => {
      setIsSpeaking(false);
      // Auto-listen after speaking (Talking Tom mode)
      if (conversationMode) {
        setTimeout(() => startListening(), 600);
      }
    };

    audio.onerror = () => {
      setIsSpeaking(false);
      if (conversationMode) setTimeout(() => startListening(), 500);
    };
  }

  // ─── Auto-listen (start recording automatically) ───
  async function startListening() {
    if (isLoading || isSpeaking || isRecording) return;

    try {
      setIsListening(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setIsListening(false);
        setIsRecording(false);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size > 1000) { // Only send if there's meaningful audio
          await sendAudio(blob);
        }
      };

      recorder.start();
      setIsRecording(true);

      // Auto-stop after 8 seconds of silence / max recording
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, 8000);

    } catch (err) {
      console.error('Auto-listen error:', err);
      setIsListening(false);
    }
  }

  // Manual toggle recording
  async function toggleRecording() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      // Resume AudioContext on user gesture
      getAudioContext();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await sendAudio(blob);
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Mic error:', err);
    }
  }

  // Send audio for STT → Pipeline
  async function sendAudio(blob) {
    setIsLoading(true);
    setPipelineStage('transcribing');

    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');

      const sttRes = await fetch(`${GATEWAY_URL}/api/speech-to-text`, {
        method: 'POST',
        body: formData,
      });
      const sttText = await sttRes.text();
      let sttData;
      try {
        sttData = JSON.parse(sttText);
      } catch {
        throw new Error('STT service not responding');
      }

      if (sttData.text) {
        await sendMessage(sttData.text);
      } else {
        throw new Error('Could not transcribe audio');
      }
    } catch (err) {
      console.error('STT error:', err);
      setIsLoading(false);
      setPipelineStage(null);
    }
  }

  // Handle Enter key
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Resume AudioContext on user gesture
      getAudioContext();
      sendMessage(input);
    }
  }

  const langNames = { en: 'English', hi: 'Hindi', mr: 'Marathi', ta: 'Tamil', te: 'Telugu', bn: 'Bengali' };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="header-logo">D</div>
          <div>
            <div className="header-title">Disha</div>
            <div className="header-subtitle">AI Civic Assistant</div>
          </div>
        </div>

        <div className="header-controls">
          <div className="service-status">
            {Object.entries(serviceHealth).map(([name, info]) => (
              <span key={name} className={`service-badge ${info.status === 'ok' ? 'ok' : 'error'}`}>
                <span className="status-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }}></span>
                {name}
              </span>
            ))}
          </div>
          <LanguageSelector language={language} onChange={setLanguage} />
        </div>
      </header>

      {/* Main Content */}
      <div className="main-content">
        {/* Avatar Panel */}
        <div className="avatar-panel">
          <div className="avatar-container">
            <div className={`avatar-canvas-wrap ${isSpeaking ? 'speaking' : ''} ${isListening ? 'listening' : ''}`}>
              <AvatarCanvas isSpeaking={isSpeaking} isListening={isListening} analyserRef={analyserRef} />
            </div>
            <div className="avatar-name">Disha</div>
            <div className="avatar-role">AI Civic Assistant • Government of India</div>
            <div className={`avatar-status ${isSpeaking ? 'speaking' : isListening ? 'listening' : isLoading ? 'thinking' : 'idle'}`}>
              <span className={`status-dot ${(isSpeaking || isLoading || isListening) ? 'pulse' : ''}`}></span>
              {isSpeaking ? '🔊 Speaking...' : isListening ? '🎙️ Listening...' : isLoading ? (pipelineStage || 'Processing...') : 'Ready to help'}
            </div>

            {/* Pipeline Status */}
            {isLoading && (
              <div className="pipeline-status">
                <span className={`pipeline-step ${pipelineStage === 'transcribing' ? 'active' : pipelineStage !== 'transcribing' ? 'done' : ''}`}>STT</span>
                <span className="pipeline-arrow">→</span>
                <span className={`pipeline-step ${pipelineStage === 'thinking' ? 'active' : ''}`}>LLM</span>
                <span className="pipeline-arrow">→</span>
                <span className={`pipeline-step ${pipelineStage === 'synthesizing' ? 'active' : ''}`}>TTS</span>
              </div>
            )}

            {/* Conversation Mode Toggle */}
            <button
              className={`btn conversation-toggle ${conversationMode ? 'active' : ''}`}
              onClick={() => {
                getAudioContext(); // Resume on user gesture
                setConversationMode(prev => !prev);
              }}
              style={{
                marginTop: 12,
                fontSize: 12,
                padding: '6px 16px',
                background: conversationMode ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)',
                border: conversationMode ? '1px solid rgba(16,185,129,0.5)' : '1px solid rgba(255,255,255,0.1)',
                color: conversationMode ? '#10b981' : 'var(--text-muted)',
                borderRadius: 20,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
            >
              {conversationMode ? '🔄 Conversation Mode ON' : '💬 Enable Conversation Mode'}
            </button>
          </div>
        </div>

        {/* Chat Panel */}
        <div className="chat-panel">
          <div className="chat-header">
            💬 Conversation
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
              {langNames[language]}
            </span>
          </div>

          <div className="chat-messages">
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🇮🇳</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, color: 'var(--text-secondary)' }}>
                  Welcome to Disha
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                  Ask me about government schemes, public services, or educational programs.
                  <br /><br />
                  <strong>💡 Tip:</strong> Enable <em>Conversation Mode</em> for hands-free, two-way chat — Disha will automatically listen after speaking!
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`message ${msg.role}`}>
                <div>{msg.content}</div>
                <div className="message-meta">
                  {msg.time}
                  {msg.pipelineTime && ` • ${(msg.pipelineTime / 1000).toFixed(1)}s`}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="message assistant">
                <div className="loading-dots">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="chat-input-area">
            {/* Quick Actions */}
            {messages.length === 0 && (
              <div className="quick-actions">
                {QUICK_QUESTIONS.map((q, i) => (
                  <button key={i} className="quick-btn" onClick={() => { getAudioContext(); sendMessage(q); }}>{q}</button>
                ))}
              </div>
            )}

            <div className="input-row">
              <button
                className={`btn btn-icon btn-mic ${isRecording ? 'recording' : ''}`}
                onClick={() => { getAudioContext(); toggleRecording(); }}
                title={isRecording ? 'Stop recording' : 'Start recording'}
                id="mic-button"
              >
                {isRecording ? '⏹' : '🎤'}
              </button>
              <textarea
                className="text-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Ask Disha anything in ${langNames[language]}...`}
                rows={1}
                disabled={isLoading}
                id="text-input"
              />
              <button
                className="btn btn-primary"
                onClick={() => { getAudioContext(); sendMessage(input); }}
                disabled={!input.trim() || isLoading}
                id="send-button"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
