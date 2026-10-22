import { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request, { Response, Test } from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from '../support/app';
import { bearerOf, signUpAndSignIn, twoUsers } from '../support/auth';
import { useTestDatabase } from '../support/postgres';
import { KNOWN_ID, OwnerProbeModule, writes } from './owner-probe.module';

const TRUSTED = 'https://app.example.test';
const UNTRUSTED = 'https://evil.example.test';
const PROBE = '/api/v1/owner-probe';
const OTHER_ID = '0b7a3c1e-2d4f-4a6b-8c9d-1e2f3a4b5c6d';

describe('route protection: deny by default, Bearer only (e2e)', () => {
  const db = useTestDatabase();
  let app: INestApplication;
  let sql: Client;

  beforeAll(async () => {
    app = await createTestApp(db.url, {
      imports: [OwnerProbeModule],
      config: {
        corsOrigins: [TRUSTED],
        appEnv: 'test',
        authRateLimitEnabled: false,
      },
    });
    sql = new Client({ connectionString: db.url });
    await sql.connect();
  });

  afterAll(async () => {
    await sql.end();
    await app.close();
  });

  const http = () => request(app.getHttpServer() as App);

  const signIn = () => signUpAndSignIn(app);

  const expectUnauthenticated = (response: Response) => {
    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication required.',
        traceId: expect.any(String) as string,
      },
    });
  };

  const withAuth = (test: Test, authorization?: string) =>
    authorization === undefined
      ? test
      : test.set('Authorization', authorization);

  describe('authentication (AC-01.5.1 to AC-01.5.7)', () => {
    it.each(['get', 'post', 'put', 'patch', 'delete'] as const)(
      'AC-01.5.1 an anonymous %s → 401 envelope and nothing changes',
      async (method) => {
        const before = writes.count;

        const response = await http()[method](PROBE).send({});

        expectUnauthenticated(response);
        expect(writes.count).toBe(before);
      },
    );

    it('AC-01.5.2 AC-01.5.6 malformed, forged, empty, Basic and unsigned tokens → 401', async () => {
      const user = await signIn();
      const [value] = user.bearer.split('.');
      const raw = (
        await sql.query<{ token: string }>(
          'SELECT token FROM sessions WHERE user_id = $1 LIMIT 1',
          [user.id],
        )
      ).rows[0]?.token;
      expect(raw).toBeDefined();

      for (const authorization of [
        'Bearer not-a-token',
        `Bearer ${value}.${'A'.repeat(43)}`, // forged signature
        `Bearer ${raw}`, // the raw sessions.token, unsigned (AC-01.5.6)
        'Bearer ',
        '',
        // Built at runtime from low-entropy parts: never a credential-shaped literal.
        `Basic ${Buffer.from('user:pass').toString('base64')}`,
      ]) {
        expectUnauthenticated(await withAuth(http().get(PROBE), authorization));
      }
    });

    it('AC-01.5.2 a revoked session → 401', async () => {
      const user = await signIn();
      await http()
        .post('/api/auth/sign-out')
        .set('Authorization', `Bearer ${user.bearer}`)
        .send({});

      expectUnauthenticated(
        await http().get(PROBE).set('Authorization', `Bearer ${user.bearer}`),
      );
      expectUnauthenticated(await http().get(PROBE).set('Cookie', user.cookie));
    });

    it('AC-01.5.2 an expired session → 401', async () => {
      const user = await signIn();
      await sql.query(
        `UPDATE sessions SET expires_at = now() - interval '1 minute' WHERE user_id = $1`,
        [user.id],
      );

      expectUnauthenticated(
        await http().get(PROBE).set('Authorization', `Bearer ${user.bearer}`),
      );
    });

    it('AC-01.2.4 a bearer token is processed as its user', async () => {
      const user = await signIn();

      const response = await http()
        .get(PROBE)
        .set('Authorization', `Bearer ${user.bearer}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: { ownerId: user.id } });
    });

    it.each(['get', 'post', 'put', 'patch', 'delete'] as const)(
      'AC-08.2 a valid session cookie alone (%s) → 401: the API routes accept Bearer only, and nothing changes',
      async (method) => {
        const user = await signIn();
        const before = writes.count;

        const response = await http()
          [method](PROBE)
          .set('Cookie', user.cookie)
          .send({});

        expectUnauthenticated(response);
        expect(writes.count).toBe(before);
      },
    );

    it('AC-01.5.7 a bearer token of A with a session cookie of B → processed as A', async () => {
      const { marina, rafael } = await twoUsers(app);

      const response = await http()
        .get(PROBE)
        .set('Authorization', bearerOf(marina))
        .set('Cookie', rafael.cookie);

      expect(response.body).toEqual({ data: { ownerId: marina.id } });
      expect(marina.id).not.toBe(rafael.id);
    });

    it('AC-01.5.5 without credentials an existing and a missing id get the same 401', async () => {
      const user = await signIn();
      const known = await http()
        .get(`${PROBE}/items/${KNOWN_ID}`)
        .set('Authorization', `Bearer ${user.bearer}`);
      expect(known.status).toBe(200);
      expect(
        (
          await http()
            .get(`${PROBE}/items/${OTHER_ID}`)
            .set('Authorization', `Bearer ${user.bearer}`)
        ).status,
      ).toBe(404);

      const anonymous = await Promise.all(
        [KNOWN_ID, OTHER_ID, 'not-a-uuid'].map((id) =>
          http().get(`${PROBE}/items/${id}`),
        ),
      );

      for (const response of anonymous) {
        expectUnauthenticated(response);
      }
    });

    it('AC-01.5.3 the liveness check answers without credentials', async () => {
      const response = await http().get('/api/v1/health/live');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('no CSRF or content-type checks: Bearer only (ADR-0020)', () => {
    it('AC-08.2 a bearer request from any Origin, cross-site, is processed: there is no ambient credential to abuse', async () => {
      const user = await signIn();

      const response = await http()
        .post(PROBE)
        .set('Authorization', bearerOf(user))
        .set('Origin', UNTRUSTED)
        .set('Sec-Fetch-Site', 'cross-site')
        .send({});

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ data: { ownerId: user.id } });
    });

    it('AC-08.2 a cookie from a trusted Origin is still not a credential → 401', async () => {
      const user = await signIn();

      expectUnauthenticated(
        await http()
          .post(PROBE)
          .set('Cookie', user.cookie)
          .set('Origin', TRUSTED)
          .send({}),
      );
    });
  });
});
