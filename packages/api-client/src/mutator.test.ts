import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { ApiError, apiFetch, configureApiClient } from './mutator.ts';

type Call = { url: string; init: RequestInit };

function stubFetch(response: Response): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return response;
  }) as typeof fetch;
  return calls;
}

function stubHangingFetch(): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Promise<Response>((_, reject) => {
      const abort = () => reject(new DOMException('Aborted', 'AbortError'));
      if (init.signal?.aborted) {
        abort();
      }
      init.signal?.addEventListener('abort', abort);
    });
  }) as typeof fetch;
  return calls;
}

const realFetch = globalThis.fetch;

describe('apiFetch', () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('refuses to run before the app configures it', async () => {
    await assert.rejects(
      apiFetch('/api/v1/teams', { method: 'GET' }),
      /configureApiClient/,
    );
  });

  it('prefixes the base URL and sends the injected token as a Bearer header', async () => {
    configureApiClient({
      baseUrl: 'http://api.test',
      getToken: async () => 'abc',
    });
    const calls = stubFetch(Response.json({ data: { id: '1' } }));

    const body = await apiFetch<{ data: { id: string } }>('/api/v1/teams', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    assert.deepEqual(body, { data: { id: '1' } });
    assert.equal(calls[0]?.url, 'http://api.test/api/v1/teams');
    const headers = new Headers(calls[0]?.init.headers);
    assert.equal(headers.get('authorization'), 'Bearer abc');
    assert.equal(headers.get('content-type'), 'application/json');
  });

  it('sends no Authorization header when there is no token', async () => {
    configureApiClient({ baseUrl: 'http://api.test', getToken: () => null });
    const calls = stubFetch(Response.json({}));

    await apiFetch('/api/v1/health/live', { method: 'GET' });

    assert.equal(
      new Headers(calls[0]?.init.headers).has('authorization'),
      false,
    );
  });

  it('resolves undefined for an empty body', async () => {
    configureApiClient({ baseUrl: 'http://api.test', getToken: () => null });
    stubFetch(new Response(null, { status: 204 }));

    assert.equal(
      await apiFetch('/api/v1/tasks/1', { method: 'DELETE' }),
      undefined,
    );
  });

  it('throws ApiError with the status and parsed body on a non-2xx response', async () => {
    configureApiClient({ baseUrl: 'http://api.test', getToken: () => null });
    stubFetch(Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 }));

    await assert.rejects(
      apiFetch('/api/v1/teams/x', { method: 'GET' }),
      (error) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 404);
        assert.deepEqual(error.body, { error: { code: 'NOT_FOUND' } });
        return true;
      },
    );
  });
  it('aborts with a TimeoutError when the API does not answer in time', async () => {
    configureApiClient({
      baseUrl: 'http://api.test',
      getToken: () => null,
      timeoutMs: 20,
    });
    stubHangingFetch();

    await assert.rejects(
      apiFetch('/api/v1/teams', { method: 'GET' }),
      (error: Error) => error.name === 'TimeoutError',
    );
  });

  it('times out after 15 s by default', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    configureApiClient({ baseUrl: 'http://api.test', getToken: () => null });
    stubHangingFetch();

    const request = apiFetch('/api/v1/teams', { method: 'GET' });
    t.mock.timers.tick(14_999);
    t.mock.timers.tick(1);

    await assert.rejects(
      request,
      (error: Error) => error.name === 'TimeoutError',
    );
  });

  it('keeps the caller abort as an AbortError, not a timeout', async () => {
    configureApiClient({ baseUrl: 'http://api.test', getToken: () => null });
    const calls = stubHangingFetch();
    const caller = new AbortController();

    const request = apiFetch('/api/v1/teams', {
      method: 'GET',
      signal: caller.signal,
    });
    await new Promise((resolve) => setImmediate(resolve));
    caller.abort();

    await assert.rejects(
      request,
      (error: Error) => error.name === 'AbortError',
    );
    assert.equal(calls[0]?.init.signal?.aborted, true);
  });

  it('rejects at once when the caller signal is already aborted', async () => {
    configureApiClient({ baseUrl: 'http://api.test', getToken: () => null });
    const calls = stubHangingFetch();

    await assert.rejects(
      apiFetch('/api/v1/teams', {
        method: 'GET',
        signal: AbortSignal.abort(),
      }),
      (error: Error) => error.name === 'AbortError',
    );
    assert.equal(calls[0]?.init.signal?.aborted, true);
  });

  for (const [header, expected] of [
    ['12', 12],
    ['0', 1],
    ['3600', 60],
    [new Date(Date.now() + 30_000).toUTCString(), 30],
    ['soon', undefined],
  ] as const) {
    it(`reads Retry-After ${JSON.stringify(header)} as ${expected} s (clamped to 1-60)`, async () => {
      configureApiClient({ baseUrl: 'http://api.test', getToken: () => null });
      stubFetch(
        Response.json(
          { error: { code: 'RATE_LIMITED' } },
          { status: 429, headers: { 'Retry-After': header } },
        ),
      );

      await assert.rejects(
        apiFetch('/api/v1/teams', { method: 'GET' }),
        (error) => {
          assert.ok(error instanceof ApiError);
          if (typeof expected === 'number' && header.includes('GMT')) {
            assert.ok(Math.abs((error.retryAfter ?? 0) - expected) <= 1);
          } else {
            assert.equal(error.retryAfter, expected);
          }
          return true;
        },
      );
    });
  }

  it('leaves retryAfter undefined without the header', async () => {
    configureApiClient({ baseUrl: 'http://api.test', getToken: () => null });
    stubFetch(Response.json({}, { status: 503 }));

    await assert.rejects(
      apiFetch('/api/v1/teams', { method: 'GET' }),
      (error) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.retryAfter, undefined);
        return true;
      },
    );
  });

  it('sends a fresh X-Request-Id the API accepts on every request', async () => {
    configureApiClient({ baseUrl: 'http://api.test', getToken: () => null });
    const calls = stubFetch(Response.json({}));

    await apiFetch('/api/v1/teams', { method: 'GET' });
    const second = stubFetch(Response.json({}));
    await apiFetch('/api/v1/teams', { method: 'GET' });

    const first = new Headers(calls[0]?.init.headers).get('x-request-id');
    const next = new Headers(second[0]?.init.headers).get('x-request-id');
    assert.match(first ?? '', /^[A-Za-z0-9._-]{1,128}$/);
    assert.match(next ?? '', /^[A-Za-z0-9._-]{1,128}$/);
    assert.notEqual(first, next);
  });

  it('accepts an absolute URL under the base URL and sends the token there', async () => {
    configureApiClient({
      baseUrl: 'http://api.test/',
      getToken: () => 'abc',
    });
    const calls = stubFetch(Response.json({}));

    await apiFetch('http://api.test/api/v1/teams', { method: 'GET' });

    assert.equal(calls[0]?.url, 'http://api.test/api/v1/teams');
    assert.equal(
      new Headers(calls[0]?.init.headers).get('authorization'),
      'Bearer abc',
    );
  });

  for (const foreign of [
    'https://evil.test/api/v1/teams',
    'http://api.test.evil.test/api/v1/teams',
    'http://api.test@evil.test/api/v1/teams',
    '//evil.test/api/v1/teams',
    'https://api.test/api/v1/teams',
  ]) {
    it(`refuses ${foreign} without calling fetch, so the token never leaves the API origin`, async () => {
      configureApiClient({ baseUrl: 'http://api.test', getToken: () => 'abc' });
      const calls = stubFetch(Response.json({}));

      await assert.rejects(
        apiFetch(foreign, { method: 'GET' }),
        /outside the configured baseUrl/,
      );
      assert.equal(calls.length, 0);
    });
  }
});
