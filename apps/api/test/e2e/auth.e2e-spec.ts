import { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request, { Response } from 'supertest';
import { App } from 'supertest/types';
import {
  defaultPasswordHasher,
  PASSWORD_HASHER,
  PasswordHasher,
} from '../../src/modules/identity/password-hasher';
import { createTestApp } from '../support/app';
import { useTestDatabase } from '../support/postgres';
import { ProbeModule } from './probe.module';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// Built at runtime with low entropy so secret scanners never mistake a fixture for a secret.
const PASSWORD = ['correct', 'horse', 'battery', '42'].join('-');
const TRUSTED = 'https://app.example.test';
const UNTRUSTED = 'https://evil.example.test';

let emailSeq = 0;
const freshEmail = () => `user${++emailSeq}-${Date.now()}@example.test`;

interface AuthUser {
  id: string;
  name: string;
  email: string;
}
interface SessionBody {
  session: { expiresAt: string; token: string };
  user: AuthUser;
}

describe('Better Auth at /api/auth (e2e)', () => {
  const db = useTestDatabase();
  const hasher: PasswordHasher & {
    hash: jest.Mock<Promise<string>, [string]>;
  } = {
    hash: jest.fn((password: string) => defaultPasswordHasher.hash(password)),
    verify: jest.fn((data: { hash: string; password: string }) =>
      defaultPasswordHasher.verify(data),
    ),
  };
  let app: INestApplication;
  let wildcard: INestApplication;
  let sql: Client;

  beforeAll(async () => {
    app = await createTestApp(db.url, {
      imports: [ProbeModule],
      // Rate limits have their own fresh-app e2e (T-001-10); here they would cut the suite short.
      config: {
        corsOrigins: [TRUSTED],
        appEnv: 'test',
        authRateLimitEnabled: false,
      },
      providers: [{ provide: PASSWORD_HASHER, useValue: hasher }],
    });
    wildcard = await createTestApp(db.url, {
      config: { corsOrigins: ['*'], authRateLimitEnabled: false },
    });
    sql = new Client({ connectionString: db.url });
    await sql.connect();
  });

  afterAll(async () => {
    await sql.end();
    await app.close();
    await wildcard.close();
  });

  const http = (target = app) => request(target.getHttpServer() as App);

  const signUp = (email: string, password = PASSWORD, name = 'Marina') =>
    http().post('/api/auth/sign-up/email').send({ name, email, password });

  const signIn = (email: string, password = PASSWORD, target = app) =>
    http(target).post('/api/auth/sign-in/email').send({ email, password });

  const bearerOf = (response: Response): string => {
    const token = response.headers['set-auth-token'];
    expect(typeof token).toBe('string');
    return token as string;
  };

  const getSession = (bearer?: string) => {
    const call = http().get('/api/auth/get-session');
    return bearer ? call.set('Authorization', `Bearer ${bearer}`) : call;
  };

  const count = async (
    table: 'users' | 'sessions',
    where = 'true',
    params: unknown[] = [],
  ) =>
    Number(
      (
        await sql.query<{ n: string }>(
          `SELECT count(*) AS n FROM ${table} WHERE ${where}`,
          params,
        )
      ).rows[0]?.n,
    );

  describe('sign-up (US-01.1)', () => {
    it('AC-01.1.1 creates the account, signs it in and never returns the password', async () => {
      const email = freshEmail();
      const response = await signUp(email);

      expect(response.status).toBe(200);
      const body = response.body as { user: AuthUser; token: string };
      expect(body.user).toMatchObject({ name: 'Marina', email });
      expect(body.user.id).toMatch(UUID); // generateId: 'uuid'
      expect(bearerOf(response)).toContain('.'); // signed token
      expect(response.text).not.toContain(PASSWORD);
      expect(JSON.stringify(response.body)).not.toMatch(/password|scrypt/i);
      expect(await count('sessions', 'user_id = $1', [body.user.id])).toBe(1);
    });

    it('AC-01.1.2 a registered email (any letter case) is rejected and the password is unchanged', async () => {
      const email = freshEmail();
      await signUp(email);

      const again = await signUp(email.toUpperCase(), 'another-password-99');

      expect(again.status).toBe(422);
      expect(await count('users', 'email = $1', [email])).toBe(1);
      expect((await signIn(email)).status).toBe(200);
      expect((await signIn(email, 'another-password-99')).status).toBe(401);
    });

    it.each([
      [7, 400],
      [8, 200],
      [128, 200],
      [129, 400],
    ])('AC-01.1.3 a %i-character password → %i', async (length, status) => {
      const response = await signUp(freshEmail(), 'p'.repeat(length));

      expect(response.status).toBe(status);
    });

    it.each([
      'no-at-sign.example.test',
      'user@',
      '@example.test',
      'user name@example.test',
    ])(
      'AC-01.1.4 a malformed email %j is rejected and no account is created',
      async (email) => {
        const before = await count('users');
        const response = await signUp(email);

        expect(response.status).toBe(400);
        expect(await count('users')).toBe(before);
      },
    );

    it('AC-01.1.6 stores the email in lower case and accepts any letter case at sign-in', async () => {
      const mixed = `Marina.${Date.now()}@Example.TEST`;
      const response = await signUp(mixed);

      expect((response.body as { user: AuthUser }).user.email).toBe(
        mixed.toLowerCase(),
      );
      expect((await signIn(mixed.toUpperCase())).status).toBe(200);
    });
  });

  describe('sign-in (US-01.2)', () => {
    it('AC-01.2.1 issues a session cookie and a signed bearer token, without secrets in the body', async () => {
      const email = freshEmail();
      await signUp(email);

      const response = await signIn(email);

      expect(response.status).toBe(200);
      const cookies = ([] as string[]).concat(
        response.headers['set-cookie'] ?? [],
      );
      expect(
        cookies.some((c) => c.startsWith('better-auth.session_token=')),
      ).toBe(true);
      expect(cookies.every((c) => /HttpOnly/i.test(c))).toBe(true);
      expect(bearerOf(response)).toBeTruthy();
      expect((response.body as { user: AuthUser }).user.email).toBe(email);
      expect(response.text).not.toContain(PASSWORD);
    });

    it('AC-01.2.2 AC-01.2.3 a wrong password and an unknown email get the very same answer', async () => {
      const email = freshEmail();
      await signUp(email);

      const wrong = await signIn(email, 'wrong-password-1');
      const unknown = await signIn(freshEmail());

      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(wrong.status);
      expect(unknown.body).toEqual(wrong.body);
      expect(wrong.body).toMatchObject({ code: 'INVALID_EMAIL_OR_PASSWORD' });
      for (const response of [wrong, unknown]) {
        expect(response.headers['set-auth-token']).toBeUndefined();
        expect(response.headers['set-cookie']).toBeUndefined();
      }
    });

    it('AC-01.2.7 an unknown email still hashes the password (no timing oracle)', async () => {
      hasher.hash.mockClear();

      await signIn(freshEmail(), 'any-password-77');

      expect(hasher.hash).toHaveBeenCalledTimes(1);
      expect(hasher.hash).toHaveBeenCalledWith('any-password-77');
    });

    it.each([
      ['the allowlist app', () => app],
      ['a CORS_ORIGINS=* app (Lynx)', () => wildcard],
    ])(
      'AC-01.2.8 a sign-in from an untrusted Origin is rejected and issues no session (%s)',
      async (_label, target) => {
        const email = freshEmail();
        await signUp(email);
        const before = await count('sessions');

        const response = await signIn(email, PASSWORD, target()).set(
          'Origin',
          UNTRUSTED,
        );
        const viaHeader = await http(target())
          .post('/api/auth/sign-in/email')
          .set('Origin', UNTRUSTED)
          .send({ email, password: PASSWORD });

        for (const rejected of [response, viaHeader]) {
          expect(rejected.status).toBe(403);
          expect(rejected.headers['set-auth-token']).toBeUndefined();
          expect(rejected.headers['set-cookie']).toBeUndefined();
        }
        expect(await count('sessions')).toBe(before);
      },
    );
  });

  describe('sign-out (US-01.3)', () => {
    it('AC-01.3.1 AC-01.3.2 revokes only the session that signs out', async () => {
      const email = freshEmail();
      await signUp(email);
      const phone = bearerOf(await signIn(email));
      const laptop = bearerOf(await signIn(email));

      const out = await http()
        .post('/api/auth/sign-out')
        .set('Authorization', `Bearer ${phone}`)
        .send({});

      expect(out.status).toBe(200);
      expect((await getSession(phone)).body).toBeNull();
      expect((await getSession(laptop)).body).toMatchObject({
        user: { email },
      });
    });

    it('AC-01.3.3 signing out without a session is not a server error and changes nothing', async () => {
      const before = await count('sessions');

      const response = await http().post('/api/auth/sign-out').send({});

      expect(response.status).toBeLessThan(500);
      expect(await count('sessions')).toBe(before);
    });
  });

  describe('current session (US-01.4)', () => {
    const signedIn = async () => {
      const email = freshEmail();
      await signUp(email);
      const response = await signIn(email);
      return { email, bearer: bearerOf(response) };
    };

    it('AC-01.4.1 returns the user and the session expiry (native format, no envelope)', async () => {
      const { email, bearer } = await signedIn();

      const response = await getSession(bearer);

      expect(response.status).toBe(200);
      const body = response.body as SessionBody;
      expect(body).not.toHaveProperty('data');
      expect(body.user).toMatchObject({ email, name: 'Marina' });
      expect(Date.parse(body.session.expiresAt)).toBeGreaterThan(Date.now());
    });

    it('AC-01.4.2 without credentials answers "no session", not an error', async () => {
      const response = await getSession();

      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
    });

    it('AC-01.4.3 an expired session is no session', async () => {
      const { email, bearer } = await signedIn();
      await sql.query(
        `UPDATE sessions SET expires_at = now() - interval '1 minute'
          WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
        [email],
      );

      expect((await getSession(bearer)).body).toBeNull();
    });

    it('AC-01.4.4 a session last renewed over a day ago slides to 7 days from now', async () => {
      const { email, bearer } = await signedIn();
      // Renewed 2 days ago: expiry = renewal + 7 days = now + 5 days.
      await sql.query(
        `UPDATE sessions SET expires_at = now() + interval '5 days',
                             updated_at = now() - interval '2 days'
          WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
        [email],
      );

      const body = (await getSession(bearer)).body as SessionBody;

      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      expect(Date.parse(body.session.expiresAt)).toBeGreaterThan(
        Date.now() + sevenDays - 60_000,
      );
    });
  });

  describe('HTTP baseline on /api/auth/* (Lynx)', () => {
    it('carries our helmet headers, request id and CORS, in Better Auth native format', async () => {
      const response = await getSession().set('Origin', TRUSTED);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['x-request-id']).toMatch(UUID);
      expect(response.headers['access-control-allow-origin']).toBe(TRUSTED);
      expect(response.headers['access-control-expose-headers']).toContain(
        'set-auth-token',
      );
    });

    it('an untrusted Origin gets no CORS on auth routes either', async () => {
      const response = await getSession().set('Origin', UNTRUSTED);

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('body parsers re-added for other routes (T-001-06)', () => {
    it('a JSON POST to a non-auth route is parsed', async () => {
      const response = await http()
        .post('/api/v1/probe')
        .send({ name: 'Platform' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ data: { name: 'Platform' } });
    });

    it('a JSON body over 100 kB → 413', async () => {
      const response = await http()
        .post('/api/v1/probe')
        .send({ name: 'x'.repeat(101 * 1024) });

      expect(response.status).toBe(413);
    });

    it('urlencoded bodies are not parsed', async () => {
      const response = await http()
        .post('/api/v1/probe')
        .type('form')
        .send('name=Platform');

      expect(response.status).toBe(400);
    });
  });
});
