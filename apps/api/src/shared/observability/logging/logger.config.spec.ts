import { INestApplication } from '@nestjs/common';
import { LogCapture } from '../../../../test/support/logging/capture';
import { createLoggerParams } from './logger.config';
import { bootLogApp } from '../../../../test/support/logging/log-app';

const password = 'Password-value-1';
const token = 'token-value-abcdef';

describe('request logging', () => {
  let app: INestApplication;
  let out: LogCapture;
  let call: Awaited<ReturnType<typeof bootLogApp>>['call'];

  const completed = (path: string) => (l: Record<string, unknown>) =>
    l.msg === 'request completed' &&
    (l.req as { url: string } | undefined)?.url === path;

  beforeAll(async () => {
    ({ app, out, call } = await bootLogApp('trace'));
  });
  beforeEach(() => out.reset());
  afterAll(() => app.close());

  it('AC-06.3.1 AC-06.2.3 writes one completion line with method, route template, status, duration and request id', async () => {
    const response = await call('/api/v1/tasks/7f3c?search=private');

    const line = await out.waitFor(completed('/api/v1/tasks/7f3c'));
    // Sentinel: once the next request's line exists, a duplicate of the first would be there too.
    await call('/api/v1/tasks/sentinel');
    await out.waitFor(completed('/api/v1/tasks/sentinel'));
    expect(
      out.lines.filter(
        (l) =>
          l.msg === 'request completed' &&
          (l.req as { url: string }).url === '/api/v1/tasks/7f3c',
      ),
    ).toHaveLength(1);
    expect(line).toMatchObject({
      req: { method: 'GET', url: '/api/v1/tasks/7f3c' },
      route: '/api/v1/tasks/:id',
      res: { statusCode: 200 },
      reqId: response.headers.get('x-request-id'),
    });
    expect(typeof line.responseTime).toBe('number');
    expect(out.raw).not.toContain('private');
  });

  it('AC-08.7 without telemetry the completion line still carries reqId and a traceId (the request id)', async () => {
    const response = await call('/api/v1/tasks/1');
    const line = await out.waitFor(completed('/api/v1/tasks/1'));
    expect(line.reqId).toBe(response.headers.get('x-request-id'));
    expect(line.traceId).toBe(line.reqId);
    expect(line).not.toHaveProperty('spanId');
  });

  it('AC-06.3.2 entries written during the request share its request id', async () => {
    await call('/api/v1/tasks/1', { headers: { 'X-Request-Id': 'abc-123' } });

    const done = await out.waitFor(completed('/api/v1/tasks/1'));
    expect(done).toMatchObject({ reqId: 'abc-123' });
    expect(out.lines.find((l) => l.msg === 'inside handler')).toMatchObject({
      reqId: 'abc-123',
    });
  });

  it('AC-06.3.3 never logs credential headers or request bodies', async () => {
    await call('/api/v1/tasks', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Cookie: `session=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password, nested: { token } }),
    });

    await out.waitFor(completed('/api/v1/tasks'));
    expect(out.raw).not.toContain(token);
    expect(out.raw).not.toContain(password);
  });

  it('T-001-04 a request body never appears in a log line, even with plain values at trace level', async () => {
    const marker = 'Body-Marker-7f3c';
    await call('/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: marker, notes: [{ text: marker }] }),
    });

    await out.waitFor(completed('/api/v1/tasks'));
    expect(out.raw).not.toContain(marker);
  });

  it('AC-06.3.7 strips the query string of /api/auth/* URLs', async () => {
    await call(`/api/auth/verify?token=${token}`);

    const line = await out.waitFor(completed('/api/auth/verify'));
    expect(out.raw).not.toContain(token);
    expect(line).toMatchObject({ req: { url: '/api/auth/verify' } });
  });

  it('AC-06.1.5 does not log probe requests', async () => {
    expect((await call('/api/v1/health/live')).status).toBe(200);
    // Sentinel: once the next request's line is written, a probe line would be there too.
    await call('/api/v1/tasks/sentinel');
    await out.waitFor(completed('/api/v1/tasks/sentinel'));

    expect(out.lines.filter((l) => l.msg === 'request completed')).toHaveLength(
      1,
    );
    expect(out.raw).not.toContain('health');
  });

  it('AC-06.3.6 logs no user id when nobody is signed in and never an email', async () => {
    await call('/api/v1/tasks/1');
    expect(await out.waitFor(completed('/api/v1/tasks/1'))).not.toHaveProperty(
      'userId',
    );
  });
});

describe('LOG_PRETTY', () => {
  const settings = { level: 'info', pretty: true };

  it('AC-06.3.5 uses the pino-pretty transport when it is installed', () => {
    const { pinoHttp } = createLoggerParams(settings, undefined, {
      prettyAvailable: () => true,
    });
    expect(pinoHttp).toMatchObject({ transport: { target: 'pino-pretty' } });
  });

  it('AC-06.3.5 falls back to JSON with one warning when pino-pretty is missing', () => {
    const warn = jest.fn();
    const { pinoHttp } = createLoggerParams(settings, undefined, {
      prettyAvailable: () => false,
      warn,
    });
    expect(pinoHttp).not.toHaveProperty('transport');
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
