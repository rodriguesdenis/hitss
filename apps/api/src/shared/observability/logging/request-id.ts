import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const REQUEST_ID_HEADER = 'x-request-id';
const WELL_FORMED = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * Echoes a well-formed caller request id, otherwise generates one, and returns it on the
 * response (AC-06.2.3). Rejecting other shapes keeps log injection out of the id.
 */
export function requestId(
  request: IncomingMessage,
  response: ServerResponse,
): string {
  const sent = request.headers[REQUEST_ID_HEADER];
  const id =
    typeof sent === 'string' && WELL_FORMED.test(sent) ? sent : randomUUID();
  response.setHeader('X-Request-Id', id);
  return id;
}
