import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import type { Sort } from '../../../../shared/application/page';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import type {
  ListTasksCriteria,
  TaskSortField,
} from '../../application/ports/task.read-model';
import type { TaskStatus } from '../../domain/value-objects/task-status.vo';
import { PrismaTaskReadModel } from '../../infrastructure/persistence/task.prisma-read';
import { createTestApp } from '@test/support/app';
import { useTestDatabase } from '@test/support/postgres';

const NEWEST_FIRST: Sort<TaskSortField> = {
  field: 'createdAt',
  direction: 'desc',
};
const T0 = Date.parse('2026-10-01T00:00:00.000Z');
const minute = (n: number) => new Date(T0 + n * 60_000);

interface TaskSeed {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  dueDate?: string | null;
  created?: number;
  updated?: number;
  teams?: string[];
  deleted?: boolean;
}

describe('PrismaTaskReadModel.list (integration, T-003-08a, T-003-09a)', () => {
  const db = useTestDatabase();
  let app: INestApplication;
  let prisma: PrismaService;
  let readModel: PrismaTaskReadModel;
  let sql: Client;

  beforeAll(async () => {
    app = await createTestApp(db.url);
    prisma = app.get(PrismaService);
    readModel = new PrismaTaskReadModel(prisma);
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

  async function newTeam(
    ownerId: string,
    name = `Team ${randomUUID().slice(0, 8)}`,
  ) {
    const id = randomUUID();
    await prisma.team.create({
      data: {
        id,
        ownerId,
        name,
        colorHex: '#7C3AED',
        createdAt: minute(0),
        updatedAt: minute(0),
      },
    });
    return id;
  }

  async function task(ownerId: string, seed: TaskSeed = {}): Promise<string> {
    const id = randomUUID();
    const status = seed.status ?? 'PENDING';
    const created = seed.created ?? 1;
    await prisma.task.create({
      data: {
        id,
        ownerId,
        title: seed.title ?? `Task ${id.slice(0, 8)}`,
        description: seed.description ?? null,
        status,
        dueDate: seed.dueDate
          ? new Date(`${seed.dueDate}T00:00:00.000Z`)
          : null,
        completedAt: status === 'DONE' ? minute(created) : null,
        createdAt: minute(created),
        updatedAt: minute(seed.updated ?? created),
        deletedAt: seed.deleted ? minute(999) : null,
        teams: { create: (seed.teams ?? []).map((teamId) => ({ teamId })) },
      },
    });
    return id;
  }

  const list = (ownerId: string, criteria: Partial<ListTasksCriteria> = {}) =>
    readModel.list(ownerId, {
      page: { limit: 20, offset: 0 },
      sort: NEWEST_FIRST,
      ...criteria,
    });
  const titles = (items: { title: string }[]) => items.map((t) => t.title);

  describe('filters and paging (T-003-08a)', () => {
    it('AC-03.2.1 lists the owner’s tasks newest first, at most the limit, with the total', async () => {
      const ownerId = await newOwner();
      for (let n = 1; n <= 25; n++) {
        await task(ownerId, {
          title: `T${String(n).padStart(2, '0')}`,
          created: n,
        });
      }

      const page = await list(ownerId);

      expect(page.total).toBe(25);
      expect(page.items).toHaveLength(20);
      expect(titles(page.items).slice(0, 3)).toEqual(['T25', 'T24', 'T23']);
    });

    it('AC-03.2.1 returns full records (every field, all team ids sorted)', async () => {
      const ownerId = await newOwner();
      const teams = [await newTeam(ownerId), await newTeam(ownerId)];
      const id = await task(ownerId, {
        title: 'Ship the login screen',
        description: 'Email + password',
        status: 'DONE',
        dueDate: '2026-12-31',
        created: 3,
        updated: 4,
        teams,
      });

      const { items } = await list(ownerId);

      expect(items).toEqual([
        {
          id,
          title: 'Ship the login screen',
          description: 'Email + password',
          status: 'DONE',
          dueDate: '2026-12-31',
          completedAt: minute(3),
          teamIds: [...teams].sort(),
          version: 1,
          createdAt: minute(3),
          updatedAt: minute(4),
        },
      ]);
    });

    it('AC-03.2.3 AC-03.12.2 never returns deleted or foreign tasks, whatever the filters', async () => {
      const [ownerId, stranger] = [await newOwner(), await newOwner()];
      const team = await newTeam(ownerId);
      await task(ownerId, { title: 'Mine', teams: [team] });
      await task(ownerId, {
        title: 'Mine deleted',
        teams: [team],
        deleted: true,
      });
      await task(stranger, { title: 'Mine too? no' });

      for (const criteria of [
        {},
        { teamId: team },
        { statuses: ['PENDING'] as TaskStatus[] },
        { search: 'mine' },
      ]) {
        const page = await list(ownerId, criteria);
        expect({ total: page.total, titles: titles(page.items) }).toEqual({
          total: 1,
          titles: ['Mine'],
        });
      }
    });

    it('AC-03.2.4 returns an empty list with total 0 when there are no tasks', async () => {
      await expect(list(await newOwner())).resolves.toEqual({
        items: [],
        total: 0,
      });
    });

    it('AC-03.3.1 filters by team and still returns every team of each task', async () => {
      const ownerId = await newOwner();
      const [mobile, backend] = [
        await newTeam(ownerId),
        await newTeam(ownerId),
      ];
      await task(ownerId, {
        title: 'Both',
        teams: [mobile, backend],
        created: 2,
      });
      await task(ownerId, {
        title: 'Mobile only',
        teams: [mobile],
        created: 1,
      });
      await task(ownerId, {
        title: 'Backend only',
        teams: [backend],
        created: 3,
      });
      await task(ownerId, { title: 'No team', created: 4 });

      const page = await list(ownerId, { teamId: mobile });

      expect(page.total).toBe(2);
      expect(titles(page.items)).toEqual(['Both', 'Mobile only']);
      expect(page.items[0]!.teamIds).toEqual([mobile, backend].sort());
    });

    it('AC-03.3.2 AC-03.12.4 returns an empty page for an unknown, foreign, malformed or task-less team', async () => {
      const [ownerId, stranger] = [await newOwner(), await newOwner()];
      const strangersTeam = await newTeam(stranger);
      const emptyTeam = await newTeam(ownerId);
      await task(ownerId, { title: 'Mine' });
      await task(stranger, { teams: [strangersTeam] });

      for (const teamId of [
        randomUUID(),
        strangersTeam,
        emptyTeam,
        'not-a-uuid',
      ]) {
        await expect(list(ownerId, { teamId })).resolves.toEqual({
          items: [],
          total: 0,
        });
      }
    });

    it('AC-03.4.1 AC-03.4.2 filters by one status, or by any of several', async () => {
      const ownerId = await newOwner();
      await task(ownerId, {
        title: 'Pending one',
        status: 'PENDING',
        created: 1,
      });
      await task(ownerId, {
        title: 'In progress one',
        status: 'IN_PROGRESS',
        created: 2,
      });
      await task(ownerId, { title: 'Done one', status: 'DONE', created: 3 });

      expect(
        titles((await list(ownerId, { statuses: ['IN_PROGRESS'] })).items),
      ).toEqual(['In progress one']);
      const two = await list(ownerId, { statuses: ['PENDING', 'DONE'] });
      expect(titles(two.items)).toEqual(['Done one', 'Pending one']);
      expect(two.total).toBe(2);
    });

    it('AC-03.7.2 AC-03.7.3 counts every match, and an offset past the end is an empty page', async () => {
      const ownerId = await newOwner();
      for (let n = 1; n <= 7; n++) await task(ownerId, { created: n });

      const first = await list(ownerId, { page: { limit: 3, offset: 0 } });
      const past = await list(ownerId, { page: { limit: 3, offset: 7 } });

      expect({ size: first.items.length, total: first.total }).toEqual({
        size: 3,
        total: 7,
      });
      expect(past).toEqual({ items: [], total: 7 });
    });
  });

  describe('search and sort (T-003-09a)', () => {
    it('AC-03.4.4 combines team, status and search with AND (statuses with OR)', async () => {
      const ownerId = await newOwner();
      const team = await newTeam(ownerId);
      await task(ownerId, {
        title: 'Login fix',
        status: 'PENDING',
        teams: [team],
        created: 1,
      });
      await task(ownerId, {
        title: 'Login bug',
        status: 'IN_PROGRESS',
        teams: [team],
        created: 2,
      });
      await task(ownerId, {
        title: 'Login done',
        status: 'DONE',
        teams: [team],
        created: 3,
      });
      await task(ownerId, {
        title: 'Login other team',
        status: 'PENDING',
        created: 4,
      });
      await task(ownerId, {
        title: 'Signup',
        status: 'PENDING',
        teams: [team],
        created: 5,
      });

      const page = await list(ownerId, {
        teamId: team,
        statuses: ['PENDING', 'IN_PROGRESS'],
        search: 'login',
      });

      expect(titles(page.items)).toEqual(['Login bug', 'Login fix']);
      expect(page.total).toBe(2);
    });

    it('AC-03.5.1 matches the title or the description, ignoring case', async () => {
      const ownerId = await newOwner();
      await task(ownerId, { title: 'Fix LOGIN redirect', created: 1 });
      await task(ownerId, {
        title: 'Profile',
        description: 'after the login',
        created: 2,
      });
      await task(ownerId, {
        title: 'Unrelated',
        description: 'nothing here',
        created: 3,
      });

      expect(titles((await list(ownerId, { search: 'Login' })).items)).toEqual([
        'Profile',
        'Fix LOGIN redirect',
      ]);
    });

    it.each([
      ['%', '100% coverage'],
      ['_', 'snake_case names'],
      ['\\', 'Back\\slash'],
    ])('AC-03.5.3 matches %s literally', async (term, expected) => {
      const ownerId = await newOwner();
      await task(ownerId, { title: '100% coverage', created: 1 });
      await task(ownerId, { title: 'snake_case names', created: 2 });
      await task(ownerId, { title: 'Back\\slash', created: 3 });
      await task(ownerId, { title: 'Plain title', created: 4 });

      const page = await list(ownerId, { search: term });

      expect(titles(page.items)).toEqual([expected]);
      expect(page.total).toBe(1);
    });

    it('AC-03.5.4 returns an empty list with total 0 when nothing matches', async () => {
      const ownerId = await newOwner();
      await task(ownerId, { title: 'Something' });

      await expect(list(ownerId, { search: 'zzz' })).resolves.toEqual({
        items: [],
        total: 0,
      });
    });

    it('AC-03.6.1 sorts by createdAt and updatedAt in both directions', async () => {
      const ownerId = await newOwner();
      await task(ownerId, { title: 'Task A', created: 1, updated: 30 });
      await task(ownerId, { title: 'Task B', created: 2, updated: 10 });
      await task(ownerId, { title: 'Task C', created: 3, updated: 20 });
      const sorted = async (field: TaskSortField, direction: 'asc' | 'desc') =>
        titles((await list(ownerId, { sort: { field, direction } })).items);

      expect(await sorted('createdAt', 'asc')).toEqual([
        'Task A',
        'Task B',
        'Task C',
      ]);
      expect(await sorted('createdAt', 'desc')).toEqual([
        'Task C',
        'Task B',
        'Task A',
      ]);
      expect(await sorted('updatedAt', 'asc')).toEqual([
        'Task B',
        'Task C',
        'Task A',
      ]);
      expect(await sorted('updatedAt', 'desc')).toEqual([
        'Task A',
        'Task C',
        'Task B',
      ]);
    });

    it('AC-03.6.2 sorts titles ignoring case and statuses in lifecycle order', async () => {
      const ownerId = await newOwner();
      await task(ownerId, { title: 'beta', status: 'DONE', created: 1 });
      await task(ownerId, { title: 'Alpha', status: 'PENDING', created: 2 });
      await task(ownerId, {
        title: 'Gamma',
        status: 'IN_PROGRESS',
        created: 3,
      });
      const sorted = async (field: TaskSortField, direction: 'asc' | 'desc') =>
        titles((await list(ownerId, { sort: { field, direction } })).items);

      expect(await sorted('title', 'asc')).toEqual(['Alpha', 'beta', 'Gamma']);
      expect(await sorted('title', 'desc')).toEqual(['Gamma', 'beta', 'Alpha']);
      expect(await sorted('status', 'asc')).toEqual(['Alpha', 'Gamma', 'beta']);
      expect(await sorted('status', 'desc')).toEqual([
        'beta',
        'Gamma',
        'Alpha',
      ]);
    });

    it.each(['asc', 'desc'] as const)(
      'AC-03.6.3 puts tasks without a due date last (dueDate %s)',
      async (direction) => {
        const ownerId = await newOwner();
        await task(ownerId, { title: 'No date', dueDate: null, created: 1 });
        await task(ownerId, {
          title: 'Nov 2',
          dueDate: '2026-11-02',
          created: 2,
        });
        await task(ownerId, {
          title: 'Nov 1',
          dueDate: '2026-11-01',
          created: 3,
        });

        const result = titles(
          (await list(ownerId, { sort: { field: 'dueDate', direction } }))
            .items,
        );

        expect(result).toEqual(
          direction === 'asc'
            ? ['Nov 1', 'Nov 2', 'No date']
            : ['Nov 2', 'Nov 1', 'No date'],
        );
      },
    );

    describe('AC-03.6.4 AC-03.7.5 ties and page walks', () => {
      it.each(
        (
          ['createdAt', 'updatedAt', 'dueDate', 'title', 'status'] as const
        ).flatMap((field) =>
          (['asc', 'desc'] as const).map((direction) => ({ field, direction })),
        ),
      )(
        'breaks ties by id and walks every page exactly once ($field $direction)',
        async (sort) => {
          const ownerId = await newOwner();
          // Twelve tasks equal on every sort key (time, title, status, due date): only ids differ.
          const ids: string[] = [];
          for (let i = 0; i < 12; i++) {
            ids.push(
              await task(ownerId, {
                title: 'Same',
                status: 'PENDING',
                dueDate: '2026-11-01',
                created: 5,
              }),
            );
          }

          const seen: string[] = [];
          for (let offset = 0; offset < 12; offset += 5) {
            const { items } = await list(ownerId, {
              page: { limit: 5, offset },
              sort,
            });
            seen.push(...items.map((t) => t.id));
          }

          expect(seen).toEqual(
            [...ids].sort(
              (a, b) => (a < b ? -1 : 1) * (sort.direction === 'asc' ? 1 : -1),
            ),
          );
        },
      );
    });

    it('AC-03.6.4 breaks ties by id inside the no-due-date group too', async () => {
      const ownerId = await newOwner();
      const ids: string[] = [];
      for (let i = 0; i < 4; i++)
        ids.push(await task(ownerId, { dueDate: null }));
      const dated = await task(ownerId, { dueDate: '2026-11-01' });

      const desc = await list(ownerId, {
        sort: { field: 'dueDate', direction: 'desc' },
      });

      expect(desc.items.map((t) => t.id)).toEqual([
        dated,
        ...[...ids].sort().reverse(),
      ]);
    });
  });

  describe('query plans on a 10,000-task owner (plan 003 acceptance table)', () => {
    let ownerId: string;
    let teamId: string;

    beforeAll(async () => {
      const others = [];
      for (let i = 0; i < 5; i++) others.push(await newOwner());
      ownerId = await newOwner();
      teamId = await newTeam(ownerId, 'Hot team');
      // A realistic backlog: 5 % PENDING, 5 % IN_PROGRESS, the rest DONE; every 10th
      // soft-deleted; every 500th mentions "login"; every 4th has a due date; every 50th of the
      // hot owner is in the team. Other owners get 1,000 tasks each.
      await sql.query(
        `INSERT INTO tasks (id, owner_id, title, description, status, due_date, completed_at,
                            created_at, updated_at, deleted_at)
         SELECT gen_random_uuid(), o.id,
                CASE WHEN g % 500 = 0 THEN 'Fix login redirect ' || g ELSE 'Task number ' || g END,
                CASE WHEN g % 7 = 0 THEN 'Details for task ' || g END,
                (CASE g % 20 WHEN 1 THEN 'PENDING' WHEN 2 THEN 'IN_PROGRESS' ELSE 'DONE' END)::task_status,
                CASE WHEN g % 4 = 0 THEN date '2026-11-01' + (g % 60) END,
                CASE WHEN g % 20 NOT IN (1, 2) THEN timestamptz '2026-10-01' END,
                timestamptz '2026-10-01' + g * interval '1 second',
                timestamptz '2026-10-01' + g * interval '1 second',
                CASE WHEN g % 10 = 0 THEN timestamptz '2026-10-02' END
         FROM (SELECT $1::text AS id, 10000 AS n UNION ALL SELECT unnest($2::text[]), 1000) AS o,
              generate_series(1, o.n) AS g`,
        [ownerId, others],
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

    /** Runs the read model, captures its page query, and EXPLAINs it with seqscan off. */
    async function planOf(
      criteria: Partial<ListTasksCriteria>,
      without: string[] = [],
    ): Promise<string> {
      const captured: { query: string; params: string }[] = [];
      prisma.$on('query', (event) =>
        captured.push({ query: event.query, params: event.params }),
      );
      await list(ownerId, criteria);
      const pageQuery = captured.find((q) => /\bLIMIT\b/i.test(q.query));
      if (!pageQuery) throw new Error('page query not captured');
      const params = JSON.parse(pageQuery.params) as unknown[];
      await sql.query('BEGIN');
      try {
        await sql.query('SET LOCAL enable_seqscan = off');
        for (const index of without) await sql.query(`DROP INDEX "${index}"`);
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

    it('the default list (-createdAt) reads tasks_owner_created_idx in order', async () => {
      const plan = await planOf({});

      expect(plan).toContain('"Index Name":"tasks_owner_created_idx"');
      noSort(plan);
    });

    it('one status (emitted as an equality) reads tasks_owner_status_created_idx in order', async () => {
      const plan = await planOf({ statuses: ['PENDING'] });

      expect(plan).toContain('"Index Name":"tasks_owner_status_created_idx"');
      noSort(plan);
    });

    it('sort=dueDate ascending reads tasks_owner_due_idx in order', async () => {
      const plan = await planOf({
        sort: { field: 'dueDate', direction: 'asc' },
      });

      expect(plan).toContain('"Index Name":"tasks_owner_due_idx"');
      noSort(plan);
    });

    it('the teamId filter goes through task_teams_team_id_task_id_idx', async () => {
      const plan = await planOf({ teamId });

      expect(plan).toContain('"Index Name":"task_teams_team_id_task_id_idx"');
    });

    // Even at 10,000 tasks the planner prefers walking tasks_owner_created_idx and filtering
    // until it has 20 matches: it cannot estimate how rare the term is. That is a cost decision;
    // what the schema must guarantee is that the trigram index can serve both ILIKE arms, proven
    // with the owner indexes dropped inside the rolled-back transaction.
    it('search can be served by tasks_search_trgm_idx (BitmapOr over title and description)', async () => {
      const plan = await planOf({ search: 'login' }, [
        'tasks_owner_created_idx',
        'tasks_owner_status_created_idx',
        'tasks_owner_due_idx',
      ]);

      expect(plan).toContain('"Index Name":"tasks_search_trgm_idx"');
      expect(plan).toContain('"Node Type":"BitmapOr"');
    });
  });
});
