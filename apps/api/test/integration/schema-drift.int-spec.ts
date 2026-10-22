import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { useTestDatabase } from '../support/postgres';

const API_DIR = join(__dirname, '../..');

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

    if (result.status !== 0) {
      throw new Error(
        `prisma migrate diff exited with ${String(result.status)}:\n${result.stdout}${result.stderr}`,
      );
    }
    expect(result.status).toBe(0);
  });
});
