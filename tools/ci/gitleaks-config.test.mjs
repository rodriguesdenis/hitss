// Rule for fixtures and examples in this repo: build tokens, passwords and secret-looking values at
// RUNTIME with low entropy (e.g. 'prod-like-' + 'x'.repeat(40)); never commit a realistic literal.
// gitleaks and GitGuardian scan every PR, and the rules below fail on literals that look real.
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const config = fileURLToPath(new URL('../../.gitleaks.toml', import.meta.url));
const hasGitleaks = spawnSync('gitleaks', ['version']).status === 0;
const badge =
  '[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456';
// Built at runtime so this file does not itself look like a leaked secret.
const planted = ['AKIA', 'IOSFODNN7REALKEY'].join('');
const otherToken = ['Zk3pQ9xV7m', 'Lw2RtY8nBc4h'].join('');

// Passwords and URLs with credentials are assembled at runtime: no line of this file contains a
// literal user:password@ pair or the local placeholder password.
const localPassword = ['teams', 'local', 'only'].join('-');
const shortPassword = ['p', 'w'].join('');
const dbUrl = (scheme, user, password, rest) =>
  [scheme, '://', user, ':', password, '@', rest].join('');

const workdirs = [];
/** Exit code of `gitleaks dir` over a file (default: the API README) holding the given lines. */
function scan(lines, file = 'apps/api/README.md') {
  const dir = mkdtempSync(join(tmpdir(), 'gitleaks-'));
  workdirs.push(dir);
  mkdirSync(dirname(join(dir, file)), { recursive: true });
  writeFileSync(join(dir, file), `${lines.join('\n')}\n`);
  return spawnSync('gitleaks', [
    'dir',
    '--no-banner',
    '--redact',
    '--config',
    config,
    dir,
  ]).status;
}

describe(
  'gitleaks config',
  {
    skip: !hasGitleaks && 'gitleaks not installed (runs in the CI secrets job)',
  },
  () => {
    after(() =>
      workdirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })),
    );

    it('AC-07.6.7 allows the known Nest badge URL', () => {
      assert.equal(scan([badge]), 0);
    });

    it('AC-07.6.7 still detects a real key planted in apps/api/README.md', () => {
      assert.equal(scan([badge, `aws_access_key_id = ${planted}`]), 1);
    });

    it('AC-07.6.7 does not allowlist other tokens on the same badge host', () => {
      assert.equal(
        scan([
          `[x]: https://img.shields.io/circleci/build/github/acme/app/master?token=${otherToken}`,
        ]),
        1,
      );
    });

    // GitGuardian flagged a fixture like this once and the default rules missed it.
    const fixtureSecret = [
      'prod-like-secret-',
      '9d2f61c07b4e',
      '8a35f1c6d0e2b7a94831',
    ].join('');

    it('AC-07.9.1 detects a high-entropy secret assigned in a test fixture', () => {
      assert.equal(scan([`  BETTER_AUTH_SECRET: '${fixtureSecret}',`]), 1);
    });

    it('AC-07.9.1 detects it in a double-quoted assignment too', () => {
      assert.equal(scan([`const apiToken = "${fixtureSecret}";`]), 1);
    });

    it('AC-07.9.1 allows low-entropy fixtures built at runtime', () => {
      assert.equal(
        scan(["  BETTER_AUTH_SECRET: `prod-like-${'x'.repeat(40)}`,"]),
        0,
      );
    });

    it('AC-07.9.1 allows the documented placeholder prefixes', () => {
      assert.equal(
        scan([
          "process.env.BETTER_AUTH_SECRET = 'unit-test-secret-0123456789abcdef0123456789';",
          "  BETTER_AUTH_SECRET: 'local-dev-secret-change-me-0123456789abcdef',",
        ]),
        0,
      );
    });

    const urlPassword = ['Zk3pQ9xV', '7mLw2R'].join('');

    it('AC-07.9.1 detects a template-literal (backtick) secret assignment', () => {
      assert.equal(scan([`const apiToken = \`${fixtureSecret}\`;`]), 1);
    });

    it('AC-07.9.1 does not flag a template literal that interpolates a runtime value', () => {
      assert.equal(scan(['const apiToken = `prod-like-${suffix}`;']), 0);
    });

    it('AC-07.9.1 detects credential- and auth-named assignments', () => {
      assert.equal(scan([`const dbCredential = '${fixtureSecret}';`]), 1);
      assert.equal(scan([`const authHeader = '${fixtureSecret}';`]), 1);
    });

    it('AC-07.9.1 detects unquoted secrets in .env, YAML and compose files', () => {
      assert.equal(
        scan([`BETTER_AUTH_SECRET=${fixtureSecret}`], '.env.production'),
        1,
      );
      assert.equal(
        scan([`    BETTER_AUTH_SECRET: ${fixtureSecret}`], 'compose.yml'),
        1,
      );
      assert.equal(
        scan(
          [`      - BETTER_AUTH_SECRET=${fixtureSecret}`],
          'docker-compose.yml',
        ),
        1,
      );
    });

    it('AC-07.9.1 allows placeholders and variable references in env-style files', () => {
      assert.equal(
        scan(
          [
            'BETTER_AUTH_SECRET=local-dev-secret-change-me-0123456789abcdef',
            '    BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET:-local-dev-secret-change-me-0123456789abcdef}',
            `    POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-${localPassword}}`,
          ],
          'docker-compose.yml',
        ),
        0,
      );
    });

    it('AC-07.9.1 detects a password embedded in a connection URL', () => {
      assert.equal(
        scan(
          [
            `DATABASE_URL: ${dbUrl('postgresql', 'app', urlPassword, 'db.internal:5432/app')}`,
          ],
          'config.yml',
        ),
        1,
      );
      assert.equal(
        scan(
          [
            `const url = '${dbUrl('postgres', 'app', urlPassword, 'db.internal/app')}';`,
          ],
          'src/a.ts',
        ),
        1,
      );
    });

    it('AC-07.9.1 allows the documented local placeholder and templated URLs', () => {
      assert.equal(
        scan(
          [
            `DATABASE_URL=${dbUrl('postgresql', 'teams', localPassword, 'localhost:5432/teams_tasks')}`,
            `DATABASE_URL: ${dbUrl('postgresql', '\${POSTGRES_USER:-teams}', `\${POSTGRES_PASSWORD:-${localPassword}}`, 'postgres:5432/db')}`,
            `const url = '${dbUrl('postgresql', 'user', shortPassword, 'localhost:5432/db')}';`,
          ],
          'docker-compose.yml',
        ),
        0,
      );
    });
  },
);
