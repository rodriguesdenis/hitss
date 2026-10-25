import { useIsRestoring } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { subscribeAppFocus } from '@/lib/query-client';

import { persistOptions } from './persister';
import type { OfflineRuntime } from './runtime';

const RuntimeContext = createContext<OfflineRuntime | null>(null);

export function useOfflineRuntime(): OfflineRuntime {
  const runtime = useContext(RuntimeContext);
  if (!runtime) {
    throw new Error('useOfflineRuntime needs an OfflineQueryProvider');
  }
  return runtime;
}

export function OfflineQueryProvider({
  runtime,
  onRestored,
  children,
}: {
  runtime: OfflineRuntime;
  onRestored?: () => void;
  children: ReactNode;
}) {
  useEffect(subscribeAppFocus, []);
  useEffect(() => runtime.start(), [runtime]);
  return (
    <RuntimeContext.Provider value={runtime}>
      <PersistQueryClientProvider
        client={runtime.queryClient}
        persistOptions={persistOptions(runtime.persister, runtime.buster)}
        onSuccess={onRestored}
      >
        {children}
      </PersistQueryClientProvider>
    </RuntimeContext.Provider>
  );
}

export function useOwnedCache(userId: string | null): boolean {
  const runtime = useOfflineRuntime();
  const restoring = useIsRestoring();
  const [claimed, setClaimed] = useState<string | null>(null);

  useEffect(() => {
    if (restoring || !userId || claimed === userId) {
      return;
    }
    let active = true;
    void runtime.claim(userId).then(() => {
      if (active) {
        setClaimed(userId);
      }
    });
    return () => {
      active = false;
    };
  }, [runtime, restoring, userId, claimed]);

  return !restoring && (!userId || claimed === userId);
}
