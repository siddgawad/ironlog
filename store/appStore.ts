import { create } from 'zustand';
import api from '../api';

// ── Client health profile ─────────────────────────────────────────────────────

export type ClientGoal =
  | 'diabetes'
  | 'pcos'
  | 'weight_loss'
  | 'weight_gain'
  | 'elderly_care'
  | 'cardiac'
  | 'general_wellness'
  | 'npd'; // New Product Development / MSME

export type ConsultMode = 'online' | 'in_person' | 'either';

export type ClientProfile = {
  name: string;
  age?: number;
  gender?: string;
  goal: ClientGoal;
  consultMode: ConsultMode;
  medicalConditions?: string;
  medications?: string;
  onboardingComplete: boolean;
};

// ── Diet plan day ─────────────────────────────────────────────────────────────

export type MealItem = {
  time: string;
  description: string;
  notes?: string;
};

export type DietDay = {
  _id: string;
  date: string;
  meals: MealItem[];
  waterTargetMl: number;
  notes?: string;
  isCompleted: boolean;
};

// ── Progress log ──────────────────────────────────────────────────────────────

export type ProgressLog = {
  _id: string;
  date: string;
  weightKg?: number;
  energyLevel?: number; // 1-5
  adherence?: number;   // 1-5
  notes?: string;
};

// ── Store ─────────────────────────────────────────────────────────────────────

type AppStore = {
  clientProfile: ClientProfile | null;
  todayDiet: DietDay | null;
  recentProgress: ProgressLog[];
  initialized: boolean;
  fetchClientData: () => Promise<void>;
};

export const useAppStore = create<AppStore>((set) => ({
  clientProfile: null,
  todayDiet: null,
  recentProgress: [],
  initialized: false,

  fetchClientData: async () => {
    try {
      const res = await api.get('/auth/me');
      set({
        clientProfile: res.data ?? null,
        initialized: true,
      });
    } catch {
      set({ initialized: true });
    }
  },
}));
