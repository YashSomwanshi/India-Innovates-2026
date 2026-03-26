import { Suspense, useRef, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import { Leva } from 'leva';
import { Scenario } from './components/Scenario';
import { getAvatarUrl, DEFAULT_AVATARS } from './avatarData';

/**
 * AvatarView — Lightweight standalone 3D avatar renderer.
 * Loaded by mobile WebView via: /avatar-view?avatar=pm&gender=male
 * 
 * Communication:
 *   Mobile → WebView: postMessage({ type: "PLAY_AUDIO", audioUrl, text })
 *   WebView → Mobile: ReactNativeWebView.postMessage({ type: "SPEECH_ENDED" })
 *
 * Audio Architecture:
 *   Audio → MediaElementSource → AnalyserNode → AudioContext.destination
 *   AnalyserNode feeds lip-sync data to Scenario component
 */
export default function AvatarView() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const audioRef = useRef(null);
  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null);
  const audioUnlockedRef = useRef(false);

  // Parse URL params
  const params = new URLSearchParams(window.location.search);
  const avatarId = params.get('avatar') || 'pm';
  const gender = params.get('gender') || 'male';

  const avatar = DEFAULT_AVATARS.find(a => a.id === avatarId) || DEFAULT_AVATARS[0];
  const avatarUrl = getAvatarUrl(avatar);

  function getAudioContext() {
    if (!audioCtxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AC();
      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      analyser.connect(audioCtxRef.current.destination);
      analyserRef.current = analyser;
      console.log('[AvatarView] AudioContext created, state:', audioCtxRef.current.state);
    }
    // CRITICAL: Resume suspended AudioContext (mobile restriction)
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().then(() => {
        console.log('[AvatarView] AudioContext resumed successfully');
      }).catch(e => {
        console.warn('[AvatarView] AudioContext resume failed:', e);
      });
    }
    return { ctx: audioCtxRef.current, analyser: analyserRef.current };
  }

  // Unlock AudioContext on first user interaction (mobile WebView requirement)
  useEffect(() => {
    function unlockAudio() {
      if (audioUnlockedRef.current) return;
      audioUnlockedRef.current = true;
      console.log('[AvatarView] User gesture detected, unlocking audio');
      getAudioContext();
      // Also try playing a silent buffer to fully unlock
      try {
        const ctx = audioCtxRef.current;
        if (ctx) {
          const buffer = ctx.createBuffer(1, 1, 22050);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.start(0);
          console.log('[AvatarView] Silent buffer played for unlock');
        }
      } catch (e) {
        console.warn('[AvatarView] Silent buffer unlock failed:', e);
      }
    }

    document.addEventListener('click', unlockAudio, { once: false });
    document.addEventListener('touchstart', unlockAudio, { once: false });
    document.addEventListener('touchend', unlockAudio, { once: false });

    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('touchend', unlockAudio);
    };
  }, []);

  function playAvatarSpeech(audioUrl, text) {
    console.log('[AvatarView] playAvatarSpeech called');
    console.log('[AvatarView] Audio URL:', audioUrl);

    // Stop any currently playing audio
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch (e) {}
    }

    const { ctx, analyser } = getAudioContext();
    console.log('[AvatarView] AudioContext state:', ctx.state);

    // Create audio element with proper settings
    const audio = new Audio(audioUrl);
    audio.crossOrigin = 'anonymous';
    audio.volume = 1.0;
    audio.muted = false;
    audio.preload = 'auto';

    // Connect to AudioContext for lip-sync analysis
    try {
      const source = ctx.createMediaElementSource(audio);
      source.connect(analyser);
      // analyser is already connected to ctx.destination in getAudioContext()
      console.log('[AvatarView] Audio connected: source → analyser → destination');
    } catch (e) {
      console.warn('[AvatarView] MediaElementSource error:', e.message);
      // If AudioContext connection fails, audio will still play through default output
    }

    audioRef.current = audio;
    setCurrentText(text || '');
    setIsSpeaking(true);

    // Attempt playback
    audio.play().then(() => {
      console.log('[AvatarView] ✅ Audio playback started successfully');
    }).catch(err => {
      console.warn('[AvatarView] ❌ Audio play failed, retrying in 300ms:', err.message);
      // Retry after short delay — sometimes mobile needs a moment
      setTimeout(() => {
        audio.play().then(() => {
          console.log('[AvatarView] ✅ Audio retry succeeded');
        }).catch(err2 => {
          console.error('[AvatarView] ❌ Audio retry also failed:', err2.message);
          setIsSpeaking(false);
          notifyMobile('SPEECH_ENDED');
        });
      }, 300);
    });

    audio.onended = () => {
      console.log('[AvatarView] Audio ended → sending SPEECH_ENDED');
      setIsSpeaking(false);
      notifyMobile('SPEECH_ENDED');
    };

    audio.onerror = (e) => {
      console.error('[AvatarView] Audio error:', audio.error?.message || e);
      setIsSpeaking(false);
      notifyMobile('SPEECH_ENDED');
    };
  }

  // Listen for postMessage from React Native
  // CRITICAL: Android WebView fires on `document`, iOS/web on `window` — must listen to BOTH
  useEffect(() => {
    function handleMessage(event) {
      let data;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch (e) {
        console.warn('[AvatarView] Parse error:', e);
        return;
      }

      // Skip non-object or missing type
      if (!data || !data.type) return;

      console.log('[AvatarView] RECEIVED message:', data.type);

      if (data.type === 'PLAY_AUDIO') {
        playAvatarSpeech(data.audioUrl, data.text);
      }
    }

    // CRITICAL: Both listeners needed for Android + iOS WebView compatibility
    window.addEventListener('message', handleMessage);
    document.addEventListener('message', handleMessage);
    console.log('[AvatarView] Message listeners registered (window + document)');

    // Pre-initialize AudioContext early
    try { getAudioContext(); } catch (e) {}

    // Notify mobile that avatar is ready
    setTimeout(() => {
      console.log('[AvatarView] Sending AVATAR_READY to mobile');
      notifyMobile('AVATAR_READY');
    }, 1500);

    return () => {
      window.removeEventListener('message', handleMessage);
      document.removeEventListener('message', handleMessage);
    };
  }, []);

  function notifyMobile(type, payload = {}) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...payload }));
    }
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0f0f23', overflow: 'hidden' }}>
      <Leva collapsed hidden />
      <Canvas shadows camera={{ position: [0, 0, 0], fov: 10 }} style={{ width: '100%', height: '100%' }}>
        <Suspense fallback={null}>
          <Scenario
            key={avatarUrl}
            avatarUrl={avatarUrl}
            isSpeaking={isSpeaking}
            isListening={false}
            analyserRef={analyserRef}
            currentText={currentText}
            audioRef={audioRef}
            pipelineStage={null}
          />
        </Suspense>
      </Canvas>
      <Loader />
    </div>
  );
}
