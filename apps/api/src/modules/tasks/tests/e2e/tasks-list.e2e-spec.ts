import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request, { Response } from 'supertest';
import { App } from 'supertest/types';
import { Clock } from '../../../../shared/domain/clock';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { createTestApp } from '@test/support/app';
import { bearerOf, signUpAndSignIn, TestUser } from '@test/support/auth';
import { useTestDatabase } from '@test/support/postgres';

const TASKS = '/api/v1/tasks';
const NOW = new Date('2026-10-22T01:00:00.000Z');
const BASE = Date.parse('2026-10-01T00:00:00.000Z');

type Status = 'PENDING' | 'IN_PROGRESS' | 'DONE';

interface TaskBody {
  id: string;
  title: string;
  status: Status;
  isOverdue: boolean;
  teams: { id: string; name: string; colorHex: string }[];
  version: number;
}

interface PageBody {
  data: TaskBody[];
  meta: { total: number; limit: number; offset: number; hasNextPage: boolean };
}

interface Seed {
  title: string;
  description?: string;
  status?: Status;
  teamIds?: string[];
  dueDate?: string;
  deleted?: boolean;
}

describe('GET /api/v1/tasks — filters and paging (e2e)', () => {
  const db = useTestDatabase();
  let app: INestApplication;
  let prisma: PrismaService;
  const statements: string[] = [];
  let recording = false;

  beforeAll(async () => {
    app = await createTestApp(db.url, {
      config: { authRateLimitEnabled: false },
      providers: [{ provide: Clock, useValue: { now: () => NOW } }],
    });
    prisma = app.get(PrismaService);
    prisma.$on('query', (event) => {
      if (recording) statements.push(event.query);
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  const http = () => request(app.getHttpServer() as App);
  const list = (user: TestUser, query: Record<string, unknown> = {}) =>
    http().get(TASKS).query(query).set('Authorization', bearerOf(user));
  const pageOf = (response: Response) => response.body as PageBody;
  const titlesOf = (response: Response) =>
    pageOf(response)
      .data.map((task) => task.title)
      .sort();
  const expectInvalid = (response: Response, field: string) => {
    expect(response.status).toBe(400);
    const { error } = response.body as {
      error: { code: string; details: { field: string }[] };
    };
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.details.map((detail) => detail.field)).toContain(field);
  };

  const createTeam = async (
    user: TestUser,
    name: string,
    colorHex = '#7C3AED',
  ) =>
    (
      (
        await http()
          .post('/api/v1/teams')
          .set('Authorization', bearerOf(user))
          .send({ name, colorHex })
      ).body as { data: { id: string } }
    ).data.id;

  async function seed(owner: TestUser, tasks: Seed[]): Promise<string[]> {
    const ids = tasks.map(() => randomUUID());
    await prisma.task.createMany({
      data: tasks.map((task, index) => {
        const at = new Date(BASE + index * 60_000);
        return {
          id: ids[index] as string,
          ownerId: owner.id,
          title: task.title,
          description: task.description ?? null,
          status: task.status ?? 'PENDING',
          dueDate: task.dueDate
            ? new Date(`${task.dueDate}T00:00:00.000Z`)
            : null,
          completedAt: task.status === 'DONE' ? at : null,
          createdAt: at,
          updatedAt: at,
          deletedAt: task.deleted ? at : null,
        };
      }),
    });
    await prisma.taskTeam.createMany({
      data: tasks.flatMap((task, index) =>
        (task.teamIds ?? []).map((teamId) => ({
          taskId: ids[index] as string,
          teamId,
        })),
      ),
    });
    return ids;
  }
  const many = (count: number, extra: Partial<Seed> = {}): Seed[] =>
    Array.from({ length: count }, (_, n) => ({
      title: `Task ${String(n + 1).padStart(3, '0')}`,
      ...extra,
    }));

  describe('listing (AC-03.2.x)', () => {
    it('AC-03.2.1 AC-03.2.2 no parameters → 20 newest first as full views, with metadata', async () => {
      const user = await signUpAndSignIn(app);
      const mobile = await createTeam(user, 'Mobile');
      await seed(user, many(25, { teamIds: [mobile], dueDate: '2026-10-21' }));

      const response = await list(user);

      expect(response.status).toBe(200);
      expect(response.headers.etag).toBeUndefined();
      const { data, meta } = pageOf(response);
      expect(data.map((task) => task.title)).toEqual(
        Array.from(
          { length: 20 },
          (_, n) => `Task ${String(25 - n).padStart(3, '0')}`,
        ),
      );
      expect(data[0]).toMatchObject({
        status: 'PENDING',
        isOverdue: true,
        teams: [{ id: mobile, name: 'Mobile', colorHex: '#7C3AED' }],
        version: 1,
      });
      expect(meta).toEqual({
        total: 25,
        limit: 20,
        offset: 0,
        hasNextPage: true,
      });
    });

    it('AC-03.2.3 AC-03.12.2 deleted tasks and other users’ tasks never appear', async () => {
      const user = await signUpAndSignIn(app);
      const other = await signUpAndSignIn(app);
      await seed(user, [
        { title: 'Task A' },
        { title: 'Task B', deleted: true },
        { title: 'Task C' },
      ]);
      await seed(other, [{ title: 'Theirs' }]);

      const response = await list(user);

      expect(titlesOf(response)).toEqual(['Task A', 'Task C']);
      expect(pageOf(response).meta.total).toBe(2);
    });

    it('AC-03.2.4 no tasks → empty page, total 0', async () => {
      const user = await signUpAndSignIn(app);

      const response = await list(user);

      expect(pageOf(response)).toEqual({
        data: [],
        meta: { total: 0, limit: 20, offset: 0, hasNextPage: false },
      });
    });

    it('AC-03.2.5 embedded teams are ordered by name; a deleted team is not embedded', async () => {
      const user = await signUpAndSignIn(app);
      const mobile = await createTeam(user, 'Mobile');
      const design = await createTeam(user, 'design');
      const backend = await createTeam(user, 'Backend');
      const archived = await createTeam(user, 'Archived');
      await prisma.team.update({
        where: { id: archived },
        data: { deletedAt: NOW },
      });
      await seed(user, [
        { title: 'Cross-team', teamIds: [mobile, design, backend, archived] },
      ]);

      const [task] = pageOf(await list(user)).data;

      expect(task?.teams.map((team) => team.name)).toEqual([
        'Backend',
        'design',
        'Mobile',
      ]);
    });
  });

  describe('filters (AC-03.3.x, AC-03.4.x)', () => {
    let user: TestUser;
    let teams: {
      mobile: string;
      backend: string;
      design: string;
    };

    beforeAll(async () => {
      user = await signUpAndSignIn(app);
      teams = {
        mobile: await createTeam(user, 'Mobile'),
        backend: await createTeam(user, 'Backend'),
        design: await createTeam(user, 'Design'),
      };
      await seed(user, [
        {
          title: 'Login screen',
          status: 'IN_PROGRESS',
          teamIds: [teams.mobile],
        },
        { title: 'Login API', status: 'PENDING', teamIds: [teams.backend] },
        {
          title: 'Release notes',
          status: 'DONE',
          teamIds: [teams.mobile, teams.backend],
        },
        { title: 'Color tokens', status: 'PENDING', teamIds: [teams.design] },
        { title: 'Personal errand', status: 'PENDING' },
      ]);
    });

    it('AC-03.3.1 a team filter includes multi-team tasks with all their teams', async () => {
      const response = await list(user, { teamId: teams.mobile });

      expect(titlesOf(response)).toEqual(['Login screen', 'Release notes']);
      const release = pageOf(response).data.find(
        (t) => t.title === 'Release notes',
      );
      expect(release?.teams.map((team) => team.name)).toEqual([
        'Backend',
        'Mobile',
      ]);
    });

    it('AC-03.3.2 AC-03.12.4 an unknown team, a team without tasks, a deleted team or another user’s team → empty page, total 0', async () => {
      const owner = await signUpAndSignIn(app);
      const infra = await createTeam(owner, 'Infra');
      const gone = await createTeam(owner, 'Gone');
      await seed(owner, [{ title: 'Gone task', teamIds: [gone] }]);
      await prisma.team.update({
        where: { id: gone },
        data: { deletedAt: NOW },
      });
      const stranger = await signUpAndSignIn(app);
      const theirs = await createTeam(stranger, 'Ops');
      await seed(stranger, [{ title: 'Ops task', teamIds: [theirs] }]);

      for (const teamId of [randomUUID(), infra, gone, theirs]) {
        const response = await list(owner, { teamId });
        expect(response.status).toBe(200);
        expect(pageOf(response)).toEqual({
          data: [],
          meta: { total: 0, limit: 20, offset: 0, hasNextPage: false },
        });
      }
    });

    it('AC-03.3.2 a team that is not live and owned → the tasks are not queried', async () => {
      statements.length = 0;
      recording = true;
      await list(user, { teamId: randomUUID() });
      recording = false;

      expect(statements.filter((sql) => /\btasks\b/.test(sql))).toEqual([]);
    });

    it('AC-03.3.3 a malformed team id → 400 on teamId', async () => {
      expectInvalid(await list(user, { teamId: '123' }), 'teamId');
    });

    it.each<[string | string[], string[]]>([
      ['PENDING', ['Color tokens', 'Login API', 'Personal errand']],
      ['DONE', ['Release notes']],
      [
        'PENDING,IN_PROGRESS',
        ['Color tokens', 'Login API', 'Login screen', 'Personal errand'],
      ],
      [
        'PENDING,IN_PROGRESS,DONE',
        [
          'Color tokens',
          'Login API',
          'Login screen',
          'Personal errand',
          'Release notes',
        ],
      ],
      ['DONE,DONE', ['Release notes']],
      [
        ['PENDING', 'DONE'],
        ['Color tokens', 'Login API', 'Personal errand', 'Release notes'],
      ],
    ])('AC-03.4.1 AC-03.4.2 status %p', async (status, expected) => {
      const response = await list(user, { status });

      expect(response.status).toBe(200);
      expect(titlesOf(response)).toEqual(expected);
      expect(pageOf(response).meta.total).toBe(expected.length);
    });

    it.each(['done', 'ARCHIVED', 'PENDING,UNKNOWN', 'PENDING,', ''])(
      'AC-03.4.3 status "%s" → 400 on status',
      async (status) => {
        expectInvalid(await list(user, { status }), 'status');
      },
    );

    it('AC-03.4.4 team and status combine with AND', async () => {
      const response = await list(user, {
        teamId: teams.mobile,
        status: 'DONE',
      });

      expect(titlesOf(response)).toEqual(['Release notes']);
    });

    it('an unknown parameter → 400 naming it', async () => {
      expectInvalid(await list(user, { owner: 'someone' }), 'owner');
    });
  });

  describe('paging (AC-03.7.x)', () => {
    let user: TestUser;

    beforeAll(async () => {
      user = await signUpAndSignIn(app);
      await seed(user, [
        ...many(33),
        ...many(12, { status: 'DONE' }).map((task, n) => ({
          ...task,
          title: `Done ${n}`,
        })),
      ]);
    });

    it.each([
      [20, 0, 20, true],
      [20, 20, 20, true],
      [20, 40, 5, false],
      [20, 25, 20, false],
      [1, 44, 1, false],
      [100, 0, 45, false],
      [20, 45, 0, false],
      [20, 1000, 0, false],
    ])(
      'AC-03.7.1 AC-03.7.2 AC-03.7.3 limit %i offset %i → %i tasks, hasNextPage %s',
      async (limit, offset, count, hasNextPage) => {
        const response = await list(user, { limit, offset });

        expect(response.status).toBe(200);
        expect(pageOf(response).data).toHaveLength(count);
        expect(pageOf(response).meta).toEqual({
          total: 45,
          limit,
          offset,
          hasNextPage,
        });
      },
    );

    it('AC-03.7.2 the total counts the filter’s matches, not the page', async () => {
      const response = await list(user, { status: 'DONE', limit: 5 });

      expect(pageOf(response).data).toHaveLength(5);
      expect(pageOf(response).meta.total).toBe(12);
    });

    it.each([
      ['limit', '0'],
      ['limit', '101'],
      ['limit', '-1'],
      ['limit', '2.5'],
      ['limit', 'ten'],
      ['offset', '-1'],
      ['offset', '1.5'],
      ['offset', 'x'],
    ])('AC-03.7.4 %s "%s" → 400 on it', async (param, value) => {
      expectInvalid(await list(user, { [param]: value }), param);
    });

    it('AC-03.7.5 walking all pages returns every task exactly once', async () => {
      const seen: string[] = [];
      for (let offset = 0; ; offset += 10) {
        const { data, meta } = pageOf(await list(user, { limit: 10, offset }));
        seen.push(...data.map((task) => task.id));
        if (!meta.hasNextPage) break;
      }

      expect(seen).toHaveLength(45);
      expect(new Set(seen).size).toBe(45);
    });
  });

  it('a 100-task page with 3 teams each runs at most 4 SQL statements on task and team tables', async () => {
    const user = await signUpAndSignIn(app);
    const teamIds = [
      await createTeam(user, 'One'),
      await createTeam(user, 'Two'),
      await createTeam(user, 'Three'),
    ];
    await seed(user, many(100, { teamIds }));

    statements.length = 0;
    recording = true;
    const response = await list(user, { limit: 100 });
    recording = false;

    expect(pageOf(response).data).toHaveLength(100);
    expect(pageOf(response).data.every((task) => task.teams.length === 3)).toBe(
      true,
    );
    const onTaskOrTeamTables = statements.filter((sql) =>
      /\b(tasks|teams|task_teams)\b/.test(sql),
    );
    expect(onTaskOrTeamTables.length).toBeLessThanOrEqual(4);
  });

  it('AC-03.12.5 without a session → 401 UNAUTHENTICATED', async () => {
    const response = await http().get(TASKS);

    expect(response.status).toBe(401);
    expect((response.body as { error: { code: string } }).error.code).toBe(
      'UNAUTHENTICATED',
    );
  });
});
