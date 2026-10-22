import { ChildProcess, execFileSync, spawn } from 'node:child_process';
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

describe('OpenTelemetry bootstrap (AC-08.7)', () => {
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
  const stop = async (app: Running) => {
    app.child.kill('SIGTERM');
    return app.exit;
  };
  const logLines = (app: Running) =>
    app
      .stdout()
      .split('\n')
      .filter((line) => line.startsWith('{'))
      .map((line) => JSON.parse(line) as Record<string, unknown>);

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
  beforeEach(() => {
    receiver.spans.length = 0;
    receiver.bodies.clear();
    receiver.requests = 0;
  });
  afterAll(async () => {
    running.forEach((a) => a.child.kill('SIGKILL'));
    await receiver.stop();
  });

  it('AC-06.2.2 AC-08.7 with the endpoint set, traces are exported over OTLP: the caller trace is continued and the database shows below it', async () => {
    const app = await launch({ OTEL_EXPORTER_OTLP_ENDPOINT: endpoint });
    const response = await get(app, {
      traceparent: `00-${TRACE_ID}-00f067aa0ba902b7-01`,
    });
    expect(response.status).toBe(200);
    await receiver.waitForSpans((spans) =>
      spans.some((s) => s.kind === 2 && s.traceId === TRACE_ID),
    );
    await receiver.waitForSpans(
      (spans) =>
        dbSpansBelow(spans, spans.find((s) => s.kind === 2)?.spanId).length > 0,
    );

    const server = receiver.spans.find((s) => s.kind === 2);
    expect(server?.traceId).toBe(TRACE_ID);
    expect(server?.parentSpanId).toBe('00f067aa0ba902b7');
    await stop(app);
  }, 60_000);

  it('AC-08.7 the completion log line carries reqId and the exported trace id', async () => {
    const app = await launch({ OTEL_EXPORTER_OTLP_ENDPOINT: endpoint });
    const response = await get(app, {
      traceparent: `00-${TRACE_ID}-00f067aa0ba902b7-01`,
    });
    expect(response.status).toBe(200);
    await stop(app);

    const completed = logLines(app).find((l) => l.msg === 'request completed');
    expect(completed).toMatchObject({ traceId: TRACE_ID });
    expect(completed?.reqId).toBe(response.headers.get('x-request-id'));
    expect(completed?.spanId).toMatch(/^[0-9a-f]{16}$/);
  }, 60_000);

  it('AC-08.7 without the endpoint nothing is exported, even with a per-signal endpoint set, and logs still carry reqId and traceId', async () => {
    const app = await launch({
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: `${endpoint}/v1/traces`,
    });
    const response = await get(app);
    expect(response.status).toBe(200);
    // Batches flush every 5 s by default: wait past it before judging "nothing".
    await new Promise((resolve) => setTimeout(resolve, 6_000));
    await stop(app);

    expect(receiver.requests).toBe(0);
    const completed = logLines(app).find((l) => l.msg === 'request completed');
    expect(completed?.reqId).toBe(response.headers.get('x-request-id'));
    expect(completed?.traceId).toBe(completed?.reqId);
  }, 60_000);

  it('AC-08.7 OTEL_SDK_DISABLED=true exports nothing even with the endpoint set', async () => {
    const app = await launch({
      OTEL_EXPORTER_OTLP_ENDPOINT: endpoint,
      OTEL_SDK_DISABLED: 'true',
      OTEL_BSP_SCHEDULE_DELAY: '500',
    });
    expect((await get(app)).status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    await stop(app);
    expect(receiver.requests).toBe(0);
  }, 60_000);

  it('AC-06.5.1 AC-08.7 an unreachable collector never stops the API: it starts and answers 2xx', async () => {
    const app = await launch({
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://127.0.0.1:1',
    });
    for (let i = 0; i < 3; i++) expect((await get(app)).status).toBe(200);
    await stop(app);
  }, 60_000);

  it('AC-08.7 an invalid OTEL_EXPORTER_OTLP_ENDPOINT stops start-up naming the variable', async () => {
    const app = start({ OTEL_EXPORTER_OTLP_ENDPOINT: 'not a url' });
    running.push(app);
    expect(await app.exit).not.toBe(0);
    expect(app.stderr()).toContain('OTEL_EXPORTER_OTLP_ENDPOINT');
    expect(app.stderr()).not.toContain('not a url');
  }, 60_000);

  it('AC-06.5.4 SIGTERM stops the API with exit code 0 (docker stop)', async () => {
    const app = await launch({});
    expect((await get(app)).status).toBe(200);
    expect(await stop(app)).toBe(0);
  }, 60_000);
});
