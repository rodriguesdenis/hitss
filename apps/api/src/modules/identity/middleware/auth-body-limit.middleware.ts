import type { IncomingMessage, ServerResponse } from 'node:http';

/** Largest `/api/auth/*` request body: credentials are tiny, hashing a huge one is a DoS lever. */
export const AUTH_BODY_LIMIT_BYTES = 16 * 1024;

function reject(response: ServerResponse): void {
  if (response.headersSent) return;
  response.statusCode = 413;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Connection', 'close');
  response.end(
    JSON.stringify({
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body too large',
    }),
  );
}

/**
 * Rejects an oversized `/api/auth/*` body with 413 before Better Auth reads it, so no password is
 * hashed (AC-01.7.10): by the declared `Content-Length`, and for bodies without one (chunked) by
 * the bytes counted as they arrive. The count wraps the request's `push` instead of listening to
 * `data`, which would start the stream before the handler attaches and lose chunks.
 */
export function authBodyLimit(limit: number = AUTH_BODY_LIMIT_BYTES) {
  return (
    request: IncomingMessage,
    response: ServerResponse,
    next: () => void,
  ): void => {
    const declared = Number(request.headers['content-length']);
    if (Number.isFinite(declared) && declared > limit) {
      reject(response);
      return;
    }

    let received = 0;
    const push = request.push.bind(request);
    request.push = (chunk: unknown, encoding?: BufferEncoding): boolean => {
      if (chunk !== null && chunk !== undefined) {
        received += Buffer.byteLength(chunk as Uint8Array | string);
        if (received > limit) {
          reject(response);
          request.destroy();
          return false;
        }
      }
      return push(chunk, encoding);
    };
    next();
  };
}
