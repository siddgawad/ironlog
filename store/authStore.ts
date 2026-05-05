import { create } from 'zustand';
import api, { saveToken, clearToken, loadToken } from '../api';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  onboardingComplete: boolean;
};

type AuthStore = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setOnboardingComplete: () => Promise<void>;
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  loading: true,
  error: null,

  hydrate: async () => {
    const token = await loadToken();
    if (!token) {
      set({ loading: false, user: null });
      return;
    }
    try {
      const res = await api.get('/auth/me');
      set({
        user: {
          id: res.data._id,
          email: res.data.email,
          name: res.data.name,
          onboardingComplete: res.data.onboardingComplete,
        },
        loading: false,
      });
    } catch {
      await clearToken();
      set({ loading: false, user: null });
    }
  },

  signup: async (email, password, name) => {
    set({ error: null, loading: true });
    try {
      const res = await api.post('/auth/signup', { email, password, name });
      await saveToken(res.data.token);
      set({ user: res.data.user, loading: false });
      return true;
    } catch (e: any) {
      set({
        loading: false,
        error: e?.response?.data?.error ?? 'SIGNUP_FAILED',
      });
      return false;
    }
  },

  login: async (email, password) => {
    set({ error: null, loading: true });
    try {
      const res = await api.post('/auth/login', { email, password });
      await saveToken(res.data.token);
      set({ user: res.data.user, loading: false });
      return true;
    } catch (e: any) {
      set({
        loading: false,
        error: e?.response?.data?.error ?? 'LOGIN_FAILED',
      });
      return false;
    }
  },

  logout: async () => {
    await clearToken();
    set({ user: null, error: null });
  },

  refreshUser: async () => {
    try {
      const res = await api.get('/auth/me');
      set({
        user: {
          id: res.data._id,
          email: res.data.email,
          name: res.data.name,
          onboardingComplete: res.data.onboardingComplete,
        },
      });
    } catch {}
  },

  setOnboardingComplete: async () => {
    try {
      await api.post('/auth/onboarding-complete');
      const u = get().user;
      if (u) set({ user: { ...u, onboardingComplete: true } });
    } catch {}
  },
}));
