import axios from 'axios';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL =
  (Constants.expoConfig?.extra?.apiBaseUrl as string) ?? 'http://localhost:3001';

const TOKEN_KEY = 'ironlog_auth_token';
const OFFLINE_QUEUE_KEY = 'ironlog_offline_queue';

const api = axios.create({ baseURL: `${BASE_URL}/api`, timeout: 20000 });

let cachedToken: string | null = null;

export async function loadToken(): Promise<string | null> {
  if (cachedToken !== null) return cachedToken;
  const t = await AsyncStorage.getItem(TOKEN_KEY);
  cachedToken = t;
  return t;
}

export async function saveToken(token: string): Promise<void> {
  cachedToken = token;
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  cachedToken = null;
  await AsyncStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use(async (config) => {
  const token = await loadToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

// ── Typed API wrappers ────────────────────────────────────────────────────────

export type ProgressPoint = { date: string; e1rm: number; loadLb: number; reps: number };
export type ProgressData = { lift: string; points: ProgressPoint[] };

export async function getProgress(
  lift: string,
  from?: string,
  to?: string
): Promise<ProgressData> {
  const params: Record<string, string> = { lift };
  if (from) params.from = from;
  if (to) params.to = to;
  const res = await api.get('/progress', { params });
  return res.data;
}

export async function getSubscriptionStatus(): Promise<{ isPro: boolean; expiresAt: string | null }> {
  const res = await api.get('/subscription/status');
  return res.data;
}

export async function requestReplan(
  reason: string,
  missedPlanIds?: string[]
): Promise<{ diffToken: string; diff: any }> {
  const res = await api.post('/replan', { reason, missedPlanIds: missedPlanIds ?? [] });
  return res.data;
}

export async function confirmReplan(diffToken: string): Promise<void> {
  await api.post('/replan/confirm', { diffToken });
}

// ── Offline chat queue ────────────────────────────────────────────────────────

type QueuedMessage = { text: string; planDayId: string | null; timestamp: string };

export async function queueOfflineMessage(text: string, planDayId: string | null): Promise<void> {
  const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
  const queue: QueuedMessage[] = raw ? JSON.parse(raw) : [];
  queue.push({ text, planDayId, timestamp: new Date().toISOString() });
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export async function getOfflineQueue(): Promise<QueuedMessage[]> {
  const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function clearOfflineQueue(): Promise<void> {
  await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
}

// ── Chat stream ───────────────────────────────────────────────────────────────

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export async function streamChat(
  payload: { message: string; planDayId?: string | null },
  onDelta: (delta: string) => void,
  onDone: () => void,
  onError: (code: string) => void
): Promise<void> {
  const url = `${BASE_URL}/api/chat`;
  const token = await loadToken();
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 401) { onError('UNAUTHENTICATED'); return; }
    if (response.status === 429) { onError('RATE_LIMIT'); return; }
    if (!response.ok) { onError('AI_UNAVAILABLE'); return; }

    const reader = response.body?.getReader();
    if (!reader) { onError('AI_UNAVAILABLE'); return; }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') { onDone(); return; }
        try {
          const parsed = JSON.parse(data);
          if (parsed.delta) onDelta(parsed.delta);
          if (parsed.error) onError(parsed.error);
        } catch {}
      }
    }
    onDone();
  } catch {
    onError('NETWORK_ERROR');
  }
}
