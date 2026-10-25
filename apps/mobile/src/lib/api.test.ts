import { ApiError, teamsList } from '@hitss/api-client';

import { setupApiClient } from './api';

const envelope = {
  data: [],
  meta: { total: 0, limit: 20, offset: 0, hasNextPage: false },
};

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('api client setup', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(respond(200, envelope));
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  function sentRequest() {
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    return { url, headers: new Headers(init.headers) };
  }

  it('AC-04.1.7 sends the SecureStore token as a Bearer header to the API origin', async () => {
    setupApiClient(async () => 'tok_123');
    await expect(teamsList({ limit: 20 })).resolves.toEqual(envelope);
    const { url, headers } = sentRequest();
    expect(url).toBe('http://api.test/api/v1/teams?limit=20');
    expect(headers.get('Authorization')).toBe('Bearer tok_123');
  });

  it('sends no Authorization header without a token', async () => {
    setupApiClient(async () => null);
    await teamsList();
    expect(sentRequest().headers.has('Authorization')).toBe(false);
  });

  it('throws ApiError with the error envelope on non-2xx', async () => {
    const body = {
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Unauthenticated',
        traceId: 't-1',
      },
    };
    fetchMock.mockResolvedValue(respond(401, body));
    setupApiClient(async () => 'expired');
    const error = await teamsList().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, body });
  });
});
