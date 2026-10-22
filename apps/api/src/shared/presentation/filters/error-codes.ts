import { HttpStatus } from '@nestjs/common';

export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export interface CodeAndMessage {
  code: string;
  message: string;
}

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
