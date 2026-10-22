import { INestApplication } from '@nestjs/common';
import request, { Response } from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from '../support/app';
import { useTestDatabase } from '../support/postgres';

const ALLOWED = 'https://app.example.test';
const EVIL = 'https://evil.example.test';

describe('security baseline (e2e)', () => {
  const db = useTestDatabase();
  let allowlist: INestApplication;
  let wildcard: INestApplication;
  let noCors: INestApplication;

  beforeAll(async () => {
    allowlist = await createTestApp(db.url, {
      config: { corsOrigins: [ALLOWED] },
    });
    wildcard = await createTestApp(db.url, { config: { corsOrigins: ['*'] } });
    noCors = await createTestApp(db.url, { config: { corsOrigins: [] } });
  });

  afterAll(async () => {
    await allowlist.close();
    await wildcard.close();
    await noCors.close();
  });

  const http = (app: INestApplication) => request(app.getHttpServer() as App);

  describe('helmet', () => {
    const expectSecurityHeaders = (response: Response) => {
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(response.headers['strict-transport-security']).toContain(
        'max-age=',
      );
      expect(response.headers['content-security-policy']).toContain(
        "default-src 'self'",
      );
      expect(response.headers['referrer-policy']).toBe('no-referrer');
      expect(response.headers['x-powered-by']).toBeUndefined();
    };

    it('T-001-04 security headers are present and X-Powered-By is gone, even on a 404', async () => {
      expectSecurityHeaders(
        await http(allowlist).get('/api/v1/does-not-exist'),
      );
    });

    it('…and on a body-parser error (413)', async () => {
      const response = await http(allowlist)
        .post('/api/v1/does-not-exist')
        .send({ name: 'x'.repeat(200_000) });

      expect(response.status).toBe(413);
      expectSecurityHeaders(response);
    });
  });

  describe('CORS allowlist', () => {
    it('reflects an allowed origin with credentials and the exposed headers', async () => {
      const response = await http(allowlist)
        .get('/api/v1/does-not-exist')
        .set('Origin', ALLOWED);

      expect(response.headers['access-control-allow-origin']).toBe(ALLOWED);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['access-control-expose-headers']).toContain(
        'X-Request-Id',
      );
      // AC-08.3: no ETag is ever sent, so none is exposed.
      expect(response.headers['access-control-expose-headers']).not.toContain(
        'ETag',
      );
    });

    it('answers an allowed preflight', async () => {
      const response = await http(allowlist)
        .options('/api/v1/teams')
        .set('Origin', ALLOWED)
        .set('Access-Control-Request-Method', 'PUT')
        .set('Access-Control-Request-Headers', 'content-type,authorization');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(ALLOWED);
      expect(response.headers['access-control-allow-methods']).toContain('PUT');
      // PR #29: browsers may cache the preflight for 10 minutes.
      expect(response.headers['access-control-max-age']).toBe('600');
    });

    it('T-001-04 a disallowed Origin gets no Access-Control-Allow-Origin', async () => {
      for (const response of [
        await http(allowlist).get('/api/v1/does-not-exist').set('Origin', EVIL),
        await http(allowlist)
          .options('/api/v1/teams')
          .set('Origin', EVIL)
          .set('Access-Control-Request-Method', 'DELETE'),
      ]) {
        // Without Access-Control-Allow-Origin the browser blocks the response. (The `cors`
        // package still sends Allow-Credentials when credentials are on; without a matching
        // Allow-Origin, browsers ignore it.)
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
      }
    });
  });

  describe('empty CORS_ORIGINS', () => {
    it('PR #29: no CORS at all, not even Allow-Credentials, and no preflight answer', async () => {
      const simple = await http(noCors)
        .get('/api/v1/does-not-exist')
        .set('Origin', ALLOWED);
      const preflight = await http(noCors)
        .options('/api/v1/teams')
        .set('Origin', ALLOWED)
        .set('Access-Control-Request-Method', 'PUT');

      for (const response of [simple, preflight]) {
        const corsHeaders = Object.keys(response.headers).filter((name) =>
          name.startsWith('access-control-'),
        );
        expect(corsHeaders).toEqual([]);
      }
      expect(preflight.status).toBe(404);
    });
  });

  describe('CORS_ORIGINS=* (local only)', () => {
    it('PR #19: answers a literal * and never reflects the Origin with credentials', async () => {
      for (const response of [
        await http(wildcard).get('/api/v1/does-not-exist').set('Origin', EVIL),
        await http(wildcard)
          .options('/api/v1/teams')
          .set('Origin', EVIL)
          .set('Access-Control-Request-Method', 'POST'),
      ]) {
        expect(response.headers['access-control-allow-origin']).toBe('*');
        expect(response.headers['access-control-allow-origin']).not.toBe(EVIL);
        expect(
          response.headers['access-control-allow-credentials'],
        ).toBeUndefined();
      }
    });
  });
});
