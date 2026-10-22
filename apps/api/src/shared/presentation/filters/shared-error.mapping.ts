import { ConcurrencyConflict } from '../../domain/domain-error';
import type { DomainErrorMapping } from './domain-error-mappings';
import { ErrorCode } from './error-codes';

/**
 * Errors of the shared kernel, registered once by HttpConventionsModule (a class may be mapped
 * only once, so contexts never map these themselves).
 */
export const SHARED_ERROR_MAPPINGS: readonly DomainErrorMapping[] = [
  {
    error: ConcurrencyConflict,
    status: 412,
    code: ErrorCode.PRECONDITION_FAILED,
    message: 'The resource was modified; reload it and retry.',
    // ADR-0015: the client learns the current version, so it can reload or show a conflict.
    details: (error) => ({
      currentVersion: (error as ConcurrencyConflict).currentVersion,
    }),
  },
];
