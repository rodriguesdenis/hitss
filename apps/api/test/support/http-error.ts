import type { ArgumentsHost } from '@nestjs/common';
import {
  ErrorEnvelope,
  GlobalExceptionFilter,
} from '../../src/shared/presentation/filters/global-exception.filter';

export interface HttpError {
  status: number;
  error: Omit<ErrorEnvelope['error'], 'traceId'>;
}

export function httpErrorOf(exception: unknown): HttpError {
  const sent: { status?: number; body?: ErrorEnvelope } = {};
  const response = {
    status(code: number) {
      sent.status = code;
      return this;
    },
    json(body: ErrorEnvelope) {
      sent.body = body;
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ id: 'req-1' }),
    }),
  } as unknown as ArgumentsHost;
  new GlobalExceptionFilter({
    logger: { error: () => undefined },
    activeSpan: () => undefined,
  }).catch(exception, host);
  const error: Partial<ErrorEnvelope['error']> = { ...sent.body!.error };
  delete error.traceId;
  return { status: sent.status!, error: error as HttpError['error'] };
}
