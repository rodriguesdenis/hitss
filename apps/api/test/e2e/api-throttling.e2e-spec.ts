import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from '../support/app';
import { bearerOf, signUpAndSignIn } from '../support/auth';
import { useTestDatabase } from '../support/postgres';
import { OwnerProbeModule } from './owner-probe.module';

const PROBE = '/api/v1/owner-probe';

describe('API throttlers: per address before AuthGuard, per user after (e2e)', () => {
  const db = useTestDatabase();
  const apps: INestApplication[] = [];

  /** Each case gets a fresh app, so its buckets start empty. */
  async function freshApp(limits: { ip: number; user: number }) {
    const app = await createTestApp(db.url, {
      imports: [OwnerProbeModule],
      config: {
        appEnv: 'test',
        authRateLimitEnabled: false,
        rateLimitIpMax: limits.ip,
        rateLimitMax: limits.user,
      },
    });
    apps.push(app);
    return app;
  }
  const http = (app: INestApplication) => request(app.getHttpServer() as App);

  afterAll(async () => {
    await Promise.all(apps.map((app) => app.close()));
  });

  it('AC-01.7.9 anonymous requests beyond RATE_LIMIT_IP_MAX get 429 RATE_LIMITED, not 401', async () => {
    const app = await freshApp({ ip: 3, user: 1000 });

    for (let i = 0; i < 3; i++) {
      expect((await http(app).get(PROBE)).status).toBe(401);
    }
    const limited = await http(app).get(PROBE);

    expect(limited.status).toBe(429);
    expect((limited.body as { error: { code: string } }).error.code).toBe(
      'RATE_LIMITED',
    );
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('AC-01.7.9 under the address limit an anonymous request is 401 and consumes no per-user bucket', async () => {
    const app = await freshApp({ ip: 100, user: 2 });

    for (let i = 0; i < 6; i++) {
      expect((await http(app).get(PROBE)).status).toBe(401);
    }
    // Had the anonymous 401s counted against the user throttler (limit 2) these would be 429.
    const user = await signUpAndSignIn(app);
    for (let i = 0; i < 2; i++) {
      expect(
        (await http(app).get(PROBE).set('Authorization', bearerOf(user)))
          .status,
      ).toBe(200);
    }
  });

  it('AC-01.7.3 the user after the limit gets 429 RATE_LIMITED with Retry-After', async () => {
    const app = await freshApp({ ip: 1000, user: 3 });
    const marina = await signUpAndSignIn(app, 'Marina');
    const call = () =>
      http(app).get(PROBE).set('Authorization', bearerOf(marina));

    for (let i = 0; i < 3; i++) expect((await call()).status).toBe(200);
    const limited = await call();

    expect(limited.status).toBe(429);
    expect((limited.body as { error: { code: string } }).error.code).toBe(
      'RATE_LIMITED',
    );
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect(limited.headers['x-ratelimit-limit']).toBeUndefined();
  });

  it('AC-01.7.4 another user is not affected when one is throttled', async () => {
    const app = await freshApp({ ip: 1000, user: 2 });
    const marina = await signUpAndSignIn(app, 'Marina');
    const rafael = await signUpAndSignIn(app, 'Rafael');

    for (let i = 0; i < 2; i++) {
      await http(app).get(PROBE).set('Authorization', bearerOf(marina));
    }
    expect(
      (await http(app).get(PROBE).set('Authorization', bearerOf(marina)))
        .status,
    ).toBe(429);
    expect(
      (await http(app).get(PROBE).set('Authorization', bearerOf(rafael)))
        .status,
    ).toBe(200);
  });

  it('AC-01.7.5 health probes are never throttled', async () => {
    const app = await freshApp({ ip: 2, user: 2 });
    const statuses = new Set<number>();
    for (let i = 0; i < 75; i++) {
      statuses.add((await http(app).get('/api/v1/health/live')).status);
      statuses.add((await http(app).get('/api/v1/health/ready')).status);
    }
    expect([...statuses]).toEqual([200]);
  });
});
