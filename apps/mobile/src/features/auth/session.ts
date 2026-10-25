import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { resetSessionState } from '@/lib/session-reset';

import { authClient, refreshSession } from './auth-client';
import { useSessionStore } from './session.store';
import { deleteToken } from './token';

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

export function useAuthSession() {
  const { data, isPending } = authClient.useSession();
  const signingOut = useSessionStore((state) => state.signingOut);
  const status: AuthStatus = signingOut
    ? 'signedIn'
    : isPending
      ? 'loading'
      : data?.session
        ? 'signedIn'
        : 'signedOut';
  return { status, user: data?.user ?? null };
}

let expiring: Promise<void> | null = null;

export function expireSession(queryClient: QueryClient): Promise<void> {
  expiring ??= (async () => {
    await deleteToken();
    queryClient.clear();
    useSessionStore.getState().markExpired();
    refreshSession();
  })().finally(() => {
    expiring = null;
  });
  return expiring;
}

export async function signOut(queryClient: QueryClient): Promise<void> {
  const { setSigningOut, clearExpired } = useSessionStore.getState();
  setSigningOut(true);
  try {
    await authClient.signOut().catch(() => undefined);
    await deleteToken();
    queryClient.clear();
    await resetSessionState();
    clearExpired();
  } finally {
    setSigningOut(false);
    refreshSession();
  }
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const signingOut = useSessionStore((state) => state.signingOut);
  const run = useCallback(() => signOut(queryClient), [queryClient]);
  return { signOut: run, signingOut };
}
