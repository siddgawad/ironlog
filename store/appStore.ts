import { create } from 'zustand';
import api from '../api';

export type Exercise = {
  name: string;
  sets: number;
  reps: number;
  loadLb: number;
  rpeTarget?: number;
  restSeconds?: number;
  notes?: string;
  category?: string;
};

export type PlanDay = {
  _id: string;
  dayNumber: number;
  dayType: string;
  exercises: Exercise[];
  isCompleted: boolean;
  scheduledDate: string;
};

export type ProgramState = {
  currentDayIndex: number;
  currentMicrocycle: number;
  startDate: string;
  flags: {
    medicalStop: boolean;
    benchPaused: boolean;
    activeRPEWarning: boolean;
    benchFailedThisMicrocycle: boolean;
    elbowPainFlagged: boolean;
    shoulderPainFlagged: boolean;
    squatBlockedUntil?: string;
    consecutiveGrade1Headaches?: number;
  };
};

type AppStore = {
  programState: ProgramState | null;
  todayPlan: PlanDay | null;
  initialized: boolean;
  fetchProgramState: () => Promise<void>;
};

export const useAppStore = create<AppStore>((set) => ({
  programState: null,
  todayPlan: null,
  initialized: false,

  fetchProgramState: async () => {
    try {
      const [stateRes, planRes] = await Promise.all([
        api.get('/state'),
        api.get('/plan/today'),
      ]);
      set({
        programState: stateRes.data,
        todayPlan: planRes.data,
        initialized: true,
      });
    } catch {
      set({ initialized: true });
    }
  },
}));
