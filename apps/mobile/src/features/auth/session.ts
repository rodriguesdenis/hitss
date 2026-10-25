import type { QueryClient } from '@tanstack/react-query';

import { authClient, refreshSession } from './auth-client';
import { useSessionNotice } from './session-notice.store';
import { deleteToken } from './token';

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

export function useAuthSession() {
  const { data, isPending } = authClient.useSession();
  const status: AuthStatus = isPending
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
    useSessionNotice.getState().markExpired();
    refreshSession();
  })().finally(() => {
    expiring = null;
  });
  return expiring;
}
