import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const sink = fileURLToPath(new URL('./otlp-sink.mjs', import.meta.url));
const PORT = 43180 + Math.floor(Math.random() * 500);

describe('OTLP sink used by the compose smoke', () => {
  let child;
  let output = '';

  before(async () => {
    child = spawn(process.execPath, [sink], {
      env: { PORT: String(PORT), PATH: process.env.PATH },
    });
    child.stdout.on('data', (chunk) => (output += chunk));
    for (let i = 0; i < 50; i += 1) {
      try {
        if ((await fetch(`http://127.0.0.1:${PORT}/`)).ok) return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    throw new Error('the sink did not start');
  });

  after(() => child?.kill());

  const post = (path, body) =>
    fetch(`http://127.0.0.1:${PORT}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-protobuf' },
      body,
    });

  it('AC-06.2.1 answers the health probe on /', async () => {
    assert.equal((await fetch(`http://127.0.0.1:${PORT}/`)).status, 200);
  });

  it('AC-06.2.6 logs a trace export that names the service teams-tasks-api', async () => {
    const response = await post(
      '/v1/traces',
      Buffer.from('\u000a\u0010service.name\u0012teams-tasks-api'),
    );
    assert.equal(response.status, 200);
    assert.match(output, /TRACE_RECEIVED service=teams-tasks-api bytes=\d+/);
  });

  it('AC-06.2.6 does not claim a trace for another service', async () => {
    output = '';
    await post('/v1/traces', Buffer.from('service.name other-service'));
    assert.ok(!output.includes('TRACE_RECEIVED'), output);
    assert.match(output, /OTHER_REQUEST path=\/v1\/traces/);
  });

  it('AC-06.2.1 accepts metrics exports without counting them as traces', async () => {
    output = '';
    const response = await post('/v1/metrics', Buffer.from('teams-tasks-api'));
    assert.equal(response.status, 200);
    assert.ok(!output.includes('TRACE_RECEIVED'), output);
  });

  it('AC-06.2.1 logs a metrics export that names the service as METRICS_RECEIVED', async () => {
    output = '';
    const response = await post(
      '/v1/metrics',
      Buffer.from('\u000aservice.name teams-tasks-api'),
    );
    assert.equal(response.status, 200);
    assert.match(output, /METRICS_RECEIVED service=teams-tasks-api bytes=\d+/);
    assert.ok(!output.includes('TRACE_RECEIVED'), output);
  });
});
