import type { Query, Mutation } from '@tanstack/react-query';
import type {
  PersistedClient,
  Persister,
  PersistQueryClientOptions,
} from '@tanstack/react-query-persist-client';

import { asyncStorage, type StorageAdapter } from '@/lib/storage';

export const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

export const CACHE_SCHEMA_VERSION = 1;

const SYNCED_ROOTS = new Set(['teams', 'tasks']);

export const cacheKey = (ownerId: string) => `rq:${ownerId}`;

export function isSyncedKey(key: readonly unknown[] | undefined): boolean {
  return SYNCED_ROOTS.has(String(key?.[0]));
}

export function pauseInterrupted(client: PersistedClient): PersistedClient {
  return {
    ...client,
    clientState: {
      ...client.clientState,
      mutations: client.clientState.mutations.map((mutation) =>
        mutation.state.status === 'pending'
          ? { ...mutation, state: { ...mutation.state, isPaused: true } }
          : mutation,
      ),
    },
  };
}

export function createOwnerPersister({
  storage = asyncStorage,
  getOwnerId,
  throttleTime = 1000,
}: {
  storage?: StorageAdapter;
  getOwnerId: () => string | null;
  throttleTime?: number;
}): Persister {
  let pending: { ownerId: string; client: PersistedClient } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = async () => {
    timer = null;
    const write = pending;
    pending = null;
    if (write) {
      await storage.setItem(
        cacheKey(write.ownerId),
        JSON.stringify(write.client),
      );
    }
  };

  return {
    persistClient: async (client) => {
      const ownerId = getOwnerId();
      if (!ownerId) {
        return;
      }
      pending = { ownerId, client };
      if (throttleTime <= 0) {
        await flush();
      } else {
        timer ??= setTimeout(() => void flush(), throttleTime);
      }
    },
    restoreClient: async () => {
      const ownerId = getOwnerId();
      const raw = ownerId ? await storage.getItem(cacheKey(ownerId)) : null;
      return raw
        ? pauseInterrupted(JSON.parse(raw) as PersistedClient)
        : undefined;
    },
    removeClient: async () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      pending = null;
      const ownerId = getOwnerId();
      if (ownerId) {
        await storage.removeItem(cacheKey(ownerId));
      }
    },
  };
}

export function cacheBuster(appVersion: string, contractHash: string): string {
  return `${appVersion}:${contractHash}:${CACHE_SCHEMA_VERSION}`;
}

export function persistOptions(
  persister: Persister,
  buster: string,
): Omit<PersistQueryClientOptions, 'queryClient'> {
  return {
    persister,
    maxAge: CACHE_MAX_AGE,
    buster,
    dehydrateOptions: {
      shouldDehydrateQuery: (query: Query) =>
        query.state.status === 'success' && isSyncedKey(query.queryKey),
      shouldDehydrateMutation: (mutation: Mutation) =>
        (mutation.state.isPaused || mutation.state.status === 'pending') &&
        isSyncedKey(mutation.options.mutationKey),
    },
  };
}
