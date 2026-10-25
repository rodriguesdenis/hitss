import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import { asyncStorage } from '@/lib/storage';

export const SYNC_STORE_KEY = 'sync.store';

export type SyncSummary = { synced: number; discarded: number; at: number };

type SyncData = {
  ownerId: string | null;
  idMap: Record<string, string>;
  failedTmpIds: string[];
  lastSyncSummary: SyncSummary | null;
};

type SyncState = SyncData & {
  setOwner: (ownerId: string | null) => void;
  mapId: (tempId: string, realId: string) => void;
  failTempId: (tempId: string) => void;
  prune: () => void;
  setSummary: (summary: SyncSummary | null) => void;
  reset: () => void;
};

const initial: SyncData = {
  ownerId: null,
  idMap: {},
  failedTmpIds: [],
  lastSyncSummary: null,
};

export const useSyncStore = create<SyncState>()(
  persist(
    immer((set) => ({
      ...initial,
      setOwner: (ownerId) =>
        set((state) => {
          state.ownerId = ownerId;
        }),
      mapId: (tempId, realId) =>
        set((state) => {
          state.idMap[tempId] = realId;
        }),
      failTempId: (tempId) =>
        set((state) => {
          if (!state.failedTmpIds.includes(tempId)) {
            state.failedTmpIds.push(tempId);
          }
        }),
      prune: () =>
        set((state) => {
          state.idMap = {};
          state.failedTmpIds = [];
        }),
      setSummary: (summary) =>
        set((state) => {
          state.lastSyncSummary = summary;
        }),
      reset: () => set(() => ({ ...initial })),
    })),
    {
      name: SYNC_STORE_KEY,
      storage: createJSONStorage(() => asyncStorage),
      partialize: ({ ownerId, idMap, failedTmpIds, lastSyncSummary }) => ({
        ownerId,
        idMap,
        failedTmpIds,
        lastSyncSummary,
      }),
    },
  ),
);

export function syncStoreReady(): Promise<void> {
  if (useSyncStore.persist.hasHydrated()) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const unsubscribe = useSyncStore.persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });
}

export function useSyncStoreReady(): boolean {
  const [ready, setReady] = useState(() => useSyncStore.persist.hasHydrated());
  useEffect(() => {
    if (!ready) {
      void syncStoreReady().then(() => setReady(true));
    }
  }, [ready]);
  return ready;
}
