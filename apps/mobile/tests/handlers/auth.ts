import { http, HttpResponse } from 'msw';

import { API_URL } from '../fixtures';

export const marina = {
  id: 'user-marina',
  name: 'Marina Souza',
  email: 'marina@example.com',
  emailVerified: true,
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
};

export const MARINA_PASSWORD = 'senha-segura-123';

export const MARINA_TOKEN = 'tok_marina.signature';

export const ana = {
  id: 'user-ana',
  name: 'Ana Lima',
  email: 'ana@example.com',
  emailVerified: true,
  createdAt: '2026-09-02T12:00:00.000Z',
  updatedAt: '2026-09-02T12:00:00.000Z',
};

export const ANA_PASSWORD = 'senha-da-ana-123';

export const ANA_TOKEN = 'tok_ana.signature';

const accounts = [
  { user: marina, password: MARINA_PASSWORD, token: MARINA_TOKEN },
  { user: ana, password: ANA_PASSWORD, token: ANA_TOKEN },
];

export const authHandlers = [
  http.post(`${API_URL}/api/auth/sign-in/email`, async ({ request }) => {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };
    const account = accounts.find(
      ({ user, password }) =>
        user.email === body.email && password === body.password,
    );
    if (!account) {
      return HttpResponse.json(
        {
          code: 'INVALID_EMAIL_OR_PASSWORD',
          message: 'Invalid email or password',
        },
        { status: 401 },
      );
    }
    return HttpResponse.json(
      { token: account.token, user: account.user },
      { headers: { 'set-auth-token': account.token } },
    );
  }),
  http.get(`${API_URL}/api/auth/get-session`, ({ request }) => {
    const account = accounts.find(
      ({ token }) => request.headers.get('authorization') === `Bearer ${token}`,
    );
    return HttpResponse.json(
      account
        ? {
            session: {
              id: `session-${account.user.id}`,
              userId: account.user.id,
              expiresAt: '2099-01-01T00:00:00.000Z',
            },
            user: account.user,
          }
        : null,
    );
  }),
  http.post(`${API_URL}/api/auth/sign-out`, () =>
    HttpResponse.json({ success: true }),
  ),
];
