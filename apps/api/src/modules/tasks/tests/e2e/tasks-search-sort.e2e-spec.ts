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

type Status = 'PENDING' | 'IN_PROGRESS' | 'DONE';

interface Seed {
  title: string;
  description?: string;
  status?: Status;
  teamIds?: string[];
  dueDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface PageBody {
  data: { id: string; title: string }[];
  meta: { total: number; hasNextPage: boolean };
}

const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

describe('GET /api/v1/tasks — search and sort (e2e)', () => {
  const db = useTestDatabase();
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp(db.url, {
      config: { authRateLimitEnabled: false, docsEnabled: true },
      providers: [{ provide: Clock, useValue: { now: () => NOW } }],
    });
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
  });

  const http = () => request(app.getHttpServer() as App);
  const list = (user: TestUser, query: Record<string, unknown> = {}) =>
    http().get(TASKS).query(query).set('Authorization', bearerOf(user));
  const pageOf = (response: Response) => response.body as PageBody;
  const titlesOf = (response: Response) =>
    pageOf(response).data.map((task) => task.title);
  const expectInvalid = (response: Response, field: string) => {
    expect(response.status).toBe(400);
    const { error } = response.body as {
      error: { code: string; details: { field: string }[] };
    };
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.details.map((detail) => detail.field)).toContain(field);
  };

  const createTeam = async (user: TestUser, name: string) =>
    (
      (
        await http()
          .post('/api/v1/teams')
          .set('Authorization', bearerOf(user))
          .send({ name, colorHex: '#7C3AED' })
      ).body as { data: { id: string } }
    ).data.id;

  async function seed(
    owner: TestUser,
    tasks: Seed[],
  ): Promise<Record<string, string>> {
    const ids: Record<string, string> = {};
    const base = Date.parse('2026-09-01T00:00:00.000Z');
    await prisma.task.createMany({
      data: tasks.map((task, index) => {
        const id = randomUUID();
        ids[task.title] = id;
        const createdAt = new Date(task.createdAt ?? base + index * 60_000);
        const status = task.status ?? 'PENDING';
        return {
          id,
          ownerId: owner.id,
          title: task.title,
          description: task.description ?? null,
          status,
          dueDate: task.dueDate
            ? new Date(`${task.dueDate}T00:00:00.000Z`)
            : null,
          completedAt: status === 'DONE' ? createdAt : null,
          createdAt,
          updatedAt: new Date(task.updatedAt ?? createdAt),
        };
      }),
    });
    await prisma.taskTeam.createMany({
      data: tasks.flatMap((task) =>
        (task.teamIds ?? []).map((teamId) => ({
          taskId: ids[task.title] as string,
          teamId,
        })),
      ),
    });
    return ids;
  }

  describe('search (AC-03.5.x) and filters combined (AC-03.4.4)', () => {
    let user: TestUser;
    let teams: Record<'Mobile' | 'Backend' | 'Design', string>;

    beforeAll(async () => {
      user = await signUpAndSignIn(app);
      teams = {
        Mobile: await createTeam(user, 'Mobile'),
        Backend: await createTeam(user, 'Backend'),
        Design: await createTeam(user, 'Design'),
      };
      await seed(user, [
        {
          title: 'Login screen',
          description: 'Email and password',
          status: 'IN_PROGRESS',
          teamIds: [teams.Mobile],
        },
        {
          title: 'Login API',
          description: 'Session endpoint',
          status: 'PENDING',
          teamIds: [teams.Backend],
        },
        {
          title: 'Release notes',
          description: 'Summarize LOGIN fixes',
          status: 'DONE',
          teamIds: [teams.Mobile, teams.Backend],
        },
        {
          title: 'Color tokens',
          description: 'Palette for chips',
          status: 'PENDING',
          teamIds: [teams.Design],
        },
        { title: 'Personal errand', status: 'PENDING' },
      ]);
    });

    it.each<[string, string[]]>([
      ['login', ['Login API', 'Login screen', 'Release notes']],
      ['PALETTE', ['Color tokens']],
      ['endpoint', ['Login API']],
      ['zzz', []],
    ])(
      'AC-03.5.1 AC-03.5.4 "%s" matches title or description, ignoring case',
      async (search, expected) => {
        const response = await list(user, { search });

        expect(response.status).toBe(200);
        expect(titlesOf(response).sort()).toEqual(expected);
        expect(pageOf(response).meta.total).toBe(expected.length);
      },
    );

    it.each([
      [1, 200],
      [100, 200],
    ])(
      'AC-03.5.2 a term of %i characters is listed',
      async (length, status) => {
        expect((await list(user, { search: 'x'.repeat(length) })).status).toBe(
          status,
        );
      },
    );

    it.each(['', '   ', 'x'.repeat(101)])(
      'AC-03.5.2 search %p → 400 on search',
      async (search) => {
        expectInvalid(await list(user, { search }), 'search');
      },
    );

    it.each<[keyof typeof teams | '', string, string, string[]]>([
      ['Mobile', 'PENDING,IN_PROGRESS', 'login', ['Login screen']],
      ['Backend', 'PENDING,IN_PROGRESS', 'login', ['Login API']],
      ['Backend', 'DONE', 'login', ['Release notes']],
      ['Design', 'DONE', 'color', []],
      ['', 'PENDING', 'login', ['Login API']],
    ])(
      'AC-03.4.4 team %p, status %p and search %p combine with AND',
      async (team, status, search, expected) => {
        const response = await list(user, {
          ...(team ? { teamId: teams[team] } : {}),
          status,
          search,
        });

        expect(titlesOf(response).sort()).toEqual(expected);
      },
    );
  });

  it.each<[string, string[]]>([
    ['100%', ['Reach 100% coverage']],
    ['snake_case', ['snake_case names']],
    ['\\', []],
  ])('AC-03.5.3 "%s" is matched literally', async (search, expected) => {
    const user = await signUpAndSignIn(app);
    await seed(user, [
      { title: 'Reach 100% coverage' },
      { title: 'Reach 1000 users' },
      { title: 'snake_case names' },
      { title: 'snakeXcase names' },
    ]);

    expect(titlesOf(await list(user, { search }))).toEqual(expected);
  });

  describe('sort (AC-03.6.x)', () => {
    let user: TestUser;
    let ids: Record<string, string>;
    const tied = (titles: string[], direction: 'asc' | 'desc') => {
      const ordered = [...titles].sort((a, b) =>
        byId(ids[a] as string, ids[b] as string),
      );
      return direction === 'asc' ? ordered : ordered.reverse();
    };

    beforeAll(async () => {
      user = await signUpAndSignIn(app);
      ids = await seed(user, [
        {
          title: 'bravo',
          status: 'DONE',
          dueDate: '2026-10-25',
          createdAt: '2026-10-01T10:00:00Z',
          updatedAt: '2026-10-05T10:00:00Z',
        },
        {
          title: 'Alpha',
          status: 'PENDING',
          createdAt: '2026-10-02T10:00:00Z',
          updatedAt: '2026-10-02T10:00:00Z',
        },
        {
          title: 'charlie',
          status: 'IN_PROGRESS',
          dueDate: '2026-10-21',
          createdAt: '2026-10-03T10:00:00Z',
          updatedAt: '2026-10-04T10:00:00Z',
        },
        {
          title: 'Delta',
          status: 'PENDING',
          dueDate: '2026-10-21',
          createdAt: '2026-10-04T10:00:00Z',
          updatedAt: '2026-10-06T10:00:00Z',
        },
        {
          title: 'echo',
          status: 'PENDING',
          createdAt: '2026-10-05T10:00:00Z',
          updatedAt: '2026-10-05T11:00:00Z',
        },
      ]);
    });

    const order = async (sort?: string) =>
      titlesOf(await list(user, sort === undefined ? {} : { sort }));

    it.each<[string | undefined, () => string[]]>([
      [undefined, () => ['echo', 'Delta', 'charlie', 'Alpha', 'bravo']],
      ['-createdAt', () => ['echo', 'Delta', 'charlie', 'Alpha', 'bravo']],
      ['createdAt', () => ['bravo', 'Alpha', 'charlie', 'Delta', 'echo']],
      ['-updatedAt', () => ['Delta', 'echo', 'bravo', 'charlie', 'Alpha']],
      ['title', () => ['Alpha', 'bravo', 'charlie', 'Delta', 'echo']],
      ['-title', () => ['echo', 'Delta', 'charlie', 'bravo', 'Alpha']],
      [
        'dueDate',
        () => [
          ...tied(['charlie', 'Delta'], 'asc'),
          'bravo',
          ...tied(['Alpha', 'echo'], 'asc'),
        ],
      ],
      [
        '-dueDate',
        () => [
          'bravo',
          ...tied(['charlie', 'Delta'], 'desc'),
          ...tied(['Alpha', 'echo'], 'desc'),
        ],
      ],
      [
        'status',
        () => [...tied(['Alpha', 'Delta', 'echo'], 'asc'), 'charlie', 'bravo'],
      ],
      [
        '-status',
        () => ['bravo', 'charlie', ...tied(['Alpha', 'Delta', 'echo'], 'desc')],
      ],
    ])(
      'AC-03.6.1 AC-03.6.2 AC-03.6.3 AC-03.6.4 sort %p, ties by id in the sort direction',
      async (sort, expected) => {
        const first = await order(sort);

        expect(first).toEqual(expected());
        expect(await order(sort)).toEqual(first);
      },
    );

    it.each(['dueDate', '-dueDate'])(
      'AC-03.6.3 %s puts the tasks without a due date last',
      async (sort) => {
        expect((await order(sort)).slice(-2).sort()).toEqual(['Alpha', 'echo']);
      },
    );

    it.each([
      'priority',
      '--title',
      '+title',
      'title,-createdAt',
      'ownerId',
      '-',
    ])('AC-03.6.5 sort "%s" → 400 on sort', async (sort) => {
      expectInvalid(await list(user, { sort }), 'sort');
    });

    it('AC-03.6.5 a repeated sort parameter → 400 on sort', async () => {
      expectInvalid(await list(user, { sort: ['title', '-title'] }), 'sort');
    });
  });

  it('AC-03.6.4 AC-03.7.5 pages of a tied sort never overlap', async () => {
    const user = await signUpAndSignIn(app);
    await seed(
      user,
      Array.from({ length: 30 }, (_, n) => ({ title: `Pending ${n}` })),
    );

    const seen: string[] = [];
    for (let offset = 0; ; offset += 7) {
      const { data, meta } = pageOf(
        await list(user, { sort: 'status', limit: 7, offset }),
      );
      seen.push(...data.map((task) => task.id));
      if (!meta.hasNextPage) break;
    }

    expect(seen).toHaveLength(30);
    expect(new Set(seen).size).toBe(30);
  });

  it('documents the search and sort parameters in OpenAPI', async () => {
    const document = (await http().get('/docs/openapi.json')).body as {
      paths: Record<
        string,
        {
          get?: {
            parameters?: { name: string; schema?: { enum?: string[] } }[];
          };
        }
      >;
    };

    const parameters = document.paths['/api/v1/tasks']?.get?.parameters ?? [];
    expect(parameters.map((parameter) => parameter.name)).toEqual(
      expect.arrayContaining([
        'limit',
        'offset',
        'teamId',
        'status',
        'search',
        'sort',
      ]),
    );
    expect(parameters.find((p) => p.name === 'sort')?.schema?.enum).toEqual(
      expect.arrayContaining(['createdAt', '-createdAt', 'status', '-status']),
    );
  });
});
