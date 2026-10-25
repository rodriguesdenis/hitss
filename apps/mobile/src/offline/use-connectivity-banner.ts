import { useIsMutating } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import type { ConnectivityStatus } from '@/ui';

import { useIsOnline } from './network';
import { isSyncedKey } from './persister';

export const FLAP_MS = 1000;
export const SYNCED_MS = 2000;

export type BannerPhase = 'idle' | ConnectivityStatus;

export function nextPhase(
  phase: BannerPhase,
  online: boolean,
  pendingCount: number,
): BannerPhase {
  if (!online) {
    return 'offline';
  }
  if (phase === 'offline') {
    return pendingCount > 0 ? 'syncing' : 'idle';
  }
  if (phase === 'syncing' && pendingCount === 0) {
    return 'synced';
  }
  return phase;
}

function useStable<T>(value: T, delay: number): T {
  const [stable, setStable] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setStable(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return stable;
}

export function usePendingCount(): number {
  return useIsMutating({
    predicate: (mutation) => isSyncedKey(mutation.options.mutationKey),
  });
}

export function useConnectivityBanner(): {
  status?: ConnectivityStatus;
  pendingCount: number;
} {
  const online = useStable(useIsOnline(), FLAP_MS);
  const pendingCount = usePendingCount();
  const [phase, setPhase] = useState<BannerPhase>('idle');

  const next = nextPhase(phase, online, pendingCount);
  if (next !== phase) {
    setPhase(next);
  }

  useEffect(() => {
    if (phase !== 'synced') {
      return;
    }
    const timer = setTimeout(() => setPhase('idle'), SYNCED_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  return {
    status: next === 'idle' ? undefined : next,
    pendingCount,
  };
}
