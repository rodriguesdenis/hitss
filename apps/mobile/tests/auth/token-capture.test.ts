import { teamsList } from '@hitss/api-client';
import { QueryClient } from '@tanstack/react-query';

import { authClient, getToken } from '@/features/auth';
import { setupApiClient } from '@/lib/api';

import { marina, MARINA_PASSWORD, MARINA_TOKEN } from '../handlers/auth';
import { server } from '../server';

function recordAuthorization() {
  const seen: { path: string; authorization: string | null }[] = [];
  server.events.on('request:start', ({ request }) => {
    seen.push({
      path: new URL(request.url).pathname,
      authorization: request.headers.get('authorization'),
    });
  });
  return seen;
}

afterEach(() => {
  server.events.removeAllListeners();
});

describe('session token', () => {
  it('AC-04.1.7 stores set-auth-token in SecureStore and sends it as Bearer to /api/v1', async () => {
    setupApiClient(getToken);
    const seen = recordAuthorization();

    const { error } = await authClient.signIn.email({
      email: marina.email,
      password: MARINA_PASSWORD,
    });
    expect(error).toBeNull();
    await expect(getToken()).resolves.toBe(MARINA_TOKEN);

    await teamsList();
    expect(seen.at(-1)).toEqual({
      path: '/api/v1/teams',
      authorization: `Bearer ${MARINA_TOKEN}`,
    });
  });

  it('AC-04.1.7 keeps no token after a failed sign-in', async () => {
    const { error } = await authClient.signIn.email({
      email: marina.email,
      password: 'wrong-password',
    });
    expect(error).toMatchObject({
      status: 401,
      code: 'INVALID_EMAIL_OR_PASSWORD',
    });
    await expect(getToken()).resolves.toBeNull();
  });

  it('keeps the token out of the query cache', async () => {
    setupApiClient(getToken);
    await authClient.signIn.email({
      email: marina.email,
      password: MARINA_PASSWORD,
    });
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity } },
    });
    await client.fetchQuery({
      queryKey: ['teams'],
      queryFn: () => teamsList(),
    });
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((q) => q.state),
      ),
    ).not.toContain(MARINA_TOKEN);
    client.clear();
  });
});
