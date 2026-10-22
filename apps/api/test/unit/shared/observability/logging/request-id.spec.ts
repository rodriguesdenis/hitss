import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  requestId,
  requestIdMiddleware,
} from '../../../../../src/shared/observability/logging/request-id';

const run = (header?: string) => {
  const headers: Record<string, string> = {};
  const request = {
    headers: header === undefined ? {} : { 'x-request-id': header },
  };
  const response = { setHeader: (k: string, v: string) => (headers[k] = v) };
  const id = requestId(
    request as unknown as IncomingMessage,
    response as unknown as ServerResponse,
  );
  return { id, headers };
};

describe('requestId', () => {
  it('AC-06.2.3 echoes a well-formed id and returns it in the response header', () => {
    expect(run('abc-123_X.9')).toEqual({
      id: 'abc-123_X.9',
      headers: { 'X-Request-Id': 'abc-123_X.9' },
    });
  });

  it.each(['', 'has space', 'new\nline', 'x'.repeat(129), '<script>'])(
    'AC-06.2.3 replaces the malformed id %j with a generated one',
    (bad) => {
      const { id, headers } = run(bad);
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
      expect(headers['X-Request-Id']).toBe(id);
    },
  );

  it('AC-06.2.3 generates an id when none was sent', () => {
    expect(run().id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reuses the id already resolved for this request, so pino logs the id the response carries', () => {
    const headers: Record<string, string> = {};
    const request = { id: 'resolved-1', headers: { 'x-request-id': 'bad id' } };
    const response = { setHeader: (k: string, v: string) => (headers[k] = v) };

    expect(
      requestId(
        request as unknown as IncomingMessage,
        response as unknown as ServerResponse,
      ),
    ).toBe('resolved-1');
    expect(headers['X-Request-Id']).toBe('resolved-1');
  });
});

describe('requestIdMiddleware', () => {
  it('AC-06.2.3 resolves the id once, before the body parser, and stores it on the request', () => {
    const headers: Record<string, string> = {};
    const request: { id?: unknown; headers: Record<string, string> } = {
      headers: { 'x-request-id': 'abc\nlevel=error' },
    };
    const response = { setHeader: (k: string, v: string) => (headers[k] = v) };
    const next = jest.fn();

    requestIdMiddleware(
      request as unknown as IncomingMessage,
      response as unknown as ServerResponse,
      next,
    );

    expect(request.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers['X-Request-Id']).toBe(request.id);
    expect(next).toHaveBeenCalledTimes(1);
    // pino's genReqId runs later on the same request and gets the same id.
    expect(
      requestId(
        request as unknown as IncomingMessage,
        response as unknown as ServerResponse,
      ),
    ).toBe(request.id);
  });
});
