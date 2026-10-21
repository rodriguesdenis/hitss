import { ChildProcess, spawn } from 'node:child_process';
import { join } from 'node:path';
import { OtlpReceiver } from './otlp-receiver';

const API_DIR = join(__dirname, '../..');
const TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';

interface Running {
  child: ChildProcess;
  port: number;
  stderr: () => string;
  exit: Promise<number | null>;
}

let nextPort = 39100 + Math.floor(Math.random() * 400);

function start(env: Record<string, string>): Running {
  const port = nextPort++;
  const child = spawn(
    process.execPath,
    [
      '-r',
      'ts-node/register/transpile-only',
      '-r',
      './src/instrumentation.ts',
      './test/telemetry/fixture-app.ts',
    ],
    {
      cwd: API_DIR,
      env: {
        PATH: process.env.PATH,
        APP_ENV: 'test',
        PORT: String(port),
        OTEL_EXPORTER_OTLP_PROTOCOL: 'http/json',
        ...env,
      },
    },
  );
  let stderr = '';
  child.stderr?.on('data', (d: Buffer) => (stderr += d.toString()));
  const exit = new Promise<number | null>((resolve) =>
    child.on('exit', (code) => resolve(code)),
  );
  return { child, port, stderr: () => stderr, exit };
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

const get = (app: Running, headers: Record<string, string> = {}, query = '') =>
  fetch(`http://127.0.0.1:${app.port}/ping${query}`, { headers });

describe('OpenTelemetry bootstrap', () => {
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
    const child = receiver.spans.find((s) => s.name === 'fixture.db');
    expect(server?.traceId).toBe(TRACE_ID);
    expect(child?.traceId).toBe(TRACE_ID);
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
