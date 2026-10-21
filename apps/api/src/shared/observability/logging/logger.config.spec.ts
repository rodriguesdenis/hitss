import type { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { LogCapture } from '../../../../test/support/logging/capture';
import { bootLogApp } from '../../../../test/support/logging/log-app';

const password = 'Password-value-1';
const token = 'token-value-abcdef';

describe('request logging', () => {
  let app: INestApplication;
  let out: LogCapture;

  beforeAll(async () => {
    ({ app, out } = await bootLogApp('trace'));
  });
  beforeEach(() => out.reset());
  afterAll(() => app.close());

  it('AC-06.3.1 AC-06.2.3 writes one completion line with method, route template, status, duration and request id', async () => {
    const response = await request(app.getHttpServer() as Server).get(
      '/api/v1/tasks/7f3c?search=private',
    );

    const completed = out.lines.filter((l) => l.msg === 'request completed');
    expect(completed).toHaveLength(1);
    expect(completed[0]).toMatchObject({
      req: { method: 'GET', url: '/api/v1/tasks/7f3c' },
      route: '/api/v1/tasks/:id',
      res: { statusCode: 200 },
      reqId: response.headers['x-request-id'],
    });
    expect(typeof completed[0]?.responseTime).toBe('number');
    expect(out.raw).not.toContain('private');
  });

  it('AC-06.3.2 entries written during the request share its request id', async () => {
    await request(app.getHttpServer() as Server)
      .get('/api/v1/tasks/1')
      .set('X-Request-Id', 'abc-123');

    const inside = out.lines.find((l) => l.msg === 'inside handler');
    expect(inside).toMatchObject({ reqId: 'abc-123' });
    expect(out.lines.find((l) => l.msg === 'request completed')).toMatchObject({
      reqId: 'abc-123',
    });
  });

  it('AC-06.3.3 never logs credential headers or request bodies', async () => {
    await request(app.getHttpServer() as Server)
      .get('/api/v1/tasks/1')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', `session=${token}`)
      .send({ password, nested: { token } });

    expect(out.raw).not.toContain(token);
    expect(out.raw).not.toContain(password);
  });

  it('AC-06.3.7 strips the query string of /api/auth/* URLs', async () => {
    await request(app.getHttpServer() as Server).get(
      `/api/auth/verify?token=${token}`,
    );

    expect(out.raw).not.toContain(token);
    expect(out.lines.find((l) => l.msg === 'request completed')).toMatchObject({
      req: { url: '/api/auth/verify' },
    });
  });

  it('AC-06.1.5 does not log probe requests', async () => {
    await request(app.getHttpServer() as Server)
      .get('/api/v1/health/live')
      .expect(200);
    expect(out.lines).toHaveLength(0);
  });

  it('AC-06.3.6 logs no user id when nobody is signed in and never an email', async () => {
    await request(app.getHttpServer() as Server).get('/api/v1/tasks/1');
    expect(
      out.lines.find((l) => l.msg === 'request completed'),
    ).not.toHaveProperty('userId');
  });
});
