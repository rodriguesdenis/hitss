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

const session = {
  id: 'session-1',
  userId: marina.id,
  expiresAt: '2099-01-01T00:00:00.000Z',
};

export const authHandlers = [
  http.post(`${API_URL}/api/auth/sign-in/email`, async ({ request }) => {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };
    if (body.email !== marina.email || body.password !== MARINA_PASSWORD) {
      return HttpResponse.json(
        {
          code: 'INVALID_EMAIL_OR_PASSWORD',
          message: 'Invalid email or password',
        },
        { status: 401 },
      );
    }
    return HttpResponse.json(
      { token: MARINA_TOKEN, user: marina },
      { headers: { 'set-auth-token': MARINA_TOKEN } },
    );
  }),
  http.get(`${API_URL}/api/auth/get-session`, ({ request }) =>
    request.headers.get('authorization') === `Bearer ${MARINA_TOKEN}`
      ? HttpResponse.json({ session, user: marina })
      : HttpResponse.json(null),
  ),
  http.post(`${API_URL}/api/auth/sign-out`, () =>
    HttpResponse.json({ success: true }),
  ),
];
