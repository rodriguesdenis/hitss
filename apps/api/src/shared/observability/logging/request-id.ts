import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const REQUEST_ID_HEADER = 'x-request-id';
const WELL_FORMED = /^[A-Za-z0-9._-]{1,128}$/;

export function requestId(
  request: IncomingMessage & { id?: unknown },
  response: ServerResponse,
): string {
  const sent = request.headers[REQUEST_ID_HEADER];
  const id =
    typeof request.id === 'string'
      ? request.id
      : typeof sent === 'string' && WELL_FORMED.test(sent)
        ? sent
        : randomUUID();
  response.setHeader('X-Request-Id', id);
  return id;
}

export function requestIdMiddleware(
  request: IncomingMessage & { id?: unknown },
  response: ServerResponse,
  next: () => void,
): void {
  request.id = requestId(request, response);
  next();
}
