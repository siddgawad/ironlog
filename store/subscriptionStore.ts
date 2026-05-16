// Booking / consultation status store
import { create } from 'zustand';
import api from '../api';

export type BookingStatus = 'none' | 'pending' | 'confirmed' | 'active' | 'completed';

type BookingStore = {
  status: BookingStatus;
  consultationType: string | null;
  nextCheckInDate: string | null;
  loading: boolean;
  fetchBookingStatus: () => Promise<void>;
};

export const useBookingStore = create<BookingStore>((set) => ({
  status: 'none',
  consultationType: null,
  nextCheckInDate: null,
  loading: false,

  fetchBookingStatus: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/booking/status');
      set({
        status: res.data.status ?? 'none',
        consultationType: res.data.consultationType ?? null,
        nextCheckInDate: res.data.nextCheckInDate ?? null,
      });
    } catch {
      // Fail silently
    } finally {
      set({ loading: false });
    }
  },
}));
