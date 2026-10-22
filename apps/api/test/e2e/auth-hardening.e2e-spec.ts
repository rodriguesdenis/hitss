import { request as httpRequest } from 'node:http';
import { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { AUTH_BODY_LIMIT_BYTES } from '../../src/modules/identity/middleware/auth-body-limit.middleware';
import {
  BetterAuthPasswordHasher,
  PasswordHasher,
} from '../../src/modules/identity/password-hasher';
import { LogCapture } from '../support/logging/capture';
import { createTestApp } from '../support/app';
import { useTestDatabase } from '../support/postgres';

const SIGN_IN = '/api/auth/sign-in/email';

/** A sign-in JSON body of exactly `bytes` bytes (padding in the password field). */
function bodyOfSize(bytes: number): string {
  const frame = JSON.stringify({ email: 'size@example.test', password: '' });
  return JSON.stringify({
    email: 'size@example.test',
    password: 'p'.repeat(bytes - Buffer.byteLength(frame)),
  });
}

describe('Auth endpoint hardening (e2e)', () => {
  const db = useTestDatabase();
  const hasher = new BetterAuthPasswordHasher();
  const hashSpy = jest.spyOn(hasher, 'hash');
  const verifySpy = jest.spyOn(hasher, 'verify');
  const logs = new LogCapture();
  let app: INestApplication;
  let sql: Client;

  beforeAll(async () => {
    app = await createTestApp(db.url, {
      logs,
      config: { appEnv: 'test', authRateLimitEnabled: false },
      providers: [{ provide: PasswordHasher, useValue: hasher }],
    });
    sql = new Client({ connectionString: db.url });
    await sql.connect();
  });

  afterAll(async () => {
    await sql.end();
    await app.close();
  });

  beforeEach(() => {
    hashSpy.mockClear();
    verifySpy.mockClear();
    logs.reset();
  });

  const post = (body: string) =>
    request(app.getHttpServer() as App)
      .post(SIGN_IN)
      .set('Content-Type', 'application/json')
      .send(body);

  it('AC-01.7.10 rejects a 16 kB + 1 byte body with 413 and never hashes', async () => {
    const response = await post(bodyOfSize(AUTH_BODY_LIMIT_BYTES + 1));

    expect(response.status).toBe(413);
    expect(response.body).toEqual({
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body too large',
    });
    expect(hashSpy).not.toHaveBeenCalled();
    expect(verifySpy).not.toHaveBeenCalled();
  });

  it('AC-01.7.10 accepts a body of exactly 16 kB (rejected on its merits, not on size)', async () => {
    const response = await post(bodyOfSize(AUTH_BODY_LIMIT_BYTES));
    expect(response.status).not.toBe(413);
    expect(response.status).toBeLessThan(500);
  });

  it('AC-01.7.10 rejects an oversized chunked body (no Content-Length) with 413', async () => {
    await app.listen(0, '127.0.0.1');
    const port = Number(new URL(await app.getUrl()).port);
    const status = await new Promise<number>((resolve, reject) => {
      const req = httpRequest(
        {
          host: '127.0.0.1',
          port,
          path: SIGN_IN,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Transfer-Encoding': 'chunked',
          },
        },
        (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        },
      );
      req.on('error', reject);
      const body = bodyOfSize(AUTH_BODY_LIMIT_BYTES + 100);
      req.write(body.slice(0, 8000));
      req.write(body.slice(8000));
      req.end();
    });

    expect(status).toBe(413);
    expect(hashSpy).not.toHaveBeenCalled();
  });

  it('AC-01.4.5 a database failure answers a generic error with no driver text in the body or the logs', async () => {
    await sql.query('ALTER TABLE users RENAME TO users_broken');
    try {
      const response = await request(app.getHttpServer() as App)
        .post(SIGN_IN)
        .send({ email: 'nobody@example.test', password: 'a-valid-password-1' });

      expect(response.status).toBeGreaterThanOrEqual(500);
      // The body: nothing about the driver, the schema or the code.
      for (const leaked of [
        'Prisma',
        'prisma',
        'SQL',
        'relation',
        'does not exist',
        'users',
        'P2021',
      ]) {
        expect(response.text).not.toContain(leaked);
      }
      // The logs keep the error class and code (a summary), never the driver message.
      for (const leaked of [
        'SQL',
        'relation',
        'does not exist',
        'users_broken',
        '"users"',
      ]) {
        expect(logs.raw).not.toContain(leaked);
      }
      expect(logs.raw).not.toMatch(/\bat \S+ \(/); // no stack frames
      expect(logs.raw).toContain('auth.request.failed');
    } finally {
      await sql.query('ALTER TABLE users_broken RENAME TO users');
    }
  });
});
