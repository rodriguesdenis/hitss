import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('../../', import.meta.url));
const compose = parse(readFileSync(`${root}docker-compose.yml`, 'utf8'));
const env = compose.services.api.environment;

describe('docker-compose api environment', () => {
  it('AC-08.7 passes the telemetry endpoint through, empty (telemetry off) by default', () => {
    assert.equal(
      env.OTEL_EXPORTER_OTLP_ENDPOINT,
      '${OTEL_EXPORTER_OTLP_ENDPOINT:-}',
    );
  });

  it('AC-08.7 passes OTEL_SDK_DISABLED through with the default false', () => {
    assert.equal(env.OTEL_SDK_DISABLED, '${OTEL_SDK_DISABLED:-false}');
  });

  it('AC-06.3.1 passes LOG_LEVEL through with the default info', () => {
    assert.equal(env.LOG_LEVEL, '${LOG_LEVEL:-info}');
  });
});
