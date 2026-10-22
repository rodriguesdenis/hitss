import { HttpStatus } from '@nestjs/common';

/**
 * Error codes owned by the shared HTTP layer (api-contracts.md → Error codes). Modules add their
 * own codes (TEAM_NOT_FOUND, …) through domain-error mappings, never here.
 */
export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  PRECONDITION_FAILED: 'PRECONDITION_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export interface CodeAndMessage {
  code: string;
  message: string;
}

/** Statuses with a contract code; any other 4xx uses its HttpStatus name (e.g. PAYLOAD_TOO_LARGE). */
const BY_STATUS: Partial<Record<number, CodeAndMessage>> = {
  400: {
    code: ErrorCode.VALIDATION_FAILED,
    message: 'Request validation failed.',
  },
  401: { code: ErrorCode.UNAUTHENTICATED, message: 'Authentication required.' },
  404: { code: ErrorCode.ROUTE_NOT_FOUND, message: 'Route not found.' },
  429: { code: ErrorCode.RATE_LIMITED, message: 'Too many requests.' },
};

export const UNEXPECTED: CodeAndMessage = {
  code: ErrorCode.INTERNAL_ERROR,
  message: 'An unexpected error occurred.',
};

/**
 * A stable code and a fixed message for a 4xx raised by the framework or the body parser. The
 * exception's own message is never used: it can echo the path, the query string or the body.
 */
export function describeClientError(status: number): CodeAndMessage {
  const known = BY_STATUS[status];
  if (known) {
    return known;
  }
  const name = HttpStatus[status] ?? `HTTP_${status}`;
  const words = name.toLowerCase().replaceAll('_', ' ');
  return {
    code: name,
    message: `${words[0]?.toUpperCase()}${words.slice(1)}.`,
  };
}
