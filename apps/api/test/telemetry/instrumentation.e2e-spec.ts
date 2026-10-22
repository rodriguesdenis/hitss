import { ChildProcess, execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { join } from 'node:path';
import { useTestDatabase } from '../support/postgres';
import { OtlpReceiver, ReceivedSpan } from './otlp-receiver';

const API_DIR = join(__dirname, '../..');
/** The fixture is compiled once: the generated Prisma client cannot run through ts-node. */
const BUILD_DIR = join(API_DIR, 'node_modules/.cache/telemetry-e2e');
const TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';

interface Running {
  child: ChildProcess;
  port: number;
  stderr: () => string;
  stdout: () => string;
  exit: Promise<number | null>;
}

let currentDatabaseUrl: () => string;
let nextPort = 39100 + Math.floor(Math.random() * 400);

function start(env: Record<string, string>): Running {
  const databaseUrl = currentDatabaseUrl();
  const port = nextPort++;
  const child = spawn(
    process.execPath,
    [
      '-r',
      join(BUILD_DIR, 'src/instrumentation.js'),
      join(BUILD_DIR, 'test/telemetry/fixture-app.js'),
    ],
    {
      cwd: API_DIR,
      env: {
        PATH: process.env.PATH,
        APP_ENV: 'test',
        DATABASE_URL: databaseUrl,
        BETTER_AUTH_SECRET: `unit-test-secret-${'x'.repeat(30)}`,
        PORT: String(port),
        OTEL_EXPORTER_OTLP_PROTOCOL: 'http/json',
        ...env,
      },
    },
  );
  let stderr = '';
  let stdout = '';
  child.stdout?.on('data', (d: Buffer) => (stdout += d.toString()));
  child.stderr?.on('data', (d: Buffer) => (stderr += d.toString()));
  const exit = new Promise<number | null>((resolve) =>
    child.on('exit', (code) => resolve(code)),
  );
  return { child, port, stderr: () => stderr, stdout: () => stdout, exit };
}

async function ready(app: Running): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    app.child.stdout?.on('data', (d: Buffer) => {
      if (d.toString().includes('READY')) resolve();
    });
    void app.exit.then(() =>
      reject(new Error(`exited before ready: ${app.stderr()}`)),
    );
  });
}

/** Spans with a db.system attribute that descend from the given span. */
function dbSpansBelow(spans: ReceivedSpan[], rootId: string | undefined) {
  const below = (span: ReceivedSpan): boolean => {
    const parent = spans.find((s) => s.spanId === span.parentSpanId);
    return parent ? parent.spanId === rootId || below(parent) : false;
  };
  const isDb = (s: ReceivedSpan) =>
    s.attributes.some(
      (a) => a.key === 'db.system' || a.key === 'db.system.name',
    );
  return spans.filter((s) => isDb(s) && below(s));
}

const get = (app: Running, headers: Record<string, string> = {}, query = '') =>
  fetch(`http://127.0.0.1:${app.port}/api/v1/ping${query}`, { headers });

interface MetricsPayload {
  resourceMetrics: {
    scopeMetrics: {
      metrics: {
        name: string;
        histogram: {
          dataPoints: {
            attributes: { key: string; value: Record<string, unknown> }[];
          }[];
        };
      }[];
    }[];
  }[];
}

describe('OpenTelemetry bootstrap', () => {
  const db = useTestDatabase();
  currentDatabaseUrl = () => db.url;
  const receiver = new OtlpReceiver();
  const running: Running[] = [];
  let endpoint: string;

  const launch = async (env: Record<string, string>) => {
    const app = start(env);
    running.push(app);
    await ready(app);
    return app;
  };

  beforeAll(async () => {
    execFileSync(
      process.execPath,
      [
        require.resolve('typescript/bin/tsc'),
        '-p',
        join(__dirname, 'tsconfig.json'),
      ],
      { cwd: API_DIR },
    );
    endpoint = await receiver.start();
  });
  afterAll(async () => {
    running.forEach((a) => a.child.kill('SIGKILL'));
    await receiver.stop();
  });

  it('AC-06.2.1 AC-06.2.2 AC-06.2.6 AC-06.5.4 flushes spans on SIGTERM, continues the caller trace and exits 0', async () => {
    receiver.spans.length = 0;
    receiver.resources.length = 0;
    const app = await launch({ OTEL_EXPORTER_OTLP_ENDPOINT: endpoint });
    const response = await get(app, {
      traceparent: `00-${TRACE_ID}-00f067aa0ba902b7-01`,
    });
    expect(response.status).toBe(200);

    app.child.kill('SIGTERM');
    const started = Date.now();
    expect(await app.exit).toBe(0);
    expect(Date.now() - started).toBeLessThan(10_000);

    const server = receiver.spans.find((s) => s.kind === 2);
    expect(server?.traceId).toBe(TRACE_ID);
    expect(server?.parentSpanId).toBe('00f067aa0ba902b7');
    expect(dbSpansBelow(receiver.spans, server?.spanId)).not.toHaveLength(0);
    const attributes = Object.fromEntries(
      (receiver.resources[0]?.attributes ?? []).map((a) => [
        a.key,
        a.value.stringValue,
      ]),
    );
    expect(attributes).toMatchObject({
      'service.name': 'teams-tasks-api',
      'deployment.environment.name': 'test',
    });
    expect(attributes['service.version']).toBeDefined();
  }, 60_000);

  it('AC-06.2.5 exports no query string in any span attribute', async () => {
    receiver.spans.length = 0;
    receiver.bodies.clear();
    const app = await launch({ OTEL_EXPORTER_OTLP_ENDPOINT: endpoint });
    expect(
      (await get(app, {}, '?token=secret-value&search=marina')).status,
    ).toBe(200);
    app.child.kill('SIGTERM');
    await app.exit;

    const exported = JSON.stringify(receiver.spans);
    expect(exported).toContain('/ping');
    expect(exported).not.toContain('secret-value');
    expect(exported).not.toContain('marina');
    // Metrics are flushed on shutdown; no log pipeline exists at all (T-006-02 decides on one).
    const metrics = (receiver.bodies.get('/v1/metrics') ?? []).join('');
    expect(metrics).not.toContain('secret-value');
    expect(metrics).not.toContain('marina');
    expect(receiver.bodies.has('/v1/logs')).toBe(false);
  }, 60_000);

  it('AC-06.2.5 the resource carries no process command line, owner or host id', async () => {
    receiver.resources.length = 0;
    const app = await launch({ OTEL_EXPORTER_OTLP_ENDPOINT: endpoint });
    await get(app);
    app.child.kill('SIGTERM');
    await app.exit;

    const keys = receiver.resources.flatMap((r) =>
      r.attributes.map((a) => a.key),
    );
    for (const key of [
      'process.command_args',
      'process.command',
      'process.executable.path',
      'process.owner',
      'host.id',
      'host.name',
    ]) {
      expect(keys).not.toContain(key);
    }
  }, 60_000);

  it('AC-06.3.1 AC-06.3.3 AC-06.3.7 logs go to stdout only, correlated and free of secrets, and no OTLP log pipeline exists', async () => {
    receiver.bodies.clear();
    const app = await launch({
      OTEL_EXPORTER_OTLP_ENDPOINT: endpoint,
      LOG_LEVEL: 'trace',
    });
    const response = await get(
      app,
      {
        traceparent: `00-${TRACE_ID}-00f067aa0ba902b7-01`,
        authorization: 'Bearer token-value-abcdef',
        cookie: 'session=cookie-value-abcdef',
      },
      '?token=secret-value&search=marina',
    );
    expect(response.status).toBe(200);
    app.child.kill('SIGTERM');
    expect(await app.exit).toBe(0);

    expect(receiver.bodies.has('/v1/logs')).toBe(false);
    const stdout = app.stdout();
    for (const forbidden of [
      'secret-value',
      'marina',
      'Bearer',
      'token-value-abcdef',
      'cookie-value-abcdef',
    ]) {
      expect(stdout).not.toContain(forbidden);
    }
    const entries = stdout
      .split('\n')
      .filter((line) => line.startsWith('{'))
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const completed = entries.filter((e) => e.msg === 'request completed');
    expect(completed).toHaveLength(1);
    expect(completed[0]).toMatchObject({
      traceId: TRACE_ID,
      route: '/api/v1/ping',
      req: { method: 'GET', url: '/api/v1/ping' },
      res: { statusCode: 200 },
    });
    expect(completed[0]?.spanId).toMatch(/^[0-9a-f]{16}$/);
    // One correlation source: only the traceFields mixin, no OpenTelemetry pino injection.
    for (const entry of entries) {
      for (const field of ['trace_id', 'span_id', 'trace_flags']) {
        expect(entry).not.toHaveProperty(field);
      }
    }
    expect(response.headers.get('x-request-id')).toBe(completed[0]?.reqId);
  }, 60_000);

  it('AC-06.4.1 AC-06.4.4 exports the request duration by method, route template and status only', async () => {
    receiver.bodies.clear();
    const app = await launch({ OTEL_EXPORTER_OTLP_ENDPOINT: endpoint });
    // A client-chosen Host header must not become a metric dimension (server.address).
    const host = `host-${randomUUID()}.example.test`;
    expect(
      await new Promise<number>((resolve, reject) => {
        httpRequest(
          {
            host: '127.0.0.1',
            port: app.port,
            path: '/ping?token=secret-value&search=marina',
            headers: { host },
          },
          (res) => {
            res.resume();
            res.on('end', () => resolve(res.statusCode ?? 0));
          },
        )
          .on('error', reject)
          .end();
      }),
    ).toBe(200);
    app.child.kill('SIGTERM');
    expect(await app.exit).toBe(0);

    const payloads = (receiver.bodies.get('/v1/metrics') ?? []).map(
      (body) => JSON.parse(body) as MetricsPayload,
    );
    const durations = payloads
      .flatMap((p) => p.resourceMetrics)
      .flatMap((r) => r.scopeMetrics)
      .flatMap((s) => s.metrics)
      .filter((m) => m.name === 'http.server.request.duration')
      .flatMap((m) => m.histogram.dataPoints);
    expect(durations.length).toBeGreaterThan(0);

    for (const point of durations) {
      expect(point.attributes.map((a) => a.key).sort()).toEqual([
        'http.request.method',
        'http.response.status_code',
        'http.route',
      ]);
    }
    const attributes = Object.fromEntries(
      durations[0]!.attributes.map((a) => [a.key, a.value]),
    );
    expect(attributes['http.request.method']).toEqual({ stringValue: 'GET' });
    // The global prefix and version of setupApp() are part of the template: /api/v1/ping.
    expect(attributes['http.route']).toEqual({ stringValue: '/api/v1/ping' });
    expect(attributes['http.response.status_code']).toEqual({ intValue: 200 });

    const exported = JSON.stringify(payloads);
    expect(exported).not.toContain(host);
    expect(exported).not.toContain('secret-value');
    expect(exported).not.toContain('marina');
    expect(exported).not.toContain('token=');
  }, 60_000);

  it('AC-06.5.1 starts and serves 2xx with no collector reachable', async () => {
    const app = await launch({
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://127.0.0.1:1',
    });
    for (let i = 0; i < 3; i++) expect((await get(app)).status).toBe(200);
    app.child.kill('SIGTERM');
    expect(await app.exit).toBe(0);
  }, 60_000);

  it('AC-06.5.3 exports nothing when OTEL_SDK_DISABLED=true', async () => {
    const before = receiver.requests;
    const app = await launch({
      OTEL_EXPORTER_OTLP_ENDPOINT: endpoint,
      OTEL_SDK_DISABLED: 'true',
    });
    expect((await get(app)).status).toBe(200);
    app.child.kill('SIGTERM');
    expect(await app.exit).toBe(0);
    expect(receiver.requests).toBe(before);
  }, 60_000);

  it('AC-06.5.5 an invalid OTEL_EXPORTER_OTLP_ENDPOINT stops start-up naming the variable', async () => {
    const app = start({ OTEL_EXPORTER_OTLP_ENDPOINT: 'not a url' });
    running.push(app);
    expect(await app.exit).not.toBe(0);
    expect(app.stderr()).toContain('OTEL_EXPORTER_OTLP_ENDPOINT');
    expect(app.stderr()).not.toContain('not a url');
  }, 60_000);
});
