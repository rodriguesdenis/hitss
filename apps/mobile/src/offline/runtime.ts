import type { QueryClient } from '@tanstack/react-query';
import type { Persister } from '@tanstack/react-query-persist-client';

import { asyncStorage, type StorageAdapter } from '@/lib/storage';

import { appCacheBuster } from './config';
import { createOwnerPersister } from './persister';
import { useSyncStore } from './sync.store';

export type OfflineRuntime = {
  queryClient: QueryClient;
  persister: Persister;
  buster: string;
  purge: () => Promise<void>;
  claim: (userId: string) => Promise<void>;
};

export function createOfflineRuntime({
  queryClient,
  storage = asyncStorage,
  buster = appCacheBuster(),
}: {
  queryClient: QueryClient;
  storage?: StorageAdapter;
  buster?: string;
}): OfflineRuntime {
  const persister = createOwnerPersister({
    storage,
    getOwnerId: () => useSyncStore.getState().ownerId,
  });

  const purge = async () => {
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

  return { queryClient, persister, buster, purge, claim };
}
