import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
// `docker compose config` resolves interpolation and anchors, so the test sees what compose runs.
const rendered = spawnSync(
  'docker',
  ['compose', 'config', '--format', 'json'],
  { cwd: root, encoding: 'utf8' },
);
const hasCompose = rendered.status === 0;
const compose = hasCompose ? JSON.parse(rendered.stdout) : { services: {} };
const dockerfile = readFileSync(`${root}apps/api/Dockerfile`, 'utf8');
const { migrate, api, postgres } = compose.services;

describe(
  'one-shot migrate service',
  { skip: !hasCompose && 'docker compose not available' },
  () => {
    it('AC-07.1.7 migrate builds the migrator target and waits for a healthy postgres', () => {
      assert.equal(migrate.build.target, 'migrator');
      assert.equal(migrate.depends_on.postgres.condition, 'service_healthy');
      assert.equal(migrate.restart, 'no');
      assert.ok(postgres.healthcheck);
    });

    it('AC-07.1.7 the api starts only after migrate completed successfully', () => {
      assert.equal(
        api.depends_on.migrate.condition,
        'service_completed_successfully',
      );
    });

    it('AC-07.1.4 migrate gets the POSTGRES_* parts, not a DATABASE_URL', () => {
      assert.equal(migrate.environment.DATABASE_URL, undefined);
      for (const name of [
        'POSTGRES_USER',
        'POSTGRES_PASSWORD',
        'POSTGRES_HOST',
        'POSTGRES_PORT',
        'POSTGRES_DB',
      ]) {
        assert.ok(migrate.environment[name] !== undefined, `${name} missing`);
        assert.equal(
          String(migrate.environment[name]),
          String(api.environment[name]),
          `${name} differs from the api`,
        );
      }
    });

    it('AC-07.1.6 the runtime stage ships no Prisma CLI, schema or migrations', () => {
      const runtime = dockerfile.slice(dockerfile.indexOf('AS runtime'));
      assert.ok(
        !/prisma/i.test(runtime.replace(/#.*$/gm, '')),
        'runtime stage mentions prisma',
      );
    });

    it('AC-07.1.6 the prod-deps stage fails the build if the CLI, its engines, typescript or a prisma binary remain', () => {
      const stage = dockerfile.slice(
        dockerfile.indexOf('AS prod-deps'),
        dockerfile.indexOf('AS runtime'),
      );
      assert.ok(
        stage.includes('^(prisma|@prisma\\+engines|typescript)@'),
        'package assertion missing',
      );
      assert.ok(
        stage.includes('/out/node_modules/.bin/prisma'),
        'binary assertion missing',
      );
    });
  },
);
