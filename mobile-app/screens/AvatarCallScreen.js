import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Audio } from 'expo-av';
import { createWebSocket } from '../../shared/services/ws';
import { sendAudioForSTT, runPipeline } from '../../shared/services/api';
import { STAGE_LABELS, getWebClientUrl, getApiUrl } from '../../shared/config/constants';

/**
 * AvatarCallScreen — Voice + 3D avatar via WebView.
 *
 * Architecture:
 * - WebView renders 3D avatar + handles ALL audio playback + lip-sync
 * - Mobile sends postMessage to WebView to trigger audio
 * - WebView sends postMessage back when speech ends
 * - Mobile handles voice recording (expo-av) and sends to STT
 *
 * ❌ Mobile does NOT play TTS audio — WebView controls everything
 */
export default function AvatarCallScreen({ route }) {
  const { avatar, userId, broadcast } = route.params;
  const webviewRef = useRef(null);
  const wsRef = useRef(null);
  const recordingRef = useRef(null);
  const failsafeTimerRef = useRef(null);
  const messageQueueRef = useRef([]);
  const webViewReadyRef = useRef(false);

  const [pipelineStage, setPipelineStage] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [mode, setMode] = useState(broadcast ? 'broadcast' : 'conversation');
  const [currentBroadcast, setCurrentBroadcast] = useState(broadcast || null);
  const [isConnected, setIsConnected] = useState(false);
  const [webViewReady, setWebViewReady] = useState(false);

  const webClientUrl = getWebClientUrl();
  const apiBaseUrl = getApiUrl();

  // ─── Failsafe: Auto-reset stuck states ───
  function startFailsafeTimer() {
    clearFailsafeTimer();
    failsafeTimerRef.current = setTimeout(() => {
      console.warn('[Failsafe] Resetting stuck state after 15s');
      setIsSpeaking(false);
      setIsProcessing(false);
      setPipelineStage(null);
    }, 15000);
  }

  function clearFailsafeTimer() {
    if (failsafeTimerRef.current) {
      clearTimeout(failsafeTimerRef.current);
      failsafeTimerRef.current = null;
    }
  }

  // Cleanup failsafe timer on unmount
  useEffect(() => {
    return () => clearFailsafeTimer();
  }, []);

  // ─── WebSocket Connection ───
  useEffect(() => {
    console.log('[Mobile] Setting up WebSocket connection for user:', userId);
    const ws = createWebSocket(userId, {
      onConnect: () => {
        console.log('[Mobile] WebSocket connected');
        setIsConnected(true);
      },
      onDisconnect: () => {
        console.log('[Mobile] WebSocket disconnected');
        setIsConnected(false);
      },
      onStatus: (data) => {
        console.log('[Mobile] Pipeline status:', data.stage);
        setPipelineStage(data.stage);
      },
      onResponse: (data) => {
        console.log('[Mobile] Response received:', data.response?.substring(0, 50) + '...');
        setPipelineStage(null);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.response,
          time: new Date().toLocaleTimeString(),
        }]);
        // Send audio to WebView for playback + lip-sync
        if (data.audio_url) {
          const fullUrl = `${apiBaseUrl}${data.audio_url}`;
          console.log('[Mobile] Sending PLAY_AUDIO to WebView:', fullUrl);
          sendToWebView('PLAY_AUDIO', {
            audioUrl: fullUrl,
            text: data.response,
          });
          setIsSpeaking(true);
          startFailsafeTimer();
        } else {
          // No audio — reset processing immediately
          console.log('[Mobile] No audio URL, resetting processing state');
          setIsProcessing(false);
        }
      },
      onBroadcastNotification: (data) => {
        const bc = data.broadcast;
        Alert.alert(
          '📢 New Broadcast',
          `${bc.avatarId}: ${bc.title}`,
          [
            { text: 'Dismiss', style: 'cancel' },
            { text: 'Watch', onPress: () => watchBroadcast(bc) },
          ]
        );
      },
      onBroadcastAudio: (data) => {
        console.log('[Mobile] Broadcast audio received');
        setPipelineStage(null);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.text || data.originalText || '',
          time: new Date().toLocaleTimeString(),
          isBroadcast: true,
        }]);
        if (data.audio_url) {
          const fullUrl = `${apiBaseUrl}${data.audio_url}`;
          console.log('[Mobile] Sending broadcast PLAY_AUDIO to WebView:', fullUrl);
          sendToWebView('PLAY_AUDIO', {
            audioUrl: fullUrl,
            text: data.text,
          });
          setIsSpeaking(true);
          startFailsafeTimer();
        }
      },
      onError: (data) => {
        console.warn('[Mobile] WS Error:', data.error);
        setPipelineStage(null);
        setIsProcessing(false);
      },
    });

    wsRef.current = ws;
    return () => ws.close();
  }, [userId]);

  // ─── Trigger broadcast playback on mount if broadcast mode ───
  useEffect(() => {
    if (broadcast && wsRef.current) {
      setTimeout(() => {
        watchBroadcast(broadcast);
      }, 2000); // Wait for WebView to load
    }
  }, [broadcast]);

  // ─── WebView ↔ Mobile Bridge ───

  function flushMessageQueue() {
    if (!webViewReadyRef.current || !webviewRef.current) return;
    while (messageQueueRef.current.length > 0) {
      const msg = messageQueueRef.current.shift();
      console.log('[Mobile] Flushing queued message:', msg.substring(0, 50));
      webviewRef.current.postMessage(msg);
    }
  }

  function sendToWebView(type, payload = {}) {
    const msg = JSON.stringify({ type, ...payload });
    if (webViewReadyRef.current && webviewRef.current) {
      console.log('[Mobile] postMessage to WebView:', type);
      webviewRef.current.postMessage(msg);
    } else {
      console.log('[Mobile] WebView not ready, queuing message:', type);
      messageQueueRef.current.push(msg);
    }
  }

  function handleWebViewLoad() {
    console.log('[Mobile] WebView onLoad fired');
    // Don't set ready yet — wait for AVATAR_READY from the React app inside
  }

  function handleWebViewMessage(event) {
    let data;
    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch (e) {
      console.warn('[Mobile] Invalid WebView message:', e);
      return;
    }

    console.log('[Mobile] Received from WebView:', data.type);

    switch (data.type) {
      case 'SPEECH_ENDED':
        console.log('[Mobile] TTS finished → ready for next input');
        clearFailsafeTimer();
        setIsSpeaking(false);
        setIsProcessing(false);
        setPipelineStage(null);
        // After broadcast ends, switch to Q&A mode
        if (mode === 'broadcast') {
          setMode('conversation');
        }
        break;
      case 'AVATAR_READY':
        console.log('[Mobile] Avatar loaded in WebView → bridge ready');
        webViewReadyRef.current = true;
        setWebViewReady(true);
        flushMessageQueue();
        break;
      case 'ERROR':
        console.warn('[Mobile] WebView Error:', data.error);
        clearFailsafeTimer();
        setIsSpeaking(false);
        setIsProcessing(false);
        setPipelineStage(null);
        break;
    }
  }

  // ─── Watch Broadcast via WebSocket ───
  function watchBroadcast(bc) {
    setCurrentBroadcast(bc);
    setMode('broadcast');
    setPipelineStage('preparing_broadcast');
    setIsProcessing(true);
    setMessages(prev => [...prev, {
      role: 'system',
      content: `📺 Broadcast: "${bc.title}"`,
      time: new Date().toLocaleTimeString(),
    }]);
    wsRef.current?.sendBroadcastWatch({
      broadcastId: bc.id,
      language: 'en',
      gender: avatar.gender || 'male',
    });
    startFailsafeTimer();
  }

  // ─── Voice Recording (expo-av) — Only used for mic input, NOT TTS ───

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
    };
  }, []);

  async function startRecording() {
    // Echo prevention: block if avatar is speaking or processing
    if (isSpeaking || isProcessing || mode === 'broadcast') {
      console.log('[Mobile] Blocked mic — avatar speaking or processing');
      return;
    }
    if (isRecording) {
      console.log('[Mobile] Already recording, ignoring');
      return;
    }

    try {
      // 🔥 CRITICAL: Clean previous recording first
      if (recordingRef.current) {
        console.log('[Mobile] Cleaning previous recording');
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch (e) {}
        recordingRef.current = null;
      }

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Microphone access is required');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);
      setPipelineStage('listening');
      console.log('[Mobile] Recording started');
    } catch (err) {
      console.error('[Mobile] Recording start failed:', err);
      recordingRef.current = null;
      setIsRecording(false);
      Alert.alert('Error', 'Could not start recording');
    }
  }

  async function stopRecording() {
    if (!recordingRef.current || !isRecording) return;
    try {
      const recording = recordingRef.current;
      setIsRecording(false);
      setPipelineStage('processing');
      setIsProcessing(true);

      console.log('[Mobile] Stopping recording...');
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null; // 🔥 IMPORTANT: reset ref immediately

      console.log('[Mobile] Recording stopped, URI:', uri);

      if (!uri) {
        setPipelineStage(null);
        setIsProcessing(false);
        return;
      }

      // Send URI directly — sendAudioForSTT handles RN FormData format
      console.log('[Mobile] Sending audio to STT...');
      const sttResult = await sendAudioForSTT(uri, 'recording.m4a');
      console.log('[Mobile] STT response:', JSON.stringify(sttResult).substring(0, 150));

      if (sttResult.success && sttResult.data?.text) {
        const userText = sttResult.data.text;
        console.log('[Mobile] STT result:', userText);
        setMessages(prev => [...prev, {
          role: 'user',
          content: userText,
          time: new Date().toLocaleTimeString(),
        }]);
        // Send to LLM via WebSocket
        sendTextViaWs(userText);
      } else {
        setPipelineStage(null);
        setIsProcessing(false);
        Alert.alert('STT Error', sttResult.error || 'Could not transcribe');
      }
    } catch (err) {
      recordingRef.current = null;
      setPipelineStage(null);
      setIsProcessing(false);
      console.error('[Mobile] Recording stop failed:', err);
    }
  }

  // ─── Send Text to LLM ───
  function sendTextViaWs(text) {
    if (!text.trim()) return;
    console.log('[Mobile] Sending message:', text.substring(0, 50));
    setPipelineStage('thinking');
    setIsProcessing(true);

    const history = [];
    // Inject custom avatar context as system prompt
    if (avatar.description) {
      history.push({ role: 'system', content: `You are ${avatar.name}. ${avatar.description}` });
    } else if (avatar.personality) {
      history.push({ role: 'system', content: avatar.personality });
    }
    if (currentBroadcast) {
      history.push({
        role: 'system',
        content: `The user just watched a broadcast: "${currentBroadcast.message}". Answer questions in this context.`,
      });
    }
    messages.slice(-8).forEach(m => {
      if (m.role !== 'system') history.push({ role: m.role, content: m.content });
    });

    const avatarGender = avatar.avatarGender || avatar.voice || avatar.gender || 'male';
    console.log('[Mobile] Avatar gender:', avatarGender);

    const sent = wsRef.current?.sendTextMessage({
      message: text.trim(),
      language: 'en',
      history,
      gender: avatarGender,
    });

    if (!sent) {
      console.warn('[Mobile] Failed to send message via WebSocket');
      setIsProcessing(false);
      setPipelineStage(null);
      Alert.alert('Connection Error', 'Could not send message. Please try again.');
    } else {
      startFailsafeTimer();
    }
  }

  function sendTextMessage() {
    if (!textInput.trim() || isSpeaking || isProcessing) return;
    console.log('[Mobile] User sending text message');
    setMessages(prev => [...prev, {
      role: 'user',
      content: textInput.trim(),
      time: new Date().toLocaleTimeString(),
    }]);
    sendTextViaWs(textInput.trim());
    setTextInput('');
  }

  // ─── NO injectedJS needed ───
  // AvatarView.jsx already listens for postMessage('PLAY_AUDIO')
  // and handles audio playback + lip-sync + sends SPEECH_ENDED back.

  const stageLabel = pipelineStage ? (STAGE_LABELS[pipelineStage] || pipelineStage) : null;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Mode Label */}
      {mode === 'broadcast' && (
        <View style={styles.modeBar}>
          <Text style={styles.modeLabelText}>📺 Broadcast Mode</Text>
        </View>
      )}
      {mode === 'conversation' && currentBroadcast && (
        <View style={[styles.modeBar, styles.qaBar]}>
          <Text style={[styles.modeLabelText, styles.qaText]}>💬 Q&A Mode — {currentBroadcast.title}</Text>
        </View>
      )}

      {/* WebView (3D Avatar) — Controls ALL audio + lip-sync */}
      <View style={styles.webviewContainer}>
        <WebView
          ref={webviewRef}
          source={{ uri: `${webClientUrl}/avatar-view?avatar=${avatar.id}&gender=${avatar.gender || 'male'}` }}
          style={styles.webview}
          onLoad={handleWebViewLoad}
          onMessage={handleWebViewMessage}
          javaScriptEnabled={true}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          allowFileAccess={true}
          mixedContentMode="always"
          originWhitelist={['*']}
        />

        {/* Pipeline Status Overlay */}
        {stageLabel && (
          <View style={styles.stageOverlay}>
            <View style={styles.stagePill}>
              <View style={styles.stageDot} />
              <Text style={styles.stageText}>{stageLabel}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Chat Messages */}
      <ScrollView style={styles.chatContainer} contentContainerStyle={styles.chatContent}>
        {messages.map((msg, i) => (
          <View key={i} style={[styles.msgBubble, msg.role === 'user' ? styles.userBubble : msg.role === 'system' ? styles.sysBubble : styles.aiBubble]}>
            <Text style={[styles.msgText, msg.role === 'user' ? styles.userText : msg.role === 'system' ? styles.sysText : styles.aiText]}>
              {msg.content}
            </Text>
            <Text style={styles.msgTime}>{msg.time}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Control Bar */}
      <View style={styles.controlBar}>
        {/* Mic Button */}
        <TouchableOpacity
          style={[styles.micBtn, isRecording && styles.micBtnActive, (isSpeaking || isProcessing || mode === 'broadcast') && styles.micBtnDisabled]}
          onPressIn={startRecording}
          onPressOut={stopRecording}
          disabled={isSpeaking || isProcessing || mode === 'broadcast'}
        >
          <Text style={styles.micBtnText}>{isRecording ? '🔴' : '🎤'}</Text>
        </TouchableOpacity>

        {/* Text Input */}
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.textField}
            value={textInput}
            onChangeText={setTextInput}
            placeholder={currentBroadcast ? `Ask about "${currentBroadcast.title}"…` : 'Type a message…'}
            placeholderTextColor="#6B7280"
            editable={!isSpeaking && !isProcessing && mode !== 'broadcast'}
            returnKeyType="send"
            onSubmitEditing={sendTextMessage}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendTextMessage} disabled={!textInput.trim() || isSpeaking || isProcessing}>
            <Text style={[styles.sendBtnText, (!textInput.trim() || isSpeaking || isProcessing) && { opacity: 0.3 }]}>➤</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Connection indicator */}
      {!isConnected && (
        <View style={styles.disconnected}>
          <Text style={styles.disconnectedText}>⚠ Connecting…</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },

  modeBar: {
    backgroundColor: 'rgba(255,122,0,0.15)', paddingVertical: 6, paddingHorizontal: 16,
    alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,122,0,0.3)',
  },
  qaBar: { backgroundColor: 'rgba(19,136,8,0.1)', borderBottomColor: 'rgba(19,136,8,0.2)' },
  modeLabelText: { fontSize: 11, fontWeight: '700', color: '#FF7A00', textTransform: 'uppercase', letterSpacing: 0.5 },
  qaText: { color: '#138808' },

  webviewContainer: { height: 280, position: 'relative' },
  webview: { flex: 1, backgroundColor: '#0f0f23' },

  stageOverlay: {
    position: 'absolute', bottom: 12, alignSelf: 'center',
  },
  stagePill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.7)', paddingVertical: 6, paddingHorizontal: 16,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,122,0,0.3)',
  },
  stageDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF7A00' },
  stageText: { fontSize: 11, fontWeight: '600', color: '#FF7A00', textTransform: 'uppercase', letterSpacing: 0.5 },

  chatContainer: { flex: 1 },
  chatContent: { padding: 12, gap: 8 },
  msgBubble: { maxWidth: '85%', padding: 12, borderRadius: 14 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#FF7A00', borderBottomRightRadius: 4 },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: '#1a1a2e', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  sysBubble: {
    alignSelf: 'center', backgroundColor: 'rgba(255,122,0,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,122,0,0.2)', borderRadius: 10,
  },
  msgText: { fontSize: 14, lineHeight: 20 },
  userText: { color: '#fff' },
  aiText: { color: '#E5E7EB' },
  sysText: { color: '#FF7A00', fontWeight: '600', textAlign: 'center', fontSize: 12 },
  msgTime: { fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 4 },

  controlBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#1a1a2e', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  micBtn: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#3c4043',
    alignItems: 'center', justifyContent: 'center',
  },
  micBtnActive: { backgroundColor: '#ea4335' },
  micBtnDisabled: { opacity: 0.3 },
  micBtnText: { fontSize: 22 },

  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  textField: { flex: 1, color: '#fff', paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  sendBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  sendBtnText: { fontSize: 18, color: '#FF7A00' },

  disconnected: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: 'rgba(198,40,40,0.9)', paddingVertical: 4, alignItems: 'center',
  },
  disconnectedText: { fontSize: 11, color: '#fff', fontWeight: '600' },
});
