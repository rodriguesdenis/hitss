import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

type SessionNoticeState = {
  expired: boolean;
  markExpired: () => void;
  clear: () => void;
};

export const useSessionNotice = create<SessionNoticeState>()(
  immer((set) => ({
    expired: false,
    markExpired: () =>
      set((state) => {
        state.expired = true;
      }),
    clear: () =>
      set((state) => {
        state.expired = false;
      }),
  })),
);
