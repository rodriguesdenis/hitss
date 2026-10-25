import { onlineManager, type QueryClient } from '@tanstack/react-query';
import type { Persister } from '@tanstack/react-query-persist-client';

import { asyncStorage, type StorageAdapter } from '@/lib/storage';

import { appCacheBuster } from './config';
import { endSyncSession } from './durable-mutation';
import { startNetwork } from './network';
import { createSessionGate, type SessionGate } from './session-gate';
import { createOwnerPersister } from './persister';
import { useSyncStore } from './sync.store';

export type OfflineRuntime = {
  queryClient: QueryClient;
  persister: Persister;
  buster: string;
  purge: () => Promise<void>;
  claim: (userId: string) => Promise<void>;
  start: () => () => void;
  gate: SessionGate;
};

export function createOfflineRuntime({
  queryClient,
  storage = asyncStorage,
  buster = appCacheBuster(),
  getSessionUserId = async () => null,
  onSessionLost = () => undefined,
  throttleTime,
}: {
  queryClient: QueryClient;
  storage?: StorageAdapter;
  buster?: string;
  getSessionUserId?: () => Promise<string | null>;
  onSessionLost?: () => void;
  throttleTime?: number;
}): OfflineRuntime {
  const persister = createOwnerPersister({
    storage,
    getOwnerId: () => useSyncStore.getState().ownerId,
    throttleTime,
  });

  const purge = async () => {
    endSyncSession(queryClient);
    queryClient.getMutationCache().clear();
    queryClient.clear();
    await persister.removeClient();
    useSyncStore.getState().reset();
  };

  const claim = async (userId: string) => {
    if (useSyncStore.getState().ownerId === userId) {
      return;
    }
    await purge();
    useSyncStore.getState().setOwner(userId);
  };

  const start = () => {
    const stopNetwork = startNetwork();
    const stopReconnect = onlineManager.subscribe((online) => {
      if (online) {
        void queryClient
          .resumePausedMutations()
          .then(() => queryClient.invalidateQueries());
      }
    });
    return () => {
      stopReconnect();
      stopNetwork();
    };
  };

  const gate = createSessionGate({ getSessionUserId, claim, onSessionLost });

  return { queryClient, persister, buster, purge, claim, start, gate };
}
