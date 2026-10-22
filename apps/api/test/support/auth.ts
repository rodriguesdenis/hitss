import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

/** A signed-in test user, with both credentials a client can present. */
export interface TestUser {
  id: string;
  name: string;
  email: string;
  /** Signed bearer token from `set-auth-token` (`Authorization: Bearer <token>`). */
  bearer: string;
  /** `name=value` of the session cookie, as a browser sends it back. */
  cookie: string;
}

// Built at runtime with low entropy so secret scanners never mistake a fixture for a secret.
export const TEST_PASSWORD = ['correct', 'horse', 'battery', '42'].join('-');

let sequence = 0;

/**
 * Signs up a fresh user through the real `/api/auth` routes (sign-up also signs in) and returns
 * its credentials. Emails are unique per call, so tests never collide on a shared database.
 */
export async function signUpAndSignIn(
  app: INestApplication,
  name = 'Marina',
): Promise<TestUser> {
  const email = `${name.toLowerCase()}.${++sequence}.${Date.now()}@example.test`;
  const response = await request(app.getHttpServer() as App)
    .post('/api/auth/sign-up/email')
    .send({ name, email, password: TEST_PASSWORD });
  if (response.status !== 200) {
    throw new Error(`sign-up failed with ${response.status}`);
  }
  const cookies = ([] as string[]).concat(response.headers['set-cookie'] ?? []);
  const session = cookies.find((cookie) =>
    cookie.startsWith('better-auth.session_token='),
  );
  const bearer = response.headers['set-auth-token'];
  if (!session || typeof bearer !== 'string') {
    throw new Error('sign-up returned no session cookie or bearer token');
  }
  return {
    id: (response.body as { user: { id: string } }).user.id,
    name,
    email,
    bearer,
    cookie: session.split(';')[0] ?? '',
  };
}

/** Two independent owners for isolation tests (AC-01.6.x): Marina and Rafael. */
export async function twoUsers(
  app: INestApplication,
): Promise<{ marina: TestUser; rafael: TestUser }> {
  const marina = await signUpAndSignIn(app, 'Marina');
  const rafael = await signUpAndSignIn(app, 'Rafael');
  return { marina, rafael };
}

/** `Authorization` header value for a user's bearer token. */
export const bearerOf = (user: Pick<TestUser, 'bearer'>): string =>
  `Bearer ${user.bearer}`;
