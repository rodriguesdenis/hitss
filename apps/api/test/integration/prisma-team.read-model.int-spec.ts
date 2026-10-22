import { randomUUID } from 'node:crypto';
import { TaskStatus } from '../../src/modules/tasks/domain/value-objects/task-status';
import { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import type { Sort } from '../../src/shared/application/page';
import { PrismaService } from '../../src/shared/infrastructure/prisma/prisma.service';
import type { TeamSortField } from '../../src/modules/teams/application/ports/team.read-model';
import { PrismaTeamReadModel } from '../../src/modules/teams/infrastructure/persistence/team.prisma-read';
import { createTestApp } from '../support/app';
import { useTestDatabase } from '../support/postgres';

const NEWEST_FIRST: Sort<TeamSortField> = {
  field: 'createdAt',
  direction: 'desc',
};
const T0 = Date.parse('2026-10-01T00:00:00.000Z');

describe('PrismaTeamReadModel (integration, T-002-06a, T-008-05)', () => {
  const db = useTestDatabase();
  let app: INestApplication;
  let prisma: PrismaService;
  let readModel: PrismaTeamReadModel;
  let sql: Client;

  beforeAll(async () => {
    app = await createTestApp(db.url);
    prisma = app.get(PrismaService);
    readModel = new PrismaTeamReadModel(prisma);
    sql = new Client({ connectionString: db.url });
    await sql.connect();
  });

  afterAll(async () => {
    await sql?.end();
    await app?.close();
  });

  const newOwner = async (): Promise<string> =>
    (
      await prisma.user.create({
        data: { name: 'Owner', email: `owner-${randomUUID()}@example.test` },
      })
    ).id;

  /** Inserts a team; minute `n` after T0 sets created_at (and updated_at unless given). */
  async function team(
    ownerId: string,
    name: string,
    n: number,
    extra: {
      updatedMinute?: number;
      deleted?: boolean;
      description?: string;
    } = {},
  ): Promise<string> {
    const id = randomUUID();
    const createdAt = new Date(T0 + n * 60_000);
    await prisma.team.create({
      data: {
        id,
        ownerId,
        name,
        colorHex: '#7C3AED',
        description: extra.description ?? null,
        createdAt,
        updatedAt: new Date(T0 + (extra.updatedMinute ?? n) * 60_000),
        deletedAt: extra.deleted ? new Date(T0 + 999 * 60_000) : null,
      },
    });
    return id;
  }

  const names = (items: { name: string }[]) => items.map((t) => t.name);

  it('returns the team view fields', async () => {
    const ownerId = await newOwner();
    const id = await team(ownerId, 'Mobile', 1, {
      description: 'iOS & Android',
    });

    const { items, total } = await readModel.page(ownerId, {
      page: { limit: 20, offset: 0 },
      sort: NEWEST_FIRST,
    });

    expect(total).toBe(1);
    expect(items).toEqual([
      {
        id,
        name: 'Mobile',
        colorHex: '#7C3AED',
        description: 'iOS & Android',
        taskCount: 0,
        version: 1,
        createdAt: new Date(T0 + 60_000),
        updatedAt: new Date(T0 + 60_000),
      },
    ]);
  });

  it('AC-02.2.3 pages 25 teams by 10 with the total on every page', async () => {
    const ownerId = await newOwner();
    for (let n = 1; n <= 25; n++)
      await team(ownerId, `Team ${String(n).padStart(2, '0')}`, n);

    const pages = await Promise.all(
      [0, 10, 20].map((offset) =>
        readModel.page(ownerId, {
          page: { limit: 10, offset },
          sort: NEWEST_FIRST,
        }),
      ),
    );

    expect(pages.map((p) => p.items.length)).toEqual([10, 10, 5]);
    expect(pages.map((p) => p.total)).toEqual([25, 25, 25]);
    expect(names(pages[0]!.items).slice(0, 2)).toEqual(['Team 25', 'Team 24']);
    expect(names(pages[2]!.items).at(-1)).toBe('Team 01');
  });

  it('AC-02.2.4 AC-02.2.6 returns an empty page with the correct total (beyond the end, or no teams)', async () => {
    const [ownerId, empty] = [await newOwner(), await newOwner()];
    for (let n = 1; n <= 3; n++) await team(ownerId, `Team ${n}`, n);

    await expect(
      readModel.page(ownerId, {
        page: { limit: 10, offset: 3 },
        sort: NEWEST_FIRST,
      }),
    ).resolves.toEqual({ items: [], total: 3 });
    await expect(
      readModel.page(empty, {
        page: { limit: 20, offset: 0 },
        sort: NEWEST_FIRST,
      }),
    ).resolves.toEqual({ items: [], total: 0 });
  });

  it('AC-02.2.7 AC-02.3.5 never returns or counts deleted or foreign teams', async () => {
    const [ownerId, stranger] = [await newOwner(), await newOwner()];
    await team(ownerId, 'Mobile', 1);
    await team(ownerId, 'Mobile Archive', 2, { deleted: true });
    await team(stranger, 'Mobile Elsewhere', 3);

    const all = await readModel.page(ownerId, {
      page: { limit: 20, offset: 0 },
      sort: NEWEST_FIRST,
    });
    const searched = await readModel.page(ownerId, {
      page: { limit: 20, offset: 0 },
      search: 'mobile',
      sort: NEWEST_FIRST,
    });

    expect(all).toMatchObject({ total: 1, items: [{ name: 'Mobile' }] });
    expect(searched).toMatchObject({ total: 1, items: [{ name: 'Mobile' }] });
  });

  it.each(
    (['createdAt', 'updatedAt'] as const).flatMap((field) =>
      (['asc', 'desc'] as const).map((direction) => ({ field, direction })),
    ),
  )(
    'AC-02.2.8 lists every team exactly once across pages when keys tie (sort $field $direction)',
    async (sort) => {
      const ownerId = await newOwner();
      // Twelve teams created and updated at one instant: only the id breaks the ties.
      const ids: string[] = [];
      for (let i = 0; i < 12; i++)
        ids.push(await team(ownerId, `Tied ${i}`, 5));

      const seen: string[] = [];
      for (let offset = 0; offset < 12; offset += 5) {
        const { items } = await readModel.page(ownerId, {
          page: { limit: 5, offset },
          sort,
        });
        seen.push(...items.map((t) => t.id));
      }

      expect(new Set(seen)).toEqual(new Set(ids));
      expect(seen).toEqual(
        [...ids].sort(
          (a, b) => (a < b ? -1 : 1) * (sort.direction === 'asc' ? 1 : -1),
        ),
      );
    },
  );

  it.each(['asc', 'desc'] as const)(
    'AC-02.2.8 lists every team exactly once across pages sorted by name (%s)',
    async (direction) => {
      // Active names are unique per owner, case aside (teams_owner_id_lower_name_key), so a
      // name sort has no ties to break; paging still sees every team once.
      const ownerId = await newOwner();
      for (let i = 0; i < 12; i++)
        await team(ownerId, `Team ${String(i).padStart(2, '0')}`, 5);

      const seen: string[] = [];
      for (let offset = 0; offset < 12; offset += 5) {
        const { items } = await readModel.page(ownerId, {
          page: { limit: 5, offset },
          sort: { field: 'name', direction },
        });
        seen.push(...names(items));
      }

      const expected = Array.from(
        { length: 12 },
        (_, i) => `Team ${String(i).padStart(2, '0')}`,
      );
      expect(seen).toEqual(direction === 'asc' ? expected : expected.reverse());
    },
  );

  it('AC-02.4.1 sorts by name case-insensitively, and in reverse', async () => {
    const ownerId = await newOwner();
    await team(ownerId, 'beta', 1);
    await team(ownerId, 'Alpha', 2);
    await team(ownerId, 'Gamma', 3);
    const byName = (direction: 'asc' | 'desc') =>
      readModel.page(ownerId, {
        page: { limit: 20, offset: 0 },
        sort: { field: 'name', direction },
      });

    expect(names((await byName('asc')).items)).toEqual([
      'Alpha',
      'beta',
      'Gamma',
    ]);
    expect(names((await byName('desc')).items)).toEqual([
      'Gamma',
      'beta',
      'Alpha',
    ]);
  });

  it('AC-02.4.2 sorts by createdAt and updatedAt in both directions', async () => {
    const ownerId = await newOwner();
    await team(ownerId, 'First made, last changed', 1, { updatedMinute: 30 });
    await team(ownerId, 'Second made, first changed', 2, { updatedMinute: 10 });
    await team(ownerId, 'Last made, middle changed', 3, { updatedMinute: 20 });
    const sorted = async (field: TeamSortField, direction: 'asc' | 'desc') =>
      names(
        (
          await readModel.page(ownerId, {
            page: { limit: 20, offset: 0 },
            sort: { field, direction },
          })
        ).items,
      );

    expect(await sorted('createdAt', 'asc')).toEqual([
      'First made, last changed',
      'Second made, first changed',
      'Last made, middle changed',
    ]);
    expect(await sorted('createdAt', 'desc')).toEqual([
      'Last made, middle changed',
      'Second made, first changed',
      'First made, last changed',
    ]);
    expect(await sorted('updatedAt', 'asc')).toEqual([
      'Second made, first changed',
      'Last made, middle changed',
      'First made, last changed',
    ]);
    expect(await sorted('updatedAt', 'desc')).toEqual([
      'First made, last changed',
      'Last made, middle changed',
      'Second made, first changed',
    ]);
  });

  describe('search', () => {
    it('AC-02.3.1 matches a case-insensitive substring of the name', async () => {
      const ownerId = await newOwner();
      await team(ownerId, 'Mobile', 1);
      await team(ownerId, 'Backend', 2);
      await team(ownerId, 'Mobile QA', 3);

      const result = await readModel.page(ownerId, {
        page: { limit: 20, offset: 0 },
        search: 'mob',
        sort: { field: 'name', direction: 'asc' },
      });

      expect(result.total).toBe(2);
      expect(names(result.items)).toEqual(['Mobile', 'Mobile QA']);
    });

    it.each([
      ['%', '50% Growth'],
      ['_', 'Team_A'],
      ['\\', 'Back\\slash'],
    ])(
      'AC-02.3.3 matches %s literally (no wildcard semantics)',
      async (term, expected) => {
        const ownerId = await newOwner();
        await team(ownerId, '50% Growth', 1);
        await team(ownerId, 'Team_A', 2);
        await team(ownerId, 'Back\\slash', 3);
        await team(ownerId, 'Plain', 4);

        const result = await readModel.page(ownerId, {
          page: { limit: 20, offset: 0 },
          search: term,
          sort: NEWEST_FIRST,
        });

        expect(names(result.items)).toEqual([expected]);
        expect(result.total).toBe(1);
      },
    );

    it('AC-02.3.4 returns an empty page with total 0 when nothing matches', async () => {
      const ownerId = await newOwner();
      await team(ownerId, 'Mobile', 1);

      await expect(
        readModel.page(ownerId, {
          page: { limit: 20, offset: 0 },
          search: 'zzz',
          sort: NEWEST_FIRST,
        }),
      ).resolves.toEqual({ items: [], total: 0 });
    });

    it('AC-02.4.4 sorts the matches before paging, and counts all matches', async () => {
      const ownerId = await newOwner();
      for (const [n, name] of [
        [1, 'Squad D'],
        [2, 'Other'],
        [3, 'squad b'],
        [4, 'Squad A'],
        [5, 'SQUAD C'],
      ] as const) {
        await team(ownerId, name, n);
      }

      const second = await readModel.page(ownerId, {
        page: { limit: 2, offset: 2 },
        search: 'squad',
        sort: { field: 'name', direction: 'asc' },
      });

      expect(second.total).toBe(4);
      expect(names(second.items)).toEqual(['SQUAD C', 'Squad D']);
    });
  });

  describe('taskCount, counted in the same SQL (T-008-05, carried from T-003-14a)', () => {
    async function task(
      ownerId: string,
      teams: string[],
      extra: { status?: TaskStatus; deleted?: boolean } = {},
    ): Promise<string> {
      const id = randomUUID();
      const status = extra.status ?? TaskStatus.PENDING;
      const at = new Date(T0);
      await prisma.task.create({
        data: {
          id,
          ownerId,
          title: `Task ${id.slice(0, 8)}`,
          status,
          completedAt: status === TaskStatus.DONE ? at : null,
          createdAt: at,
          updatedAt: at,
          deletedAt: extra.deleted ? at : null,
          teams: { create: teams.map((teamId) => ({ teamId })) },
        },
      });
      return id;
    }

    const countOf = async (ownerId: string, id: string) =>
      (await readModel.findById(ownerId, id))?.taskCount;

    it('AC-02.8.1 counts the owner’s active tasks per team, whatever their status, in page and findById', async () => {
      const ownerId = await newOwner();
      const mobile = await team(ownerId, 'Mobile', 1);
      const backend = await team(ownerId, 'Backend', 2);
      const design = await team(ownerId, 'Design', 3);
      await task(ownerId, [mobile, backend], { status: TaskStatus.PENDING });
      await task(ownerId, [mobile], { status: TaskStatus.IN_PROGRESS });
      await task(ownerId, [mobile], { status: TaskStatus.DONE });
      await task(ownerId, []);

      const { items } = await readModel.page(ownerId, {
        page: { limit: 20, offset: 0 },
        sort: NEWEST_FIRST,
      });

      expect(
        Object.fromEntries(items.map((t) => [t.name, t.taskCount])),
      ).toEqual({ Mobile: 3, Backend: 1, Design: 0 });
      expect(await countOf(ownerId, mobile)).toBe(3);
      expect(await countOf(ownerId, design)).toBe(0);
    });

    it('AC-03.11.3 AC-02.8.2 never counts a deleted task (its links remain) or an unassigned one', async () => {
      const ownerId = await newOwner();
      const id = await team(ownerId, 'Mobile', 1);
      await task(ownerId, [id]);
      await task(ownerId, [id], { deleted: true });
      const unassigned = await task(ownerId, [id]);
      await prisma.taskTeam.deleteMany({ where: { taskId: unassigned } });

      expect(await prisma.taskTeam.count({ where: { teamId: id } })).toBe(2);
      expect(await countOf(ownerId, id)).toBe(1);
    });

    it('never counts another owner’s task, and unknown or foreign teams have no count at all', async () => {
      const [ownerId, stranger] = [await newOwner(), await newOwner()];
      const mine = await team(ownerId, 'Mine', 1);
      const theirs = await team(stranger, 'Theirs', 1);
      await task(ownerId, [mine]);
      await task(stranger, [theirs]);
      // A cross-owner link the API never creates (task_teams has no owner column).
      await task(stranger, [mine]);

      expect(await countOf(ownerId, mine)).toBe(1);
      expect(await readModel.findById(ownerId, theirs)).toBeNull();
      expect(await readModel.findById(ownerId, randomUUID())).toBeNull();
    });

    it('a page of N teams is two queries (page and total), never one per team', async () => {
      const ownerId = await newOwner();
      for (const n of [1, 2, 3]) {
        await task(ownerId, [await team(ownerId, `Team ${n}`, n)]);
      }
      const queries: string[] = [];
      prisma.$on('query', (event) => queries.push(event.query));

      const { items } = await readModel.page(ownerId, {
        page: { limit: 20, offset: 0 },
        sort: NEWEST_FIRST,
      });

      expect(items.map((t) => t.taskCount)).toEqual([1, 1, 1]);
      expect(queries.filter((q) => /\bSELECT\b/i.test(q))).toHaveLength(2);
    });
  });

  describe('query plans over 1,000 teams of one owner', () => {
    let ownerId: string;

    beforeAll(async () => {
      const others = [await newOwner(), await newOwner()];
      ownerId = await newOwner();
      await sql.query(
        `INSERT INTO teams (id, owner_id, name, color_hex, created_at, updated_at, deleted_at)
         SELECT gen_random_uuid(), o.id, 'Team ' || g, '#0EA5E9',
                timestamptz '2026-10-01' + g * interval '1 minute',
                timestamptz '2026-10-01' + g * interval '1 minute',
                CASE WHEN g % 10 = 0 THEN now() END
         FROM unnest($1::text[]) AS o(id), generate_series(1, 1000) AS g`,
        [[ownerId, ...others]],
      );
      await sql.query('ANALYZE teams');
    });

    /** Captures the SQL the read model sends (Prisma query events), then EXPLAINs it. */
    async function planOf(sort: Sort<TeamSortField>): Promise<string> {
      const captured: { query: string; params: string }[] = [];
      prisma.$on('query', (event) =>
        captured.push({ query: event.query, params: event.params }),
      );
      await readModel.page(ownerId, { page: { limit: 20, offset: 0 }, sort });
      const pageQuery = captured.find((q) => /\bLIMIT\b/i.test(q.query));
      if (!pageQuery) throw new Error('page query not captured');
      const params = JSON.parse(pageQuery.params) as unknown[];
      await sql.query('BEGIN');
      try {
        await sql.query('SET LOCAL enable_seqscan = off');
        const { rows } = await sql.query<{ 'QUERY PLAN': unknown }>(
          `EXPLAIN (ANALYZE, FORMAT JSON) ${pageQuery.query}`,
          params,
        );
        return JSON.stringify(rows[0]?.['QUERY PLAN']);
      } finally {
        await sql.query('ROLLBACK');
      }
    }

    const noSort = (plan: string) => {
      expect(plan).not.toContain('"Node Type":"Sort"');
      expect(plan).not.toContain('"Node Type":"Incremental Sort"');
    };

    it('the default list (-createdAt) reads teams_owner_id_created_at_idx in order', async () => {
      const plan = await planOf(NEWEST_FIRST);

      expect(plan).toContain('"Index Name":"teams_owner_id_created_at_idx"');
      // taskCount: one index probe per returned team, not a scan of task_teams.
      expect(plan).toContain('"Index Name":"task_teams_team_id_task_id_idx"');
      noSort(plan);
    });

    it('sort=name reads teams_owner_id_lower_name_key in order', async () => {
      const plan = await planOf({ field: 'name', direction: 'asc' });

      expect(plan).toContain('"Index Name":"teams_owner_id_lower_name_key"');
      noSort(plan);
    });
  });
});
