import { ApiError } from '@hitss/api-client';
import {
  focusManager,
  MutationCache,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';

const MAX_RETRIES = 3;

export function isRetryable(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status >= 500;
  }
  return (
    error instanceof TypeError ||
    (error instanceof Error && error.name === 'TimeoutError')
  );
}

export function shouldRetry(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_RETRIES && isRetryable(error);
}

export function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export type QueryClientOptions = {
  onUnauthenticated?: () => void;
};

export function createQueryClient({
  onUnauthenticated,
}: QueryClientOptions = {}): QueryClient {
  const onError = (error: unknown) => {
    if (isUnauthenticated(error)) {
      onUnauthenticated?.();
    }
  };
  return new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 24 * 60 * 60 * 1000,
        networkMode: 'offlineFirst',
        retry: shouldRetry,
      },
      mutations: {
        networkMode: 'offlineFirst',
        retry: false,
      },
    },
  });
}

export function onAppStateChange(status: AppStateStatus): void {
  focusManager.setFocused(status === 'active');
}

export function subscribeAppFocus(): () => void {
  const subscription = AppState.addEventListener('change', onAppStateChange);
  return () => subscription.remove();
}
