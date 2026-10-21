import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const REQUEST_ID_HEADER = 'x-request-id';
const WELL_FORMED = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * Echoes a well-formed caller request id, otherwise generates one, and returns it on the
 * response (AC-06.2.3). Rejecting other shapes keeps log injection out of the id. An id already
 * resolved for this request (`request.id`, set by requestIdMiddleware) is reused.
 */
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

/**
 * Registered first by setupApp (before the body parser), so every response, including 400/413
 * parse errors, carries X-Request-Id. Stores the id as `request.id`, which pino's `genReqId`
 * (requestId above) and the exception filter reuse: one id per request.
 */
export function requestIdMiddleware(
  request: IncomingMessage & { id?: unknown },
  response: ServerResponse,
  next: () => void,
): void {
  request.id = requestId(request, response);
  next();
}
