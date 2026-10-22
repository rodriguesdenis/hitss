import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from '../support/app';
import { useTestDatabase } from '../support/postgres';
import { TcpProxy } from '../support/tcp-proxy';

describe('Health probes (e2e)', () => {
  const db = useTestDatabase();
  let proxy: TcpProxy;
  let app: INestApplication;
  const http = () => request(app.getHttpServer() as App);

  beforeAll(async () => {
    const url = new URL(db.url);
    proxy = new TcpProxy({ host: url.hostname, port: Number(url.port) });
    await proxy.start();
    url.hostname = '127.0.0.1';
    url.port = String(proxy.port);
    app = await createTestApp(url.toString(), {
      config: { appEnv: 'test', authRateLimitEnabled: false },
    });
  });

  afterAll(async () => {
    await app.close();
    await proxy.stop();
  });

  it('AC-06.1.2 readiness answers ready with the database check up, without credentials', async () => {
    const response = await http().get('/api/v1/health/ready');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ready',
      checks: { database: 'up' },
    });
  });

  it('AC-06.1.1 liveness answers up without credentials', async () => {
    const response = await http().get('/api/v1/health/live');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('AC-06.1.3 AC-06.1.4 readiness is 503 within 2 s naming the database while liveness stays up, and recovers without a restart', async () => {
    await proxy.stop();

    const started = Date.now();
    const down = await http().get('/api/v1/health/ready');
    expect(Date.now() - started).toBeLessThan(2000);
    expect(down.status).toBe(503);
    expect(down.body).toEqual({
      status: 'unavailable',
      checks: { database: 'down' },
    });
    expect(JSON.stringify(down.body)).not.toMatch(/ECONN|127\.0\.0\.1|prisma/i);
    expect((await http().get('/api/v1/health/live')).status).toBe(200);

    await proxy.start();
    // The pool drops its broken connections and opens new ones: ready again, same process.
    const deadline = Date.now() + 10_000;
    let recovered = await http().get('/api/v1/health/ready');
    while (recovered.status !== 200 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      recovered = await http().get('/api/v1/health/ready');
    }
    expect(recovered.status).toBe(200);
    expect(recovered.body).toEqual({
      status: 'ready',
      checks: { database: 'up' },
    });
  });

  it('AC-06.1.3 AC-06.1.4 a black-holed database (no answer, no refusal) is 503 within 2 s and readiness is back within seconds of the network returning', async () => {
    expect((await http().get('/api/v1/health/ready')).status).toBe(200);
    proxy.blackhole();

    const started = Date.now();
    const down = await http().get('/api/v1/health/ready');
    expect(Date.now() - started).toBeLessThan(2000);
    expect(down.status).toBe(503);
    expect((await http().get('/api/v1/health/live')).status).toBe(200);

    // Repeated probes during the outage share the one stuck attempt (no pool exhaustion).
    for (let i = 0; i < 5; i++) {
      expect((await http().get('/api/v1/health/ready')).status).toBe(503);
    }

    proxy.restore();
    // The stuck attempt ends at the pg query timeout (5 s), the pool reconnects, ready again.
    const restored = Date.now();
    let recovered = await http().get('/api/v1/health/ready');
    while (recovered.status !== 200 && Date.now() - restored < 15_000) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      recovered = await http().get('/api/v1/health/ready');
    }
    expect(recovered.status).toBe(200);
    expect(Date.now() - restored).toBeLessThan(9_000);
  }, 40_000);

  it('AC-06.1.5 200 probe calls are never rate limited', async () => {
    const statuses = new Set<number>();
    for (let i = 0; i < 100; i++) {
      statuses.add((await http().get('/api/v1/health/live')).status);
      statuses.add((await http().get('/api/v1/health/ready')).status);
    }
    expect([...statuses]).toEqual([200]);
  });
});
