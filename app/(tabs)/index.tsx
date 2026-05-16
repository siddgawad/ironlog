import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import api, { streamChat } from '../../api';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import LLMConsentGate, { hasLLMConsent } from '../../components/LLMConsentGate';

const C = {
  bg: '#07080A', surface: '#111318', elevated: '#171A21', border: '#252A33',
  orange: '#FF6A1A', green: '#22C55E', text: '#F8FAFC', textSec: '#A8B0BD', textMuted: '#69717F',
};

type Msg = {
  _id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  streaming?: boolean;
};

export default function ChatScreen() {
  const { user } = useAuthStore();
  const { todayDiet, fetchClientData } = useAppStore();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showConsent, setShowConsent] = useState(false);
  const flatRef = useRef<FlatList<Msg>>(null);

  const scrollToBottom = (animated = true) => {
    setTimeout(() => flatRef.current?.scrollToEnd({ animated }), 50);
  };

  const loadHistory = async () => {
    try {
      const res = await api.get('/conversations?limit=200');
      const loaded: Msg[] = (res.data.messages ?? []).map((m: any) => ({
        _id: m._id, role: m.role, content: m.content, timestamp: m.timestamp,
      }));
      if (loaded.length === 0 && user) {
        loaded.push({
          role: 'assistant',
          content: `Hi ${user.name.split(' ')[0]}! I'm Ashwini's AI nutrition assistant. I can answer questions about your diet plan, suggest Indian meal ideas, or help you understand nutrition labels. What would you like to know?`,
          timestamp: new Date().toISOString(),
        });
      }
      setMessages(loaded);
      setLoadingHistory(false);
      scrollToBottom(false);
    } catch {
      setLoadingHistory(false);
    }
  };

  useEffect(() => { loadHistory(); }, []);
  useFocusEffect(useCallback(() => { fetchClientData(); }, []));

  const startStream = async (text: string) => {
    const userMsg: Msg = { role: 'user', content: text, timestamp: new Date().toISOString() };
    const aiMsg: Msg = { role: 'assistant', content: '', timestamp: new Date().toISOString(), streaming: true };
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setStreaming(true);
    scrollToBottom();

    let fullText = '';

    await streamChat(
      { message: text, planDayId: todayDiet?._id ?? null },
      (delta) => {
        fullText += delta;
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.streaming) next[next.length - 1] = { ...last, content: fullText };
          return next;
        });
        scrollToBottom(false);
      },
      () => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.streaming) next[next.length - 1] = { ...last, content: fullText, streaming: false };
          return next;
        });
        setStreaming(false);
        scrollToBottom();
      },
      (code) => {
        const msg =
          code === 'RATE_LIMIT' ? 'Rate limit reached — please try again in a moment.'
          : code === 'UNAUTHENTICATED' ? 'Session expired. Please log out and back in.'
          : 'Could not reach the nutrition coach. Check your connection.';
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.streaming) next[next.length - 1] = { ...last, content: msg, streaming: false };
          return next;
        });
        setStreaming(false);
      }
    );
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    const consented = await hasLLMConsent();
    if (!consented) { setShowConsent(true); return; }
    setInput('');
    startStream(text);
  };

  if (loadingHistory) {
    return <View style={styles.loading}><ActivityIndicator color={C.orange} size="large" /></View>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}><Text style={styles.avatarText}>AN</Text></View>
          <View>
            <Text style={styles.headerName}>Ashwini's Nutrition Coach</Text>
            <View style={styles.statusRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.headerStatus}>{streaming ? 'typing...' : 'AI-powered · always available'}</Text>
            </View>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(m, i) => m._id ?? `${m.timestamp}-${i}`}
          renderItem={({ item }) => <Bubble msg={item} />}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => scrollToBottom(false)}
          refreshControl={
            <RefreshControl refreshing={false} tintColor={C.orange} onRefresh={loadHistory} />
          }
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your diet, meal ideas, nutrition..."
            placeholderTextColor={C.textMuted}
            multiline
            maxLength={800}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={streaming || !input.trim()}
            style={[styles.sendBtn, (streaming || !input.trim()) && styles.sendBtnDisabled]}
          >
            <Text style={styles.sendText}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {showConsent && (
        <LLMConsentGate
          onGranted={() => { setShowConsent(false); handleSend(); }}
          onDeclined={() => setShowConsent(false)}
        />
      )}
    </SafeAreaView>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
        <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAi]}>
          {msg.content || ' '}
          {msg.streaming && <Text style={{ color: C.orange }}>▋</Text>}
        </Text>
        <Text style={[styles.bubbleTime, isUser ? styles.bubbleTimeUser : styles.bubbleTimeAi]}>
          {formatTime(msg.timestamp)}
        </Text>
      </View>
    </View>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  loading: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.surface,
    backgroundColor: C.bg,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: C.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  headerName: { color: C.text, fontWeight: '700', fontSize: 15 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  headerStatus: { color: C.textMuted, fontSize: 11 },
  list: { padding: 12, paddingBottom: 8 },
  bubbleRow: { marginBottom: 8 },
  bubbleRowLeft: { alignItems: 'flex-start' },
  bubbleRowRight: { alignItems: 'flex-end' },
  bubble: { maxWidth: '82%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: C.orange, borderBottomRightRadius: 4 },
  bubbleAi: { backgroundColor: C.surface, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  bubbleTextUser: { color: '#fff' },
  bubbleTextAi: { color: C.textSec },
  bubbleTime: { fontSize: 10, marginTop: 4 },
  bubbleTimeUser: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  bubbleTimeAi: { color: C.textMuted },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: C.surface, backgroundColor: C.bg,
  },
  input: {
    flex: 1, backgroundColor: C.surface,
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
    color: C.text, fontSize: 15, maxHeight: 120,
  },
  sendBtn: {
    backgroundColor: C.orange, width: 42, height: 42,
    borderRadius: 21, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: C.border },
  sendText: { color: '#fff', fontSize: 22, fontWeight: '700', lineHeight: 24 },
});
