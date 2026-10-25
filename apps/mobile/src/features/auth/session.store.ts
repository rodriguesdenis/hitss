import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

type SessionState = {
  expired: boolean;
  signingOut: boolean;
  markExpired: () => void;
  clearExpired: () => void;
  setSigningOut: (signingOut: boolean) => void;
};

export const useSessionStore = create<SessionState>()(
  immer((set) => ({
    expired: false,
    signingOut: false,
    markExpired: () =>
      set((state) => {
        state.expired = true;
      }),
    clearExpired: () =>
      set((state) => {
        state.expired = false;
      }),
    setSigningOut: (signingOut) =>
      set((state) => {
        state.signingOut = signingOut;
      }),
  })),
);
