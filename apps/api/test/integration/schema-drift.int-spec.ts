import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { useTestDatabase } from '../support/postgres';

const API_DIR = join(__dirname, '../..');

/**
 * The committed migrations and schema.prisma must describe the same database: after
 * `migrate deploy` (the template), `prisma migrate diff` to the schema is empty. A non-empty
 * diff means a model change without a migration, or a migration Prisma would "fix". Raw-SQL
 * objects Prisma cannot express (partial and expression indexes, CHECKs, the GIN index) are
 * invisible to the diff, which is why they live in migrations only.
 */
describe('Schema drift (integration)', () => {
  const db = useTestDatabase();

  it('has no difference between the migrated database and schema.prisma', () => {
    const prismaCli = require.resolve('prisma/build/index.js', {
      paths: [API_DIR],
    });
    const result = spawnSync(
      process.execPath,
      [
        prismaCli,
        'migrate',
        'diff',
        '--from-config-datasource',
        '--to-schema',
        'prisma/schema.prisma',
        '--script',
        '--exit-code',
      ],
      {
        cwd: API_DIR,
        env: { ...process.env, DATABASE_URL: db.url },
        encoding: 'utf8',
      },
    );

    // --exit-code: 0 = no difference, 2 = difference (the script shows it), 1 = error.
    expect({ status: result.status, diff: result.stdout.trim() }).toEqual({
      status: 0,
      diff: '-- This is an empty migration.',
    });
  });
});
