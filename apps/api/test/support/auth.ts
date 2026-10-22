import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

export interface TestUser {
  id: string;
  name: string;
  email: string;
  bearer: string;
  cookie: string;
}

export const TEST_PASSWORD = ['correct', 'horse', 'battery', '42'].join('-');

let sequence = 0;

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

export async function twoUsers(
  app: INestApplication,
): Promise<{ marina: TestUser; rafael: TestUser }> {
  const marina = await signUpAndSignIn(app, 'Marina');
  const rafael = await signUpAndSignIn(app, 'Rafael');
  return { marina, rafael };
}

export const bearerOf = (user: Pick<TestUser, 'bearer'>): string =>
  `Bearer ${user.bearer}`;
