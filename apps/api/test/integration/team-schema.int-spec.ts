import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Client, DatabaseError } from 'pg';
import { PrismaService } from '../../src/shared/infrastructure/prisma/prisma.service';
import { createTestApp } from '../support/app';
import { useTestDatabase } from '../support/postgres';

const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';

describe('Team schema (integration, T-002-01)', () => {
  const db = useTestDatabase();
  let app: INestApplication;
  let prisma: PrismaService;
  let sql: Client;

  beforeAll(async () => {
    app = await createTestApp(db.url);
    prisma = app.get(PrismaService);
    sql = new Client({ connectionString: db.url });
    await sql.connect();
  });

  afterAll(async () => {
    await sql?.end();
    await app?.close();
  });

  async function aUser(): Promise<string> {
    const email = `owner-${randomUUID()}@example.test`;
    const { rows } = await sql.query<{ id: string }>(
      `INSERT INTO users (name, email, updated_at) VALUES ('Owner', $1, now()) RETURNING id`,
      [email],
    );
    return rows[0]!.id;
  }

  async function insertTeam(
    ownerId: string,
    name: string,
    extra: {
      colorHex?: string;
      version?: number;
      deletedAt?: Date;
      createdAt?: Date;
    } = {},
    client: Client = sql,
  ): Promise<string> {
    const id = randomUUID();
    await client.query(
      `INSERT INTO teams (id, owner_id, name, color_hex, version, created_at, updated_at, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6, $7)`,
      [
        id,
        ownerId,
        name,
        extra.colorHex ?? '#7C3AED',
        extra.version ?? 1,
        extra.createdAt ?? new Date(),
        extra.deletedAt ?? null,
      ],
    );
    return id;
  }

  async function sqlError(run: () => Promise<unknown>): Promise<DatabaseError> {
    try {
      await run();
    } catch (error) {
      if (error instanceof DatabaseError) return error;
      throw error;
    }
    throw new Error('expected a database error');
  }

  it('maps the Team model to the teams table (Prisma round trip)', async () => {
    const ownerId = await aUser();
    const id = randomUUID();
    const now = new Date('2026-10-20T12:00:00.000Z');

    await prisma.team.create({
      data: {
        id,
        ownerId,
        name: 'Mobile',
        colorHex: '#7C3AED',
        createdAt: now,
        updatedAt: now,
      },
    });

    await expect(
      prisma.team.findUniqueOrThrow({ where: { id } }),
    ).resolves.toMatchObject({
      id,
      ownerId,
      name: 'Mobile',
      colorHex: '#7C3AED',
      description: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  });

  it('AC-02.1.5 rejects two active teams of one owner whose names differ only in case', async () => {
    const ownerId = await aUser();
    await insertTeam(ownerId, 'Mobile');

    const error = await sqlError(() => insertTeam(ownerId, 'MOBILE'));

    expect(error.code).toBe(UNIQUE_VIOLATION);
    expect(error.constraint).toBe('teams_owner_id_lower_name_key');
  });

  it('AC-02.1.7 allows reusing the name of a soft-deleted team', async () => {
    const ownerId = await aUser();
    await insertTeam(ownerId, 'Mobile', { deletedAt: new Date() });

    await expect(insertTeam(ownerId, 'mobile')).resolves.toEqual(
      expect.any(String),
    );
  });

  it('allows the same team name for different owners', async () => {
    const [first, second] = [await aUser(), await aUser()];
    await insertTeam(first, 'Backend');

    await expect(insertTeam(second, 'Backend')).resolves.toEqual(
      expect.any(String),
    );
  });

  it('AC-02.1.9 lets exactly one of two concurrent creates with the same name win', async () => {
    const ownerId = await aUser();
    const [first, second] = [
      new Client({ connectionString: db.url }),
      new Client({ connectionString: db.url }),
    ];
    await Promise.all([first.connect(), second.connect()]);
    try {
      await first.query('BEGIN');
      await insertTeam(ownerId, 'Design', {}, first);
      // The second insert blocks on the first transaction's uncommitted index entry...
      const racing = sqlError(() => insertTeam(ownerId, 'design', {}, second));
      await first.query('COMMIT');

      // ...and fails once the first commits.
      const error = await racing;
      expect(error.code).toBe(UNIQUE_VIOLATION);
      expect(error.constraint).toBe('teams_owner_id_lower_name_key');
      const { rows } = await sql.query(
        'SELECT 1 FROM teams WHERE owner_id = $1 AND lower(name) = $2',
        [ownerId, 'design'],
      );
      expect(rows).toHaveLength(1);
    } finally {
      await Promise.all([first.end(), second.end()]);
    }
  });

  it.each(['#7c3aed', '7C3AED', '#7C3AE', '#GGGGGG'])(
    'rejects the non-normalized color %s (teams_color_hex_format)',
    async (colorHex) => {
      const ownerId = await aUser();

      const error = await sqlError(() =>
        insertTeam(ownerId, 'Colors', { colorHex }),
      );

      expect(error.code).toBe(CHECK_VIOLATION);
      expect(error.constraint).toBe('teams_color_hex_format');
    },
  );

  it('rejects a version below 1 (teams_version_positive)', async () => {
    const ownerId = await aUser();

    const error = await sqlError(() =>
      insertTeam(ownerId, 'Versioned', { version: 0 }),
    );

    expect(error.code).toBe(CHECK_VIOLATION);
    expect(error.constraint).toBe('teams_version_positive');
  });

  it('deletes the teams of a deleted user (ON DELETE CASCADE)', async () => {
    const ownerId = await aUser();
    await insertTeam(ownerId, 'Gone');

    await sql.query('DELETE FROM users WHERE id = $1', [ownerId]);

    const { rows } = await sql.query(
      'SELECT 1 FROM teams WHERE owner_id = $1',
      [ownerId],
    );
    expect(rows).toHaveLength(0);
  });

  it('serves the default list query (-createdAt, id) from teams_owner_id_created_at_idx', async () => {
    const owners = await Promise.all(Array.from({ length: 5 }, () => aUser()));
    await sql.query(
      `INSERT INTO teams (id, owner_id, name, color_hex, created_at, updated_at, deleted_at)
       SELECT gen_random_uuid(), o.id, 'Team ' || g, '#0EA5E9',
              now() - g * interval '1 minute', now(),
              CASE WHEN g % 10 = 0 THEN now() END
       FROM unnest($1::text[]) AS o(id), generate_series(1, 400) AS g`,
      [owners],
    );
    await sql.query('ANALYZE teams');

    const { rows } = await sql.query<{ 'QUERY PLAN': unknown }>(
      `EXPLAIN (FORMAT JSON)
       SELECT id, name, color_hex, description, version, created_at, updated_at
       FROM teams
       WHERE owner_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC, id DESC
       LIMIT 20 OFFSET 0`,
      [owners[0]],
    );
    const plan = JSON.stringify(rows[0]?.['QUERY PLAN']);

    expect(plan).toContain('"Index Name":"teams_owner_id_created_at_idx"');
    expect(plan).not.toContain('"Node Type":"Sort"');
  });
});
