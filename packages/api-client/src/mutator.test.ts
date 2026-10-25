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
});
