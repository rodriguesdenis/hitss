import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Client, DatabaseError } from 'pg';
import { PrismaService } from '../../src/shared/infrastructure/prisma/prisma.service';
import { createTestApp } from '../support/app';
import { useTestDatabase } from '../support/postgres';

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';
const CHECK_VIOLATION = '23514';
const STRING_TOO_LONG = '22001';
const INVALID_TEXT = '22P02';

interface TaskRow {
  title?: string;
  description?: string | null;
  status?: string;
  dueDate?: string | null;
  completedAt?: Date | null;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

describe('Tasks schema (integration, T-003-01)', () => {
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
    const { rows } = await sql.query<{ id: string }>(
      `INSERT INTO users (name, email) VALUES ('Owner', $1) RETURNING id`,
      [`owner-${randomUUID()}@example.test`],
    );
    return rows[0]!.id;
  }

  async function aTeam(ownerId: string): Promise<string> {
    const id = randomUUID();
    await sql.query(
      `INSERT INTO teams (id, owner_id, name, color_hex, created_at, updated_at)
       VALUES ($1, $2, $3, '#7C3AED', now(), now())`,
      [id, ownerId, `Team ${id.slice(0, 8)}`],
    );
    return id;
  }

  async function insertTask(
    ownerId: string,
    row: TaskRow = {},
  ): Promise<string> {
    const id = randomUUID();
    const createdAt = row.createdAt ?? new Date();
    await sql.query(
      `INSERT INTO tasks (id, owner_id, title, description, status, due_date, completed_at,
                          version, created_at, updated_at, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        ownerId,
        row.title ?? 'Write release notes',
        row.description ?? null,
        row.status ?? 'PENDING',
        row.dueDate ?? null,
        row.completedAt ?? null,
        row.version ?? 1,
        createdAt,
        row.updatedAt ?? createdAt,
        row.deletedAt ?? null,
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

  describe('task_status enum', () => {
    it('lists the statuses in lifecycle order (the status sort relies on it)', async () => {
      const { rows } = await sql.query<{ labels: string[] }>(
        'SELECT enum_range(NULL::task_status)::text[] AS labels',
      );

      expect(rows[0]!.labels).toEqual(['PENDING', 'IN_PROGRESS', 'DONE']);
    });

    it('rejects an unknown status', async () => {
      const ownerId = await aUser();

      const error = await sqlError(() =>
        insertTask(ownerId, { status: 'CANCELLED' }),
      );

      expect(error.code).toBe(INVALID_TEXT);
    });
  });

  it('maps Task and TaskTeam (Prisma round trip with teams)', async () => {
    const ownerId = await aUser();
    const [teamA, teamB] = [await aTeam(ownerId), await aTeam(ownerId)];
    const id = randomUUID();
    const at = new Date('2026-10-21T09:00:00.000Z');

    await prisma.task.create({
      data: {
        id,
        ownerId,
        title: 'Ship the login screen',
        description: 'Email and password',
        status: 'DONE',
        dueDate: new Date('2026-10-30T00:00:00.000Z'),
        completedAt: at,
        createdAt: at,
        updatedAt: at,
        teams: { create: [{ teamId: teamA }, { teamId: teamB }] },
      },
    });

    const task = await prisma.task.findUniqueOrThrow({
      where: { id },
      include: { teams: { orderBy: { teamId: 'asc' } } },
    });
    expect(task).toMatchObject({
      id,
      ownerId,
      title: 'Ship the login screen',
      description: 'Email and password',
      status: 'DONE',
      dueDate: new Date('2026-10-30T00:00:00.000Z'),
      completedAt: at,
      version: 1,
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
    });
    expect(task.teams.map((t) => t.teamId)).toEqual([teamA, teamB].sort());
  });

  describe('integrity checks', () => {
    it.each(['', 'ab'])(
      'rejects the title %j (tasks_title_len)',
      async (title) => {
        const ownerId = await aUser();

        const error = await sqlError(() => insertTask(ownerId, { title }));

        expect(error.code).toBe(CHECK_VIOLATION);
        expect(error.constraint).toBe('tasks_title_len');
      },
    );

    it('accepts titles of 3 and 120 characters', async () => {
      const ownerId = await aUser();

      await expect(insertTask(ownerId, { title: 'abc' })).resolves.toEqual(
        expect.any(String),
      );
      await expect(
        insertTask(ownerId, { title: 't'.repeat(120) }),
      ).resolves.toEqual(expect.any(String));
    });

    it.each([
      ['a 121-character title', { title: 't'.repeat(121) }],
      ['a 2001-character description', { description: 'd'.repeat(2001) }],
    ])('rejects %s (varchar limit)', async (_label, row: TaskRow) => {
      const ownerId = await aUser();

      const error = await sqlError(() => insertTask(ownerId, row));

      expect(error.code).toBe(STRING_TOO_LONG);
    });

    it.each([0, -1])(
      'rejects version %i (tasks_version_pos)',
      async (version) => {
        const ownerId = await aUser();

        const error = await sqlError(() => insertTask(ownerId, { version }));

        expect(error.code).toBe(CHECK_VIOLATION);
        expect(error.constraint).toBe('tasks_version_pos');
      },
    );

    it.each([
      ['DONE without completed_at', { status: 'DONE', completedAt: null }],
      [
        'PENDING with completed_at',
        { status: 'PENDING', completedAt: new Date() },
      ],
      [
        'IN_PROGRESS with completed_at',
        { status: 'IN_PROGRESS', completedAt: new Date() },
      ],
    ])(
      'BR-03.5 rejects %s (tasks_completed_done)',
      async (_label, row: TaskRow) => {
        const ownerId = await aUser();

        const error = await sqlError(() => insertTask(ownerId, row));

        expect(error.code).toBe(CHECK_VIOLATION);
        expect(error.constraint).toBe('tasks_completed_done');
      },
    );

    it('accepts DONE with completed_at and PENDING without it', async () => {
      const ownerId = await aUser();

      await expect(
        insertTask(ownerId, { status: 'DONE', completedAt: new Date() }),
      ).resolves.toEqual(expect.any(String));
      await expect(insertTask(ownerId, { status: 'PENDING' })).resolves.toEqual(
        expect.any(String),
      );
    });

    it('rejects updated_at before created_at (tasks_updated_after_created)', async () => {
      const ownerId = await aUser();
      const createdAt = new Date('2026-10-21T09:00:00.000Z');

      const error = await sqlError(() =>
        insertTask(ownerId, {
          createdAt,
          updatedAt: new Date(createdAt.getTime() - 1),
        }),
      );

      expect(error.code).toBe(CHECK_VIOLATION);
      expect(error.constraint).toBe('tasks_updated_after_created');
    });
  });

  describe('relations', () => {
    it('rejects a task for an unknown owner', async () => {
      const error = await sqlError(() => insertTask(randomUUID()));

      expect(error.code).toBe(FOREIGN_KEY_VIOLATION);
      expect(error.constraint).toBe('tasks_owner_id_fkey');
    });

    it('rejects a link to an unknown team and a duplicate link', async () => {
      const ownerId = await aUser();
      const [taskId, teamId] = [
        await insertTask(ownerId),
        await aTeam(ownerId),
      ];
      const link = (team: string) =>
        sql.query('INSERT INTO task_teams (task_id, team_id) VALUES ($1, $2)', [
          taskId,
          team,
        ]);

      const unknown = await sqlError(() => link(randomUUID()));
      await link(teamId);
      const duplicate = await sqlError(() => link(teamId));

      expect(unknown.code).toBe(FOREIGN_KEY_VIOLATION);
      expect(unknown.constraint).toBe('task_teams_team_id_fkey');
      expect(duplicate.code).toBe(UNIQUE_VIOLATION);
      expect(duplicate.constraint).toBe('task_teams_pkey');
    });

    it('removes links with their task or team, and tasks with their owner (ON DELETE CASCADE)', async () => {
      const ownerId = await aUser();
      const [keptTeam, goneTeam] = [await aTeam(ownerId), await aTeam(ownerId)];
      const [task, goneTask] = [
        await insertTask(ownerId),
        await insertTask(ownerId),
      ];
      for (const [t, team] of [
        [task, keptTeam],
        [task, goneTeam],
        [goneTask, keptTeam],
      ]) {
        await sql.query(
          'INSERT INTO task_teams (task_id, team_id) VALUES ($1, $2)',
          [t, team],
        );
      }
      const links = async () =>
        (
          await sql.query<{ task_id: string; team_id: string }>(
            'SELECT task_id, team_id FROM task_teams WHERE task_id = ANY($1::uuid[]) ORDER BY 1, 2',
            [[task, goneTask]],
          )
        ).rows;

      await sql.query('DELETE FROM teams WHERE id = $1', [goneTeam]);
      expect(await links()).toEqual(
        [
          { task_id: task, team_id: keptTeam },
          { task_id: goneTask, team_id: keptTeam },
        ].sort((a, b) => a.task_id.localeCompare(b.task_id)),
      );

      await sql.query('DELETE FROM tasks WHERE id = $1', [goneTask]);
      expect(await links()).toEqual([{ task_id: task, team_id: keptTeam }]);

      await sql.query('DELETE FROM users WHERE id = $1', [ownerId]);
      expect(await links()).toEqual([]);
      const { rows } = await sql.query(
        'SELECT 1 FROM tasks WHERE owner_id = $1',
        [ownerId],
      );
      expect(rows).toHaveLength(0);
    });
  });

  it('declares pg_trgm and every index of the data model', async () => {
    const { rows: ext } = await sql.query(
      `SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'`,
    );
    const { rows: indexes } = await sql.query<{
      indexname: string;
      indexdef: string;
    }>(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND tablename IN ('tasks', 'task_teams')`,
    );
    const def = (name: string) =>
      indexes.find((i) => i.indexname === name)?.indexdef;

    expect(ext).toHaveLength(1);
    expect(def('tasks_owner_status_created_idx')).toContain(
      '(owner_id, status, created_at DESC, id DESC) WHERE (deleted_at IS NULL)',
    );
    expect(def('tasks_owner_created_idx')).toContain(
      '(owner_id, created_at DESC, id DESC) WHERE (deleted_at IS NULL)',
    );
    expect(def('tasks_owner_due_idx')).toContain(
      '(owner_id, due_date, id) WHERE (deleted_at IS NULL)',
    );
    expect(def('tasks_search_trgm_idx')).toContain(
      'USING gin (title gin_trgm_ops, description gin_trgm_ops)',
    );
    expect(def('task_teams_pkey')).toContain('(task_id, team_id)');
    expect(def('task_teams_team_id_task_id_idx')).toContain(
      '(team_id, task_id)',
    );
  });

  describe('query plans (plan 003 "Read model SQL")', () => {
    let ownerId: string;
    let teamId: string;

    beforeAll(async () => {
      const owners = [await aUser(), await aUser(), await aUser()];
      ownerId = owners[0]!;
      teamId = await aTeam(ownerId);
      // 3 owners x 3,000 tasks, shaped like a real backlog: 5 % PENDING, 5 % IN_PROGRESS, the
      // rest DONE; every 10th soft-deleted, every 500th mentions "login", every 4th has a due
      // date; every 50th task of the first owner is in the team.
      await sql.query(
        `INSERT INTO tasks (id, owner_id, title, description, status, due_date, completed_at,
                            created_at, updated_at, deleted_at)
         SELECT gen_random_uuid(), o.id,
                CASE WHEN g % 500 = 0 THEN 'Fix login redirect ' || g ELSE 'Task number ' || g END,
                CASE WHEN g % 7 = 0 THEN 'Details for task ' || g END,
                (CASE g % 20 WHEN 1 THEN 'PENDING' WHEN 2 THEN 'IN_PROGRESS' ELSE 'DONE' END)::task_status,
                CASE WHEN g % 4 = 0 THEN date '2026-11-01' + (g % 60) END,
                CASE WHEN g % 20 NOT IN (1, 2) THEN now() END,
                now() - g * interval '1 minute', now(),
                CASE WHEN g % 10 = 0 THEN now() END
         FROM unnest($1::text[]) AS o(id), generate_series(1, 3000) AS g`,
        [owners],
      );
      await sql.query(
        `INSERT INTO task_teams (task_id, team_id)
         SELECT id, $2 FROM (
           SELECT id, row_number() OVER (ORDER BY created_at) AS n FROM tasks WHERE owner_id = $1
         ) t WHERE n % 50 = 0`,
        [ownerId, teamId],
      );
      await sql.query('ANALYZE tasks');
      await sql.query('ANALYZE task_teams');
    });

    /**
     * EXPLAIN ANALYZE with sequential scans disabled, so the planner must show its index.
     * `without` drops indexes inside a rolled-back transaction, to prove that a specific index
     * can serve a predicate when the planner would otherwise prefer a cheaper path.
     */
    async function plan(
      query: string,
      params: unknown[],
      without: string[] = [],
    ): Promise<string> {
      await sql.query('BEGIN');
      try {
        await sql.query('SET LOCAL enable_seqscan = off');
        for (const index of without) {
          await sql.query(`DROP INDEX "${index}"`);
        }
        const { rows } = await sql.query<{ 'QUERY PLAN': unknown }>(
          `EXPLAIN (ANALYZE, FORMAT JSON) ${query}`,
          params,
        );
        return JSON.stringify(rows[0]?.['QUERY PLAN']);
      } finally {
        await sql.query('ROLLBACK');
      }
    }

    const noSort = (p: string) => {
      expect(p).not.toContain('"Node Type":"Sort"');
      expect(p).not.toContain('"Node Type":"Incremental Sort"');
    };

    it('default list (-createdAt) reads tasks_owner_created_idx in order', async () => {
      const p = await plan(
        `SELECT id FROM tasks WHERE owner_id = $1 AND deleted_at IS NULL
         ORDER BY created_at DESC, id DESC LIMIT 20 OFFSET 0`,
        [ownerId],
      );

      expect(p).toContain('"Index Name":"tasks_owner_created_idx"');
      noSort(p);
    });

    // Only an equality on status lets this index return rows already in created_at order:
    // `status = ANY($2::task_status[])` never uses it, even with a single element (verified on
    // the compose image), so the read model must emit `status = $n` for one status.
    it('one status (equality) + default sort reads tasks_owner_status_created_idx in order', async () => {
      const p = await plan(
        `SELECT id FROM tasks WHERE owner_id = $1 AND deleted_at IS NULL
           AND status = $2::task_status
         ORDER BY created_at DESC, id DESC LIMIT 20 OFFSET 0`,
        [ownerId, 'PENDING'],
      );

      expect(p).toContain('"Index Name":"tasks_owner_status_created_idx"');
      noSort(p);
    });

    it('sort=dueDate reads tasks_owner_due_idx in order', async () => {
      const p = await plan(
        `SELECT id FROM tasks WHERE owner_id = $1 AND deleted_at IS NULL
         ORDER BY due_date ASC NULLS LAST, id ASC LIMIT 20 OFFSET 0`,
        [ownerId],
      );

      expect(p).toContain('"Index Name":"tasks_owner_due_idx"');
      noSort(p);
    });

    // Which plan wins at scale (10k tasks per owner) is T-003-09's acceptance; at this size the
    // owner-scoped scan is cheaper. Here: the trigram index can serve both ILIKE arms.
    it('search can be served by tasks_search_trgm_idx (BitmapOr over title and description)', async () => {
      const p = await plan(
        `SELECT id FROM tasks WHERE owner_id = $1 AND deleted_at IS NULL
           AND (title ILIKE $2 ESCAPE '\\' OR description ILIKE $2 ESCAPE '\\')
         ORDER BY created_at DESC, id DESC LIMIT 20 OFFSET 0`,
        [ownerId, '%login%'],
        [
          'tasks_owner_created_idx',
          'tasks_owner_status_created_idx',
          'tasks_owner_due_idx',
        ],
      );

      expect(p).toContain('"Index Name":"tasks_search_trgm_idx"');
      expect(p).toContain('"Node Type":"BitmapOr"');
    });

    it('teamId filter uses task_teams_team_id_task_id_idx', async () => {
      const p = await plan(
        `SELECT t.id FROM tasks t WHERE t.owner_id = $1 AND t.deleted_at IS NULL
           AND EXISTS (SELECT 1 FROM task_teams f WHERE f.task_id = t.id AND f.team_id = $2::uuid)
         ORDER BY t.created_at DESC, t.id DESC LIMIT 20 OFFSET 0`,
        [ownerId, teamId],
      );

      expect(p).toContain('"Index Name":"task_teams_team_id_task_id_idx"');
    });
  });
});
