import { ApiError } from '@hitss/api-client';

import { UnresolvedTempIdError } from './temp-ids';

export type MutationKind = 'create' | 'update' | 'status' | 'delete';

export type ReplayDecision =
  | 'success'
  | 'retry'
  | 'unauthenticated'
  | 'gone'
  | 'rejected'
  | 'dependency-failed';

export function classifyReplayError(
  error: unknown,
  kind: MutationKind,
): ReplayDecision {
  if (error instanceof UnresolvedTempIdError) {
    return 'dependency-failed';
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'unauthenticated';
    }
    if (error.status === 404) {
      return kind === 'delete' ? 'success' : 'gone';
    }
    if (error.status === 429 || error.status >= 500) {
      return 'retry';
    }
    return 'rejected';
  }
  if (
    error instanceof TypeError ||
    (error instanceof Error && error.name === 'TimeoutError')
  ) {
    return 'retry';
  }
  return 'rejected';
}
