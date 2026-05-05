import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import Constants from 'expo-constants';

const BASE_URL = (Constants.expoConfig?.extra?.apiBaseUrl as string) ?? 'http://localhost:3001';
const PING_URL = `${BASE_URL}/ping`;
const INTERVAL_MS = 13 * 60 * 1000; // 13 min — under Render's 15-min sleep threshold

export function useKeepAlive() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const ping = () => {
    fetch(PING_URL, { method: 'GET' }).catch(() => {});
  };

  const startPing = () => {
    if (intervalRef.current) return;
    ping(); // immediate ping on foreground
    intervalRef.current = setInterval(ping, INTERVAL_MS);
  };

  const stopPing = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    startPing();

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;

      if (next === 'active' && prev !== 'active') startPing();
      if (next !== 'active') stopPing();
    });

    return () => {
      stopPing();
      sub.remove();
    };
  }, []);
}
