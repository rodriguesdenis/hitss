import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Client, DatabaseError } from 'pg';
import { PrismaService } from '../../src/shared/infrastructure/prisma/prisma.service';
import { createTestApp } from '../support/app';
import { useTestDatabase } from '../support/postgres';

const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';
const STRING_TOO_LONG = '22001';

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
      description?: string;
      version?: number;
      deletedAt?: Date;
      createdAt?: Date;
    } = {},
    client: Client = sql,
  ): Promise<string> {
    const id = randomUUID();
    await client.query(
      `INSERT INTO teams (id, owner_id, name, color_hex, description, version, created_at, updated_at, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8)`,
      [
        id,
        ownerId,
        name,
        extra.colorHex ?? '#7C3AED',
        extra.description ?? null,
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

  it('AC-02.1.7 allows two soft-deleted teams with the same name', async () => {
    const ownerId = await aUser();
    const deletedAt = new Date();

    await expect(
      insertTeam(ownerId, 'Archive', { deletedAt }),
    ).resolves.toEqual(expect.any(String));
    await expect(
      insertTeam(ownerId, 'archive', { deletedAt }),
    ).resolves.toEqual(expect.any(String));
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
      const { rows: pid } = await second.query<{ pid: number }>(
        'SELECT pg_backend_pid() AS pid',
      );
      await first.query('BEGIN');
      await insertTeam(ownerId, 'Design', {}, first);
      const racing = sqlError(() => insertTeam(ownerId, 'design', {}, second));

      // Commit only once the second insert is provably blocked on the first's index entry.
      await waitForLockWait(pid[0]!.pid);
      await first.query('COMMIT');

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

  /** Polls pg_stat_activity (bounded, no fixed sleep) until the backend waits on a lock. */
  async function waitForLockWait(pid: number): Promise<void> {
    for (let attempt = 0; attempt < 500; attempt++) {
      const { rows } = await sql.query<{ wait_event_type: string | null }>(
        'SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1',
        [pid],
      );
      if (rows[0]?.wait_event_type === 'Lock') return;
      await new Promise((resolve) => setImmediate(resolve));
    }
    throw new Error(`backend ${pid} never waited on a lock`);
  }

  it.each(['#7C3AED0', '#7C3AED\n'])(
    'rejects the over-long color %j (char(7))',
    async (colorHex) => {
      const ownerId = await aUser();

      const error = await sqlError(() =>
        insertTeam(ownerId, 'Colors', { colorHex }),
      );

      expect(error.code).toBe(STRING_TOO_LONG);
    },
  );

  it('rejects a 51-character name (varchar(50))', async () => {
    const ownerId = await aUser();

    const error = await sqlError(() => insertTeam(ownerId, 'n'.repeat(51)));

    expect(error.code).toBe(STRING_TOO_LONG);
  });

  it('rejects a 281-character description (varchar(280))', async () => {
    const ownerId = await aUser();

    const error = await sqlError(() =>
      insertTeam(ownerId, 'Described', { description: 'd'.repeat(281) }),
    );

    expect(error.code).toBe(STRING_TOO_LONG);
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

  it.each([0, -1])(
    'rejects version %i (teams_version_positive)',
    async (version) => {
      const ownerId = await aUser();

      const error = await sqlError(() =>
        insertTeam(ownerId, 'Versioned', { version }),
      );

      expect(error.code).toBe(CHECK_VIOLATION);
      expect(error.constraint).toBe('teams_version_positive');
    },
  );

  it('rejects updated_at before created_at (teams_updated_after_created)', async () => {
    const ownerId = await aUser();

    const error = await sqlError(() =>
      sql.query(
        `INSERT INTO teams (id, owner_id, name, color_hex, created_at, updated_at)
         VALUES ($1, $2, 'Clock', '#7C3AED', $3, $3::timestamptz - interval '1 millisecond')`,
        [randomUUID(), ownerId, new Date()],
      ),
    );

    expect(error.code).toBe(CHECK_VIOLATION);
    expect(error.constraint).toBe('teams_updated_after_created');
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
    // Without sequential scans the planner must pick an index; the assertion is about which
    // one and whether it still has to sort.
    await sql.query('SET enable_seqscan = off');

    const { rows } = await sql.query<{ 'QUERY PLAN': unknown }>(
      `EXPLAIN (ANALYZE, FORMAT JSON)
       SELECT id, name, color_hex, description, version, created_at, updated_at
       FROM teams
       WHERE owner_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC, id DESC
       LIMIT 20 OFFSET 0`,
      [owners[0]],
    );
    await sql.query('RESET enable_seqscan');
    const plan = JSON.stringify(rows[0]?.['QUERY PLAN']);

    expect(plan).toContain('"Index Name":"teams_owner_id_created_at_idx"');
    expect(plan).not.toContain('"Node Type":"Sort"');
    expect(plan).not.toContain('"Node Type":"Incremental Sort"');
  });
});
