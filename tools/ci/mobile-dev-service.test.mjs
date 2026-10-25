import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('../../', import.meta.url));
const compose = parse(readFileSync(`${root}docker-compose.yml`, 'utf8'));
const dockerfile = readFileSync(`${root}apps/mobile/Dockerfile.dev`, 'utf8');
const script = `${root}apps/mobile/docker-metro.sh`;
const mobile = compose.services.mobile;
const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8'));

function runMetro(env) {
  const bin = mkdtempSync(join(tmpdir(), 'metro-'));
  const pnpm = join(bin, 'pnpm');
  writeFileSync(pnpm, '#!/bin/sh\necho "pnpm $*"\n');
  chmodSync(pnpm, 0o755);
  return spawnSync('sh', [script], {
    encoding: 'utf8',
    env: { PATH: `${bin}:${process.env.PATH}`, ...env },
  });
}

describe('Mobile dev service (T-007-13)', () => {
  it('AC-07.5.3 the mobile service is behind the mobile profile, so docker compose up does not start it', () => {
    assert.deepEqual(mobile.profiles, ['mobile']);
    for (const [name, service] of Object.entries(compose.services)) {
      if (name !== 'mobile') assert.equal(service.profiles, undefined, name);
    }
  });

  it('AC-07.5.1 runs Metro in a terminal so Expo prints the QR, on port 8081', () => {
    assert.equal(mobile.tty, true);
    assert.equal(mobile.stdin_open, true);
    assert.deepEqual(mobile.ports, ['${METRO_BIND:-0.0.0.0}:8081:8081']);
    assert.equal(mobile.build.dockerfile, 'apps/mobile/Dockerfile.dev');
    assert.match(dockerfile, /^USER node$/m);
    assert.match(dockerfile, /^EXPOSE 8081$/m);
  });

  it('AC-07.5.2 the API address and the Metro mode come from .env or the shell, tunnel by default', () => {
    assert.equal(mobile.environment.EXPO_DEV_MODE, '${EXPO_DEV_MODE:-tunnel}');
    assert.equal(
      mobile.environment.EXPO_PUBLIC_API_URL,
      '${EXPO_PUBLIC_API_URL:-http://localhost:3000}',
    );
    assert.equal(
      mobile.environment.REACT_NATIVE_PACKAGER_HOSTNAME,
      '${REACT_NATIVE_PACKAGER_HOSTNAME:-}',
    );
  });

  it('AC-07.5.1 starts Expo with the tunnel by default', () => {
    const result = runMetro({});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      result.stdout.trim(),
      'pnpm exec expo start --port 8081 --tunnel',
    );
  });

  it('AC-07.5.2 lan mode starts with the advertised host and refuses to start without it', () => {
    const ok = runMetro({
      EXPO_DEV_MODE: 'lan',
      REACT_NATIVE_PACKAGER_HOSTNAME: '192.168.0.10',
    });
    assert.equal(ok.stdout.trim(), 'pnpm exec expo start --port 8081 --lan');
    const missing = runMetro({ EXPO_DEV_MODE: 'lan' });
    assert.equal(missing.status, 64);
    assert.match(missing.stderr, /REACT_NATIVE_PACKAGER_HOSTNAME/);
  });

  it('AC-07.5.2 an unknown mode stops with a clear message', () => {
    const result = runMetro({ EXPO_DEV_MODE: 'wifi' });
    assert.equal(result.status, 64);
    assert.match(
      result.stderr,
      /EXPO_DEV_MODE must be tunnel, lan or localhost/,
    );
    assert.equal(result.stdout, '');
  });

  it('keeps every .env file and the Expo cache out of the build context, in any directory', () => {
    const ignored = readFileSync(`${root}.dockerignore`, 'utf8').split('\n');
    for (const pattern of [
      '**/.env',
      '**/.env.*',
      '!**/.env.example',
      '**/.expo',
    ]) {
      assert.ok(ignored.includes(pattern), pattern);
    }
  });

  it('installs and runs as node, so Metro and NativeWind can write their caches in the workspace', () => {
    const lines = dockerfile.split('\n');
    const user = lines.findIndex((line) => line === 'USER node');
    const install = lines.findIndex((line) => /pnpm install/.test(line));
    assert.ok(
      user > -1 && user < install,
      'USER node comes before the install',
    );
    for (const line of lines.filter((l) => /^COPY .* \.\/?/.test(l))) {
      assert.match(line, /--chown=node:node/, line);
    }
    assert.doesNotMatch(dockerfile, /chown -R/);
  });

  it('activates the repo pnpm version at build time, so starting needs no download', () => {
    const version = pkg.packageManager.replace(/^pnpm@/, '');
    assert.match(
      dockerfile,
      new RegExp(
        `corepack prepare pnpm@${version.replaceAll('.', '\\.')} --activate`,
      ),
    );
    assert.match(dockerfile, /COREPACK_ENABLE_NETWORK=0/);
  });
});
