import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  AUTH_BODY_LIMIT_BYTES,
  authBodyLimit,
} from './auth-body-limit.middleware';

class FakeRequest extends EventEmitter {
  readonly chunks: unknown[] = [];
  destroyed = false;
  constructor(readonly headers: Record<string, string> = {}) {
    super();
  }
  push(chunk: unknown): boolean {
    this.chunks.push(chunk);
    return true;
  }
  destroy(): void {
    this.destroyed = true;
  }
}

function fakeResponse() {
  const state = { status: 0, body: '', headers: {} as Record<string, string> };
  const response = {
    headersSent: false,
    set statusCode(value: number) {
      state.status = value;
    },
    setHeader: (name: string, value: string) => {
      state.headers[name.toLowerCase()] = value;
    },
    end: (body: string) => {
      state.body = body;
    },
  };
  return { response: response as unknown as ServerResponse, state };
}

function run(headers: Record<string, string>) {
  const request = new FakeRequest(headers);
  const { response, state } = fakeResponse();
  const next = jest.fn();
  authBodyLimit()(request as unknown as IncomingMessage, response, next);
  return { request, state, next };
}

describe('authBodyLimit', () => {
  it('AC-01.7.10 caps the body at 16 kB', () => {
    expect(AUTH_BODY_LIMIT_BYTES).toBe(16 * 1024);
  });

  it('AC-01.7.10 rejects a declared Content-Length over the cap with 413 before reading', () => {
    const { state, next, request } = run({
      'content-length': String(AUTH_BODY_LIMIT_BYTES + 1),
    });

    expect(state.status).toBe(413);
    expect(JSON.parse(state.body)).toEqual({
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body too large',
    });
    expect(state.headers['content-type']).toContain('application/json');
    expect(state.headers.connection).toBe('close');
    expect(next).not.toHaveBeenCalled();
    expect(request.destroyed).toBe(false);
  });

  it('AC-01.7.10 accepts a declared Content-Length of exactly 16 kB', () => {
    const { state, next } = run({
      'content-length': String(AUTH_BODY_LIMIT_BYTES),
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(state.status).toBe(0);
  });

  it('AC-01.7.10 counts streamed bytes when there is no Content-Length and stops at the cap', () => {
    const { request, state, next } = run({ 'transfer-encoding': 'chunked' });
    expect(next).toHaveBeenCalledTimes(1);

    request.push(Buffer.alloc(AUTH_BODY_LIMIT_BYTES));
    expect(state.status).toBe(0);
    expect(request.chunks).toHaveLength(1);

    const accepted = request.push(Buffer.alloc(1));
    expect(accepted).toBe(false);
    expect(state.status).toBe(413);
    expect(request.destroyed).toBe(true);
    expect(request.chunks).toHaveLength(1); // the offending chunk is not delivered
  });

  it('AC-01.7.10 passes bodiless requests through', () => {
    const { next, state } = run({});
    expect(next).toHaveBeenCalledTimes(1);
    expect(state.status).toBe(0);
  });
});
