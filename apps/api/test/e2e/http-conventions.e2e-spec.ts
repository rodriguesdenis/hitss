import { INestApplication } from '@nestjs/common';
import request, { Response } from 'supertest';
import { App } from 'supertest/types';
import { ErrorEnvelope } from '../../src/shared/presentation/filters/global-exception.filter';
import { createTestApp } from '../support/app';
import { LogCapture } from '../support/logging/capture';
import { useTestDatabase } from '../support/postgres';
import { ProbeModule } from './probe.module';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('HTTP conventions (e2e)', () => {
  const db = useTestDatabase();
  const logs = new LogCapture();
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp(db.url, { imports: [ProbeModule], logs });
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer() as App);
  const errorOf = (response: Response) =>
    (response.body as ErrorEnvelope).error;

  describe('routing', () => {
    it('AC-07 T-001-03 an unknown route is 404 ROUTE_NOT_FOUND in the error envelope, with X-Request-Id', async () => {
      const response = await http().get(
        '/api/v1/does-not-exist?token=secret-value',
      );

      expect(response.status).toBe(404);
      const requestId = response.headers['x-request-id'];
      expect(requestId).toMatch(UUID);
      expect(response.body).toEqual({
        error: {
          code: 'ROUTE_NOT_FOUND',
          message: 'Route not found.',
          traceId: requestId,
        },
      });
      expect(JSON.stringify(response.body)).not.toContain('secret-value');
    });

    it('routes live under /api/v1 only', async () => {
      expect((await http().get('/api/v1/probe')).status).toBe(200);
      for (const path of ['/probe', '/api/probe', '/v1/probe']) {
        const response = await http().get(path);
        expect(response.status).toBe(404);
        expect(errorOf(response).code).toBe('ROUTE_NOT_FOUND');
      }
    });

    it('an unsupported method on a known path is 404 ROUTE_NOT_FOUND too', async () => {
      const response = await http().put('/api/v1/probe').send({});

      expect(response.status).toBe(404);
      expect(errorOf(response).code).toBe('ROUTE_NOT_FOUND');
    });
  });

  describe('X-Request-Id', () => {
    it('a safe incoming id is echoed and used as traceId', async () => {
      const response = await http()
        .get('/api/v1/does-not-exist')
        .set('X-Request-Id', 'abc-1.2_3');

      expect(response.headers['x-request-id']).toBe('abc-1.2_3');
      expect(errorOf(response).traceId).toBe('abc-1.2_3');
    });

    it.each(['<script>', 'A'.repeat(129), 'two words'])(
      'an unsafe incoming id %j is replaced',
      async (unsafe) => {
        const response = await http()
          .get('/api/v1/probe')
          .set('X-Request-Id', unsafe);

        expect(response.headers['x-request-id']).toMatch(UUID);
      },
    );
  });

  describe('success envelope', () => {
    it('wraps a returned value as { data }', async () => {
      const response = await http().get('/api/v1/probe');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: { hello: 'world' } });
    });

    it('passes { data, meta } through unchanged', async () => {
      expect((await http().get('/api/v1/probe/page')).body).toEqual({
        data: [{ id: 1 }],
        meta: { total: 1, limit: 20, offset: 0, hasNextPage: false },
      });
    });

    it('@RawResponse() is sent as returned', async () => {
      expect((await http().get('/api/v1/probe/raw')).body).toEqual({
        status: 'ok',
      });
    });

    it('204 has no body', async () => {
      const response = await http().delete('/api/v1/probe');

      expect(response.status).toBe(204);
      expect(response.text).toBe('');
    });
  });

  describe('validation (AC-01.6.6 at pipe level)', () => {
    it('a valid body reaches the handler as a DTO', async () => {
      const response = await http()
        .post('/api/v1/probe')
        .send({ name: 'Platform' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ data: { name: 'Platform' } });
    });

    it.each(['updatedAt', 'deletedAt', 'ownerId', 'owner_id', 'userId'])(
      'an undeclared field %s → 400 VALIDATION_FAILED naming it',
      async (field) => {
        const response = await http()
          .post('/api/v1/probe')
          .send({ name: 'Platform', [field]: 'x' });

        expect(response.status).toBe(400);
        expect(errorOf(response)).toMatchObject({
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed.',
          details: [{ field, message: `property ${field} should not exist` }],
        });
      },
    );

    it.each(['__proto__', 'constructor'])(
      'a %s key in the JSON body → 400 VALIDATION_FAILED',
      async (key) => {
        const response = await http()
          .post('/api/v1/probe')
          .set('Content-Type', 'application/json')
          .send(`{"name":"Platform","${key}":{"isAdmin":true}}`);

        expect(response.status).toBe(400);
        expect(errorOf(response).details).toEqual([
          { field: key, message: `property ${key} should not exist` },
        ]);
      },
    );

    it('malformed JSON → 400 VALIDATION_FAILED without echoing the parser message', async () => {
      const response = await http()
        .post('/api/v1/probe')
        .set('Content-Type', 'application/json')
        .send('{"name": secret-value');

      expect(response.status).toBe(400);
      expect(errorOf(response)).toMatchObject({
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed.',
      });
      expect(response.text).not.toContain('secret-value');
      expect(response.headers['x-request-id']).toMatch(UUID);
    });

    it('Lynx S1: a deeply nested ~100 kB body → 400 VALIDATION_FAILED on body, never a 500', async () => {
      const levels = 16_000;
      const json = '{"a":'.repeat(levels) + '1' + '}'.repeat(levels);
      expect(json.length).toBeGreaterThan(90_000);
      expect(json.length).toBeLessThan(100_000);

      const response = await http()
        .post('/api/v1/probe')
        .set('Content-Type', 'application/json')
        .send(json);

      expect(response.status).toBe(400);
      expect(errorOf(response)).toMatchObject({
        code: 'VALIDATION_FAILED',
        details: [{ field: 'body', message: 'body is nested too deeply' }],
      });
    });

    it('a body over the JSON limit → 413 PAYLOAD_TOO_LARGE', async () => {
      const response = await http()
        .post('/api/v1/probe')
        .send({ name: 'x'.repeat(200_000) });

      expect(response.status).toBe(413);
      // The request-id middleware runs before the body parser, so parse errors carry the id.
      expect(response.headers['x-request-id']).toMatch(UUID);
      expect(errorOf(response).traceId).toBe(response.headers['x-request-id']);
      expect(errorOf(response)).toMatchObject({
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Payload too large.',
      });
    });
  });

  describe('unexpected errors', () => {
    it('→ 500 INTERNAL_ERROR, generic, with one error log entry carrying only { name, code } (leak scan)', async () => {
      logs.reset();

      const response = await http()
        .get('/api/v1/probe/boom?token=secret-value&search=marina')
        .set('Authorization', 'Bearer secret-value')
        .set('Cookie', 'session=secret-value');

      expect(response.status).toBe(500);
      const traceId = response.headers['x-request-id'];
      expect(response.body).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred.',
          traceId,
        },
      });

      // pino levels: 50 = error. The filter writes the only error entry; pino-http's completion
      // line for a 5xx is a warning.
      const errors = logs.lines.filter((line) => line.level === 50);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        msg: 'request.failed',
        err: { name: 'PrismaClientKnownRequestError', code: 'P2002' },
        traceId,
        method: 'GET',
        path: '/api/v1/probe/boom',
      });
      expect(Object.keys(errors[0]?.err as object).sort()).toEqual([
        'code',
        'name',
      ]);
      expect(
        logs.lines.some(
          (line) =>
            line.msg === 'request failed' || line.msg === 'request completed',
        ),
      ).toBe(true);

      const everything = JSON.stringify(response.body) + logs.raw;
      for (const leak of [
        'secret-value',
        'marina',
        'Bearer',
        'session=',
        'DETAIL',
        'Unique constraint',
      ]) {
        expect(everything).not.toContain(leak);
      }
      expect(everything.toLowerCase()).not.toContain('cookie');
    });
  });
});
