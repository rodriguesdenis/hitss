import { ApiError } from '@hitss/api-client';
import type { MutationKey, QueryClient } from '@tanstack/react-query';

import { setSyncAllowed } from './network';
import { isSyncedKey } from './persister';
import {
  classifyReplayError,
  type MutationKind,
  type ReplayDecision,
} from './replay-errors';

export const SYNC_SCOPE = { id: 'sync' };

export const ALREADY_GONE = { alreadyGone: true } as const;

export function isAlreadyGone(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { alreadyGone?: unknown }).alreadyGone === true
  );
}
export const MAX_RETRIES = 5;
const MAX_DELAY_MS = 30_000;

let onUnauthenticated: () => void = () => undefined;

export function setDurableUnauthenticatedHandler(handler: () => void): void {
  onUnauthenticated = handler;
}

export function retryDelay(failureCount: number, error: unknown): number {
  if (error instanceof ApiError && error.retryAfter) {
    return error.retryAfter * 1000;
  }
  return Math.min(1000 * 2 ** failureCount, MAX_DELAY_MS);
}

export type Discard = Exclude<
  ReplayDecision,
  'success' | 'retry' | 'unauthenticated'
>;

export type DurableMutationSpec<TVariables, TData, TContext> = {
  kind: MutationKind;
  mutationFn: (variables: TVariables) => Promise<TData>;
  onMutate?: (variables: TVariables) => Promise<TContext> | TContext;
  onSuccess?: (
    data: TData | typeof ALREADY_GONE,
    variables: TVariables,
    context: TContext | undefined,
  ) => Promise<void> | void;
  onDiscard?: (
    reason: Discard,
    error: unknown,
    variables: TVariables,
    context: TContext | undefined,
  ) => void;
  afterDrain?: (variables: TVariables) => Promise<void> | void;
};

export function defineDurableMutation<TVariables, TData, TContext>(
  queryClient: QueryClient,
  mutationKey: MutationKey,
  spec: DurableMutationSpec<TVariables, TData, TContext>,
): void {
  queryClient.setMutationDefaults(mutationKey, {
    scope: SYNC_SCOPE,
    networkMode: 'offlineFirst',
    mutationFn: async (variables: TVariables) => {
      try {
        return await spec.mutationFn(variables);
      } catch (error) {
        if (classifyReplayError(error, spec.kind) === 'success') {
          return ALREADY_GONE;
        }
        throw error;
      }
    },
    retry: (failureCount: number, error: unknown) => {
      const decision = classifyReplayError(error, spec.kind);
      if (decision === 'unauthenticated') {
        setSyncAllowed(false);
        onUnauthenticated();
        return true;
      }
      return decision === 'retry' && failureCount < MAX_RETRIES;
    },
    retryDelay,
    onMutate: spec.onMutate,
    onSuccess: async (
      data: unknown,
      variables: TVariables,
      context: unknown,
    ) => {
      await spec.onSuccess?.(
        data as TData | typeof ALREADY_GONE,
        variables,
        context as TContext | undefined,
      );
      if (spec.afterDrain) {
        afterQueueDrains(queryClient, () => spec.afterDrain?.(variables));
      }
    },
    onError: (error: unknown, variables: TVariables, context: unknown) => {
      const decision = classifyReplayError(error, spec.kind);
      const reason: Discard =
        decision === 'gone' || decision === 'dependency-failed'
          ? decision
          : 'rejected';
      spec.onDiscard?.(
        reason,
        error,
        variables,
        context as TContext | undefined,
      );
    },
  });
}

const pendingEffects = new WeakMap<QueryClient, (() => unknown)[]>();

function syncedInFlight(queryClient: QueryClient): number {
  return queryClient.isMutating({
    predicate: (mutation) => isSyncedKey(mutation.options.mutationKey),
  });
}

export function afterQueueDrains(
  queryClient: QueryClient,
  effect: () => unknown,
): void {
  const effects = pendingEffects.get(queryClient);
  if (effects) {
    effects.push(effect);
    return;
  }
  const queue = [effect];
  pendingEffects.set(queryClient, queue);
  const flush = () => {
    if (syncedInFlight(queryClient) > 0) {
      return false;
    }
    unsubscribe();
    pendingEffects.delete(queryClient);
    queue.forEach((run) => void run());
    return true;
  };
  const unsubscribe = queryClient.getMutationCache().subscribe(() => {
    flush();
  });
  queueMicrotask(flush);
}
