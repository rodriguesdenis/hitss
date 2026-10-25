import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import { onSessionReset } from '@/lib/session-reset';

interface CreatedTeamState {
  teamId?: string;
  offer: (teamId: string) => void;
  clear: () => void;
}

export const useCreatedTeamStore = create<CreatedTeamState>()(
  immer((set) => ({
    teamId: undefined,
    offer: (teamId) =>
      set((state) => {
        state.teamId = teamId;
      }),
    clear: () =>
      set((state) => {
        state.teamId = undefined;
      }),
  })),
);

onSessionReset(() => useCreatedTeamStore.getState().clear());

export function offerCreatedTeam(teamId: string): void {
  useCreatedTeamStore.getState().offer(teamId);
}
