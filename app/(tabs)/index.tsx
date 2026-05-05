import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import api, { streamChat } from '../../api';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import LLMConsentGate, { hasLLMConsent } from '../../components/LLMConsentGate';

const LOG_DATA_RE = /<LOG_DATA>([\s\S]*?)<\/LOG_DATA>/;

type Msg = {
  _id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  streaming?: boolean;
  pendingLog?: any;
};

export default function ChatHome() {
  const { user } = useAuthStore();
  const { todayPlan, fetchProgramState } = useAppStore();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showConsent, setShowConsent] = useState(false);
  const [savingLog, setSavingLog] = useState(false);
  const flatRef = useRef<FlatList<Msg>>(null);

  const scrollToBottom = (animated = true) => {
    setTimeout(() => flatRef.current?.scrollToEnd({ animated }), 50);
  };

  const loadHistory = async () => {
    try {
      const res = await api.get('/conversations?limit=200');
      const loaded: Msg[] = (res.data.messages ?? []).map((m: any) => ({
        _id: m._id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      }));

      if (loaded.length === 0 && user) {
        const greeting = todayPlan
          ? `Hey ${user.name}. ${todayPlan.dayType === 'rest' ? 'Rest day today — recover well.' : `Today is ${todayPlan.dayType} day. Hit me up when you're done with the session.`}`
          : `Hey ${user.name}. Tell me what you want to train and I'll help you plan it.`;
        loaded.push({
          role: 'assistant',
          content: greeting,
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

  useFocusEffect(useCallback(() => { fetchProgramState(); }, []));

  const startStream = async (text: string) => {
    const userMsg: Msg = {
      role: 'user', content: text,
      timestamp: new Date().toISOString(),
    };
    const aiMsg: Msg = {
      role: 'assistant', content: '',
      timestamp: new Date().toISOString(),
      streaming: true,
    };
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setStreaming(true);
    scrollToBottom();

    let fullText = '';

    await streamChat(
      { message: text, planDayId: todayPlan?._id ?? null },
      (delta) => {
        fullText += delta;
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.streaming) {
            next[next.length - 1] = { ...last, content: fullText };
          }
          return next;
        });
        scrollToBottom(false);
      },
      () => {
        const match = LOG_DATA_RE.exec(fullText);
        let pendingLog = null;
        if (match) {
          try { pendingLog = JSON.parse(match[1].trim()); } catch {}
        }
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.streaming) {
            next[next.length - 1] = {
              ...last,
              content: fullText.replace(LOG_DATA_RE, '').trim(),
              streaming: false,
              pendingLog,
            };
          }
          return next;
        });
        setStreaming(false);
        scrollToBottom();
      },
      (code) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.streaming) {
            next[next.length - 1] = {
              ...last,
              content: code === 'RATE_LIMIT'
                ? '⚠️ Rate limit reached. Try again in a moment.'
                : code === 'UNAUTHENTICATED'
                ? '⚠️ Session expired. Please log out and back in.'
                : '⚠️ Could not reach the coach. Try again.',
              streaming: false,
            };
          }
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
    if (!consented) {
      setShowConsent(true);
      return;
    }

    setInput('');
    startStream(text);
  };

  const confirmLog = async (msg: Msg) => {
    if (!msg.pendingLog || !todayPlan?._id) return;
    setSavingLog(true);
    try {
      await api.post('/log', {
        planDayId: todayPlan._id,
        extractedData: msg.pendingLog,
        sessionType: msg.pendingLog.sessionType,
      });
      // Remove pendingLog from the message and add a success line
      setMessages((prev) => prev.map((m) => m === msg ? { ...m, pendingLog: undefined } : m));
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: '✓ Session saved.',
        timestamp: new Date().toISOString(),
      }]);
      await fetchProgramState();
    } catch {
      Alert.alert('Save failed', 'Could not save the session. Try again.');
    } finally {
      setSavingLog(false);
    }
  };

  if (loadingHistory) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#f97316" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}><Text style={styles.avatarText}>IL</Text></View>
          <View>
            <Text style={styles.headerName}>IronLog Coach</Text>
            <Text style={styles.headerStatus}>
              {streaming ? 'typing...' : 'always here'}
            </Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(m, i) => m._id ?? `${m.timestamp}-${i}`}
          renderItem={({ item }) => (
            <Bubble msg={item} onConfirmLog={() => confirmLog(item)} savingLog={savingLog} />
          )}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => scrollToBottom(false)}
          refreshControl={
            <RefreshControl
              refreshing={false}
              tintColor="#f97316"
              onRefresh={loadHistory}
            />
          }
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Message IronLog..."
            placeholderTextColor="#52525b"
            multiline
            maxLength={1000}
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

function Bubble({ msg, onConfirmLog, savingLog }: { msg: Msg; onConfirmLog: () => void; savingLog: boolean }) {
  const isUser = msg.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
        <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAi]}>
          {msg.content || ' '}
          {msg.streaming && <Text style={{ color: '#f97316' }}>▋</Text>}
        </Text>
        <Text style={[styles.bubbleTime, isUser ? styles.bubbleTimeUser : styles.bubbleTimeAi]}>
          {formatTime(msg.timestamp)}
        </Text>
      </View>

      {msg.pendingLog && !isUser && (
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>SESSION SUMMARY</Text>
          <ConfirmRows data={msg.pendingLog} />
          <TouchableOpacity
            onPress={onConfirmLog}
            disabled={savingLog}
            style={[styles.confirmBtn, savingLog && { opacity: 0.5 }]}
          >
            {savingLog
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.confirmBtnText}>Save Session</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function ConfirmRows({ data }: { data: any }) {
  const rows: { k: string; v: string }[] = [];
  if (data.bench?.loadLb) {
    rows.push({
      k: 'Bench',
      v: `${data.bench.loadLb}lb · ${data.bench.setsCompleted}×${data.bench.repsPerSet?.[0] ?? '?'} · RPE ${data.bench.rpeReported ?? '?'}`,
    });
  }
  if (data.squat?.loadLb) {
    rows.push({
      k: 'Squat',
      v: `${data.squat.loadLb}lb · headache ${data.squat.headacheGrade}`,
    });
  }
  if (data.deadlift?.loadLb) {
    rows.push({
      k: 'Deadlift',
      v: `${data.deadlift.loadLb}lb · RPE ${data.deadlift.rpeReported ?? '?'}`,
    });
  }
  if (data.generalFeeling) rows.push({ k: 'Feeling', v: data.generalFeeling });
  if (data.painFlags && Object.values(data.painFlags).some(Boolean)) {
    const pains = Object.entries(data.painFlags).filter(([, v]) => v).map(([k]) => k).join(', ');
    rows.push({ k: 'Pain', v: pains });
  }
  return (
    <View style={{ marginBottom: 10 }}>
      {rows.map((r) => (
        <View key={r.k} style={styles.confirmRow}>
          <Text style={styles.confirmK}>{r.k}</Text>
          <Text style={styles.confirmV}>{r.v}</Text>
        </View>
      ))}
    </View>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09090b' },
  loading: { flex: 1, backgroundColor: '#09090b', alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#18181b',
    backgroundColor: '#0a0a0a',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#f97316',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  headerName: { color: '#f4f4f5', fontWeight: '700', fontSize: 15 },
  headerStatus: { color: '#71717a', fontSize: 11, marginTop: 1 },
  list: { padding: 12, paddingBottom: 8 },
  bubbleRow: { marginBottom: 8 },
  bubbleRowLeft: { alignItems: 'flex-start' },
  bubbleRowRight: { alignItems: 'flex-end' },
  bubble: { maxWidth: '82%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleUser: { backgroundColor: '#f97316', borderBottomRightRadius: 4 },
  bubbleAi: { backgroundColor: '#1f1f23', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTextUser: { color: '#fff' },
  bubbleTextAi: { color: '#e4e4e7' },
  bubbleTime: { fontSize: 10, marginTop: 4 },
  bubbleTimeUser: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  bubbleTimeAi: { color: '#52525b' },
  confirmCard: {
    marginTop: 8, marginLeft: 4,
    backgroundColor: '#0c0c0d', borderWidth: 1, borderColor: '#3f3f46',
    borderRadius: 14, padding: 14, maxWidth: '82%',
  },
  confirmTitle: {
    fontSize: 10, color: '#71717a', fontWeight: '700',
    letterSpacing: 1.5, marginBottom: 10,
  },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  confirmK: { fontSize: 12, color: '#71717a' },
  confirmV: { fontSize: 12, color: '#e4e4e7', flex: 1, textAlign: 'right' },
  confirmBtn: {
    backgroundColor: '#f97316', borderRadius: 10, padding: 11, alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#18181b',
    backgroundColor: '#0a0a0a',
  },
  input: {
    flex: 1, backgroundColor: '#1f1f23', borderWidth: 0,
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
    color: '#f4f4f5', fontSize: 15, maxHeight: 120,
  },
  sendBtn: {
    backgroundColor: '#f97316', width: 42, height: 42,
    borderRadius: 21, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#3f3f46' },
  sendText: { color: '#fff', fontSize: 22, fontWeight: '700', lineHeight: 24 },
});
