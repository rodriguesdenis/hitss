import { INestApplication } from '@nestjs/common';
import { request as httpRequest } from 'node:http';
import type { AddressInfo, Server } from 'node:net';
import { Client } from 'pg';
import {
  BetterAuthPasswordHasher,
  PasswordHasher,
} from '../../src/modules/identity/password-hasher';
import { createTestApp } from '../support/app';
import { useTestDatabase } from '../support/postgres';

// Built at runtime with low entropy so secret scanners never mistake a fixture for a secret.
const PASSWORD = ['correct', 'horse', 'battery', '42'].join('-');
const WRONG = ['wrong', 'password', '1'].join('-');

/**
 * A fresh loopback address per client (Linux routes all of 127.0.0.0/8 to lo). Never 127.0.0.1:
 * that is Better Auth's fallback when it finds no client IP under NODE_ENV=test, so a test that
 * passes with these addresses cannot be relying on the fallback (AC-01.7.8).
 */
let lastOctet = 10;
const nextLoopback = () => `127.0.0.${++lastOctet}`;
let lastForwarded = 10;
const nextForwarded = () => `203.0.113.${++lastForwarded}`;
let emailSeq = 0;
const freshEmail = () => `limit${++emailSeq}-${Date.now()}@example.test`;

interface Reply {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

/** One HTTP request from a chosen local address (supertest cannot bind one). */
function send(
  port: number,
  from: string,
  method: 'GET' | 'POST',
  path: string,
  options: { body?: unknown; headers?: Record<string, string> } = {},
): Promise<Reply> {
  const payload =
    options.body === undefined ? undefined : JSON.stringify(options.body);
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        method,
        path,
        localAddress: from,
        headers: {
          ...(payload ? { 'content-type': 'application/json' } : {}),
          ...options.headers,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    req.on('error', reject);
    req.end(payload);
  });
}

describe('Better Auth rate limiter by client address (e2e)', () => {
  const db = useTestDatabase();
  let sql: Client;

  beforeAll(async () => {
    sql = new Client({ connectionString: db.url });
    await sql.connect();
  });

  afterAll(() => sql.end());

  /**
   * The distinct addresses Better Auth resolved for this user's sessions (sign-up signs in too),
   * as it stored them.
   */
  const sessionIp = async (email: string): Promise<string[]> =>
    (
      await sql.query<{ ip_address: string }>(
        `SELECT DISTINCT s.ip_address FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE u.email = $1`,
        [email],
      )
    ).rows.map((row) => row.ip_address);

  /** A fresh app with the limiter on, listening on loopback, with the real hasher observed. */
  const startApp = async (trustedProxies: string[] = []) => {
    const hasher = new BetterAuthPasswordHasher();
    const verify = jest.spyOn(hasher, 'verify');
    const app: INestApplication = await createTestApp(db.url, {
      config: { authRateLimitEnabled: true, trustedProxies },
      providers: [{ provide: PasswordHasher, useValue: hasher }],
    });
    await app.listen(0, '127.0.0.1');
    const { port } = (app.getHttpServer() as Server).address() as AddressInfo;
    const call = (
      from: string,
      method: 'GET' | 'POST',
      path: string,
      options?: { body?: unknown; headers?: Record<string, string> },
    ) => send(port, from, method, `/api/auth${path}`, options);
    return {
      app,
      verify,
      call,
      signUp: (from: string, email: string, headers?: Record<string, string>) =>
        call(from, 'POST', '/sign-up/email', {
          body: { name: 'Marina', email, password: PASSWORD },
          headers,
        }),
      signIn: (
        from: string,
        email: string,
        password = PASSWORD,
        headers?: Record<string, string>,
      ) =>
        call(from, 'POST', '/sign-in/email', {
          body: { email, password },
          headers,
        }),
    };
  };

  const expectThrottled = (reply: Reply) => {
    expect(reply.status).toBe(429);
    const wait = Number(reply.headers['x-retry-after']);
    expect(wait).toBeGreaterThanOrEqual(1);
    expect(wait).toBeLessThanOrEqual(60);
    expect(reply.headers['set-cookie']).toBeUndefined();
    expect(reply.headers['set-auth-token']).toBeUndefined();
  };

  describe('no proxy trusted (TRUSTED_PROXIES empty)', () => {
    let api: Awaited<ReturnType<typeof startApp>>;

    beforeAll(async () => {
      api = await startApp();
    });

    afterAll(() => api.app.close());

    afterEach(() => {
      jest.useRealTimers();
    });

    /** Uses up `from`'s 10 sign-ins on `email` (the first succeeds, so its session shows the IP). */
    const useUpSignIns = async (from: string, email: string) => {
      expect((await api.signIn(from, email)).status).toBe(200);
      for (let attempt = 2; attempt <= 10; attempt++) {
        expect((await api.signIn(from, email, WRONG)).status).toBe(401);
      }
    };

    it('AC-01.7.1 the 11th sign-in from one address → 429 with X-Retry-After, before any credential check', async () => {
      const client = nextLoopback();
      const email = freshEmail();
      await api.signUp(client, email);
      await useUpSignIns(client, email);
      expect(await sessionIp(email)).toEqual([client]); // resolved from the socket, not 127.0.0.1
      api.verify.mockClear();

      const eleventh = await api.signIn(client, email);

      expectThrottled(eleventh);
      expect(api.verify).not.toHaveBeenCalled();
    });

    it('AC-01.7.1 buckets are per endpoint: sign-up from a throttled address is still accepted', async () => {
      const client = nextLoopback();
      const email = freshEmail();
      await api.signUp(client, email);
      await useUpSignIns(client, email);
      expectThrottled(await api.signIn(client, email));

      expect((await api.signUp(client, freshEmail())).status).toBe(200);
    });

    it('AC-01.7.1 sign-up and sign-out have their own 10/min buckets too', async () => {
      const client = nextLoopback();
      for (let attempt = 1; attempt <= 10; attempt++) {
        expect((await api.signUp(client, freshEmail())).status).toBe(200);
        expect(
          (await api.call(client, 'POST', '/sign-out', { body: {} })).status,
        ).toBeLessThan(429);
      }

      expectThrottled(await api.signUp(client, freshEmail()));
      expectThrottled(
        await api.call(client, 'POST', '/sign-out', { body: {} }),
      );
    });

    it('AC-01.7.2 once the window has passed, the address is accepted again', async () => {
      jest.useFakeTimers({
        now: Date.now(),
        // Only the clock moves: sockets, the pg driver and Nest keep their real timers.
        doNotFake: [
          'hrtime',
          'nextTick',
          'performance',
          'queueMicrotask',
          'setImmediate',
          'clearImmediate',
          'setInterval',
          'clearInterval',
          'setTimeout',
          'clearTimeout',
        ],
      });
      const client = nextLoopback();
      const email = freshEmail();
      await api.signUp(client, email);
      await useUpSignIns(client, email);
      expectThrottled(await api.signIn(client, email));

      jest.setSystemTime(Date.now() + 61_000);

      expect((await api.signIn(client, email)).status).toBe(200);
    });

    it('AC-01.7.6 a throttled client stays throttled when it sends x-tt-client-ip or a rotating X-Forwarded-For', async () => {
      const client = nextLoopback();
      const email = freshEmail();
      await api.signUp(client, email);
      await useUpSignIns(client, email);

      for (let attempt = 0; attempt < 3; attempt++) {
        expectThrottled(
          await api.signIn(client, email, PASSWORD, {
            'x-tt-client-ip': nextForwarded(),
            'x-forwarded-for': nextForwarded(),
          }),
        );
      }
    });

    it('AC-01.7.6 a spoofed header never becomes the resolved address', async () => {
      const client = nextLoopback();
      const email = freshEmail();
      await api.signUp(client, email);

      await api.signIn(client, email, PASSWORD, {
        'x-tt-client-ip': '203.0.113.250',
        'x-forwarded-for': '203.0.113.251',
      });

      expect(await sessionIp(email)).toEqual([client]);
    });

    it('AC-01.7.8 client A throttled does not throttle client B (independent addresses)', async () => {
      const clientA = nextLoopback();
      const clientB = nextLoopback();
      const emailA = freshEmail();
      const emailB = freshEmail();
      await api.signUp(clientA, emailA);
      await api.signUp(clientB, emailB);
      await useUpSignIns(clientA, emailA);
      expectThrottled(await api.signIn(clientA, emailA));

      const fromB = await api.signIn(clientB, emailB);

      expect(fromB.status).toBe(200);
      expect(await sessionIp(emailB)).toEqual([clientB]);
    });

    it('AC-01.7.7 100 session checks per minute are accepted; the 101st → 429', async () => {
      const client = nextLoopback();
      for (let check = 1; check <= 100; check++) {
        expect((await api.call(client, 'GET', '/get-session')).status).toBe(
          200,
        );
      }

      expectThrottled(await api.call(client, 'GET', '/get-session'));
    });
  });

  describe('TRUSTED_PROXIES=127.0.0.1/32 (behind a reverse proxy)', () => {
    const PROXY = '127.0.0.1';
    let api: Awaited<ReturnType<typeof startApp>>;

    beforeAll(async () => {
      api = await startApp(['127.0.0.1/32']);
    });

    afterAll(() => api.app.close());

    it('AC-01.7.11 two clients forwarded by the trusted proxy are throttled independently', async () => {
      const clientX = nextForwarded();
      const clientY = nextForwarded();
      const emailX = freshEmail();
      const emailY = freshEmail();
      const via = (client: string) => ({ 'x-forwarded-for': client });
      await api.signUp(PROXY, emailX, via(clientX));
      await api.signUp(PROXY, emailY, via(clientY));
      expect(
        (await api.signIn(PROXY, emailX, PASSWORD, via(clientX))).status,
      ).toBe(200);
      for (let attempt = 2; attempt <= 10; attempt++) {
        await api.signIn(PROXY, emailX, WRONG, via(clientX));
      }

      expectThrottled(await api.signIn(PROXY, emailX, PASSWORD, via(clientX)));
      expect(
        (await api.signIn(PROXY, emailY, PASSWORD, via(clientY))).status,
      ).toBe(200);
      expect(await sessionIp(emailX)).toEqual([clientX]);
      expect(await sessionIp(emailY)).toEqual([clientY]);
    });

    it('AC-01.7.11 AC-01.7.6 the forwarded header from a connection outside the CIDRs is ignored', async () => {
      const outsider = nextLoopback();
      const email = freshEmail();
      await api.signUp(outsider, email);

      await api.signIn(outsider, email, PASSWORD, {
        'x-forwarded-for': nextForwarded(),
      });
      for (let attempt = 2; attempt <= 10; attempt++) {
        await api.signIn(outsider, email, WRONG, {
          'x-forwarded-for': nextForwarded(),
        });
      }

      expect(await sessionIp(email)).toEqual([outsider]);
      expectThrottled(
        await api.signIn(outsider, email, PASSWORD, {
          'x-forwarded-for': nextForwarded(),
        }),
      );
    });
  });
});
