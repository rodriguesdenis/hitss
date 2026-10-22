import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const API_DIR = join(__dirname, '../..');
const PROBE_TIMEOUT_MS = 90_000;

export interface ProbeResult {
  status: number | null;
  output: string;
}

export function runProbeInTimeZone(
  probe: string,
  zone: string,
  env: Record<string, string> = {},
): ProbeResult {
  const jest = require.resolve('jest/bin/jest', { paths: [API_DIR] });
  const result = spawnSync(
    process.execPath,
    [
      jest,
      '--selectProjects',
      'tz-probe',
      '--runInBand',
      '--ci',
      join('test/probes', probe),
    ],
    {
      cwd: API_DIR,
      env: { ...process.env, ...env, TZ: zone, CI: '' },
      encoding: 'utf8',
      timeout: PROBE_TIMEOUT_MS,
    },
  );
  const timedOut = result.error ? `\n${result.error.message}` : '';
  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}${timedOut}`,
  };
}

export function expectProbePassed(result: ProbeResult): void {
  if (result.status !== 0) {
    throw new Error(
      `time-zone probe failed (exit ${String(result.status)}):\n${result.output}`,
    );
  }
}
