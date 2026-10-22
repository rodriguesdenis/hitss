import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./compose-smoke.sh', import.meta.url));
const source = readFileSync(script, 'utf8');

describe('compose smoke script', () => {
  it('AC-07.6.8 is valid bash and executable', () => {
    assert.equal(spawnSync('bash', ['-n', script]).status, 0);
    assert.ok(statSync(script).mode & 0o111, 'not executable');
  });

  it('AC-07.6.8 fails on the first error and always tears the stack down', () => {
    assert.match(source, /set -euo pipefail/);
    assert.match(source, /trap .*EXIT/);
    assert.match(source, /down -v/);
  });

  it('AC-07.1.1 starts the stack with the one documented command from scratch', () => {
    assert.match(source, /up -d --build --wait/);
  });

  it('AC-07.1.5 checks the API on a moved host port through API_PORT', () => {
    assert.match(source, /API_PORT=3100/);
  });

  it('AC-07.1.7 covers a failing migration and an unreachable database', () => {
    assert.match(source, /not-sql|NOT SQL/i);
    assert.match(
      source,
      /service_completed_successfully|never started|created/,
    );
    assert.match(source, /--no-deps/);
  });

  it('AC-07.1.6 checks the non-root user and the image contents', () => {
    assert.match(source, /id -u/);
    assert.match(source, /\.git/);
  });

  it('AC-07.1.6 asserts the image holds no tests folder under dist', () => {
    assert.match(source, /find dist -type d -name tests/);
  });

  it('AC-07.1.8 records the cold-start duration', () => {
    assert.match(source, /GITHUB_STEP_SUMMARY/);
    assert.match(source, /SECONDS|date \+%s/);
  });

  it('AC-07.1.7 never writes a literal credentials URL', () => {
    assert.ok(!/:\/\/[^/\s$]+:[^@\s$]{6,}@/.test(source));
  });

  it("AC-07.1.7 the unreachable-database checks reject timeout's own exit code and record the elapsed time", () => {
    assert.match(source, /124/);
    assert.match(source, /elapsed|ELAPSED/);
    assert.match(source, /expect_fast_failure/);
  });

  it('AC-07.1.7 both the migrator and the API are started against an unreachable database', () => {
    const calls = [...source.matchAll(/expect_fast_failure\s+(\w+)/g)].map(
      (m) => m[1],
    );
    assert.ok(calls.includes('migrate'), 'migrate case missing');
    assert.ok(calls.includes('api'), 'api case missing');
  });

  it('AC-08.7 proves telemetry is optional: no export without the endpoint, a trace with it', () => {
    assert.match(source, /otlp-sink\.mjs/);
    assert.match(source, /OTEL_EXPORTER_OTLP_ENDPOINT/);
    assert.match(source, /OTEL_EXPORTER_OTLP_TRACES_ENDPOINT/);
    assert.match(source, /TRACE_RECEIVED service=teams-tasks-api/);
    assert.match(source, /OTEL_SDK_DISABLED/);
  });

  it('AC-08.7 starts the sink from the Node image pinned in the API Dockerfile', () => {
    assert.match(source, /ARG NODE_IMAGE/);
    assert.ok(!/image:\s*node:24\b/.test(source), 'no floating node image');
  });
});
