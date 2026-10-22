import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request, { Response } from 'supertest';
import { App } from 'supertest/types';
import { Clock } from '../../src/shared/application/ports/clock';
import { PrismaService } from '../../src/shared/infrastructure/prisma/prisma.service';
import { createTestApp } from '../support/app';
import { bearerOf, signUpAndSignIn, TestUser } from '../support/auth';
import { useTestDatabase } from '../support/postgres';

const TASKS = '/api/v1/tasks';
const CREATED = new Date('2026-10-20T13:00:00.000Z');
const NOW = new Date('2026-10-21T09:00:00.000Z');

interface TaskBody {
  id: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
  teams: { id: string; name: string }[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface Draft {
  user: TestUser;
  id: string;
  teams: { mobile: string; backend: string; design: string };
  /** The task's current values, as a valid PUT body. */
  current: {
    title: string;
    description: string;
    status: string;
    dueDate: string;
    teamIds: string[];
  };
}

/**
 * PUT /api/v1/tasks/:id on the full AppModule, only the clock fixed. Each test starts from the
 * feature's background: "Draft", description "v1", PENDING, due 2026-10-30, teams Mobile and
 * Backend, version 1, created at 2026-10-20T13:00Z.
 */
describe('PUT /api/v1/tasks/:id (e2e)', () => {
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
  const put = (user: TestUser, id: string, body: unknown) =>
    http()
      .put(`${TASKS}/${id}`)
      .set('Authorization', bearerOf(user))
      .send(body as object);
  const taskOf = (response: Response) =>
    (response.body as { data: TaskBody }).data;
  const errorOf = (response: Response) =>
    (
      response.body as {
        error: { code: string; details?: unknown };
      }
    ).error;

  const createTeam = async (user: TestUser, name: string, colorHex: string) =>
    (
      (
        await http()
          .post('/api/v1/teams')
          .set('Authorization', bearerOf(user))
          .send({ name, colorHex })
      ).body as { data: { id: string } }
    ).data.id;

  async function draft(): Promise<Draft> {
    const user = await signUpAndSignIn(app);
    const teams = {
      mobile: await createTeam(user, 'Mobile', '#7C3AED'),
      backend: await createTeam(user, 'Backend', '#0EA5E9'),
      design: await createTeam(user, 'Design', '#F59E0B'),
    };
    const id = randomUUID();
    await prisma.task.create({
      data: {
        id,
        ownerId: user.id,
        title: 'Draft',
        description: 'v1',
        status: 'PENDING',
        dueDate: new Date('2026-10-30T00:00:00.000Z'),
        version: 1,
        createdAt: CREATED,
        updatedAt: CREATED,
        teams: {
          create: [{ teamId: teams.mobile }, { teamId: teams.backend }],
        },
      },
    });
    return {
      user,
      id,
      teams,
      current: {
        title: 'Draft',
        description: 'v1',
        status: 'PENDING',
        dueDate: '2026-10-30',
        teamIds: [teams.mobile, teams.backend],
      },
    };
  }

  /** The stored row is still the background's, at version 1. */
  const expectUnchanged = async ({ id, teams }: Draft) => {
    const row = await prisma.task.findUniqueOrThrow({
      where: { id },
      select: {
        title: true,
        description: true,
        version: true,
        updatedAt: true,
        teams: { select: { teamId: true }, orderBy: { teamId: 'asc' } },
      },
    });
    expect(row).toEqual({
      title: 'Draft',
      description: 'v1',
      version: 1,
      updatedAt: CREATED,
      teams: [teams.mobile, teams.backend].sort().map((teamId) => ({ teamId })),
    });
  };

  it('AC-03.9.1 AC-03.9.6 replaces every editable field: version 2, updated now, id and created time kept, no ETag', async () => {
    const task = await draft();

    const response = await put(task.user, task.id, {
      title: 'Final',
      description: 'v2',
      status: 'IN_PROGRESS',
      dueDate: '2026-11-02',
      teamIds: [task.teams.design],
    });

    expect(response.status).toBe(200);
    expect(response.headers.etag).toBeUndefined(); // AC-08.3
    expect(taskOf(response)).toMatchObject({
      id: task.id,
      title: 'Final',
      description: 'v2',
      status: 'IN_PROGRESS',
      dueDate: '2026-11-02',
      teams: [{ id: task.teams.design, name: 'Design' }],
      version: 2,
      createdAt: CREATED.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    const stored = await prisma.task.findUniqueOrThrow({
      where: { id: task.id },
      select: { ownerId: true },
    });
    expect(stored).toEqual({ ownerId: task.user.id });
  });

  it('AC-03.9.2 omitted description and due date are cleared; an empty team list unassigns all', async () => {
    const task = await draft();

    const response = await put(task.user, task.id, {
      title: 'Draft',
      status: 'PENDING',
      teamIds: [],
    });

    expect(taskOf(response)).toMatchObject({
      description: null,
      dueDate: null,
      teams: [],
    });
  });

  it('AC-03.9.2 reassigning teams replaces the whole set', async () => {
    const task = await draft();

    const response = await put(task.user, task.id, {
      ...task.current,
      teamIds: [task.teams.backend, task.teams.design],
    });

    expect(taskOf(response).teams.map((team) => team.name)).toEqual([
      'Backend',
      'Design',
    ]);
  });

  it.each(['title', 'status', 'teamIds'])(
    'AC-03.9.3 without %s → 400 on it, the task unchanged',
    async (field) => {
      const task = await draft();
      const body: Record<string, unknown> = { ...task.current };
      delete body[field];

      const response = await put(task.user, task.id, body);

      expect(response.status).toBe(400);
      expect(errorOf(response).code).toBe('VALIDATION_FAILED');
      expect(
        (errorOf(response).details as { field: string }[]).map((d) => d.field),
      ).toContain(field);
      await expectUnchanged(task);
    },
  );

  describe('AC-03.9.3 AC-01.6.4 AC-01.6.6 create rules apply to edits; the task unchanged', () => {
    it.each<[string, (d: Draft) => Record<string, unknown>, string]>([
      [
        'a title of 2 characters',
        (d) => ({ ...d.current, title: 'ab' }),
        'title',
      ],
      [
        'a title of 121 characters',
        (d) => ({ ...d.current, title: 'a'.repeat(121) }),
        'title',
      ],
      [
        'a title with a control character',
        (d) => ({ ...d.current, title: 'Dr\u0007aft' }),
        'title',
      ],
      [
        'a description of 2001 characters',
        (d) => ({ ...d.current, description: 'd'.repeat(2001) }),
        'description',
      ],
      [
        'the due date 2026-02-30',
        (d) => ({ ...d.current, dueDate: '2026-02-30' }),
        'dueDate',
      ],
      [
        'the status CANCELLED',
        (d) => ({ ...d.current, status: 'CANCELLED' }),
        'status',
      ],
      [
        'a duplicated team',
        (d) => ({ ...d.current, teamIds: [d.teams.mobile, d.teams.mobile] }),
        'teamIds',
      ],
      ...[
        ['id', randomUUID()],
        ['ownerId', 'someone-else'],
        ['owner_id', 'someone-else'],
        ['userId', 'someone-else'],
        ['owner', { id: 'someone-else' }],
        ['version', 9],
        ['completedAt', '2020-01-01T00:00:00.000Z'],
        ['createdAt', '2020-01-01T00:00:00.000Z'],
        ['updatedAt', '2020-01-01T00:00:00.000Z'],
        ['deletedAt', '2020-01-01T00:00:00.000Z'],
        ['teams', []],
        ['isOverdue', true],
      ].map(
        ([field, value]) =>
          [
            `the extra field ${field as string}`,
            (d: Draft) => ({ ...d.current, [field as string]: value }),
            field as string,
          ] as [string, (d: Draft) => Record<string, unknown>, string],
      ),
    ])('%s → 400 on it', async (_label, body, field) => {
      const task = await draft();

      const response = await put(task.user, task.id, body(task));

      expect(response.status).toBe(400);
      expect(errorOf(response).code).toBe('VALIDATION_FAILED');
      expect(
        (errorOf(response).details as { field: string }[]).map((d) => d.field),
      ).toContain(field);
      await expectUnchanged(task);
    });

    it.each(['__proto__', 'constructor'])(
      'the extra key %s → 400',
      async (field) => {
        const task = await draft();

        const response = await http()
          .put(`${TASKS}/${task.id}`)
          .set('Authorization', bearerOf(task.user))
          .set('Content-Type', 'application/json')
          .send(
            JSON.stringify(task.current).replace(
              /}$/,
              `,"${field}":{"ownerId":"someone-else"}}`,
            ),
          );

        expect(response.status).toBe(400);
        await expectUnchanged(task);
      },
    );

    it('11 teams → 422 TOO_MANY_TEAMS', async () => {
      const task = await draft();
      const more = [];
      for (let n = 1; n <= 8; n += 1) {
        more.push(await createTeam(task.user, `Extra ${n}`, '#111111'));
      }

      const response = await put(task.user, task.id, {
        ...task.current,
        teamIds: [...Object.values(task.teams), ...more],
      });

      expect(response.status).toBe(422);
      expect(errorOf(response)).toMatchObject({
        code: 'TOO_MANY_TEAMS',
        details: { max: 10, received: 11 },
      });
      await expectUnchanged(task);
    });

    it('a team that does not exist → 422 UNKNOWN_TEAMS with exactly its id', async () => {
      const task = await draft();
      const never = randomUUID();

      const response = await put(task.user, task.id, {
        ...task.current,
        teamIds: [task.teams.mobile, never],
      });

      expect(response.status).toBe(422);
      expect(errorOf(response)).toMatchObject({
        code: 'UNKNOWN_TEAMS',
        details: { teamIds: [never] },
      });
      await expectUnchanged(task);
    });
  });

  it("AC-03.12.3 another user's team → 422 UNKNOWN_TEAMS with only its id, the task unchanged", async () => {
    const task = await draft();
    const joao = await signUpAndSignIn(app, 'Joao');
    const ops = await createTeam(joao, 'Ops', '#111111');

    const response = await put(task.user, task.id, {
      ...task.current,
      teamIds: [task.teams.mobile, ops],
    });

    expect(response.status).toBe(422);
    expect(errorOf(response)).toMatchObject({
      code: 'UNKNOWN_TEAMS',
      details: { teamIds: [ops] },
    });
    await expectUnchanged(task);
  });

  it('AC-03.9.4 editing into DONE records the completion time; editing out of DONE clears it', async () => {
    const task = await draft();

    const done = await put(task.user, task.id, {
      ...task.current,
      status: 'DONE',
    });
    expect(taskOf(done).completedAt).toBe(NOW.toISOString());

    const reopened = await put(task.user, task.id, {
      ...task.current,
      status: 'PENDING',
    });
    expect(taskOf(reopened).completedAt).toBeNull();
  });

  it('AC-03.9.5 an identical replacement (teams in another order) is a no-op: version 1, updated time kept, no ETag', async () => {
    const task = await draft();

    const response = await put(task.user, task.id, {
      ...task.current,
      teamIds: [task.teams.backend, task.teams.mobile],
    });

    expect(response.status).toBe(200);
    expect(response.headers.etag).toBeUndefined(); // AC-08.3
    expect(taskOf(response)).toMatchObject({
      version: 1,
      updatedAt: CREATED.toISOString(),
    });
    await expectUnchanged(task);
  });

  it('AC-03.9.6 an unknown or deleted task → 404 TASK_NOT_FOUND', async () => {
    const task = await draft();
    await prisma.task.update({
      where: { id: task.id },
      data: { deletedAt: CREATED },
    });

    for (const id of [randomUUID(), task.id]) {
      const response = await put(task.user, id, task.current);
      expect(response.status).toBe(404);
      expect(errorOf(response).code).toBe('TASK_NOT_FOUND');
    }
  });

  it("AC-03.12.1 AC-03.12.6 another user's task → 404, and it is unchanged", async () => {
    const task = await draft();
    const joao = await signUpAndSignIn(app, 'Joao');

    const response = await put(joao, task.id, { ...task.current, teamIds: [] });

    expect(response.status).toBe(404);
    expect(errorOf(response).code).toBe('TASK_NOT_FOUND');
    await expectUnchanged(task);
  });

  it('a malformed id → 400 on id; no session → 401', async () => {
    const task = await draft();

    const malformed = await put(task.user, 'abc', task.current);
    const anonymous = await http()
      .put(`${TASKS}/${task.id}`)
      .send(task.current);

    expect(malformed.status).toBe(400);
    expect(anonymous.status).toBe(401);
    expect(errorOf(anonymous).code).toBe('UNAUTHENTICATED');
  });

  it('documents the request body and the 200 response in OpenAPI', async () => {
    const document = (await http().get('/docs/openapi.json')).body as {
      paths: Record<
        string,
        { put?: { responses: Record<string, unknown>; requestBody?: unknown } }
      >;
    };

    const operation = document.paths['/api/v1/tasks/{id}']?.put;
    expect(JSON.stringify(operation?.responses['200'])).toContain(
      '#/components/schemas/TaskResponseDto',
    );
    expect(JSON.stringify(operation?.requestBody)).toContain(
      '#/components/schemas/ReplaceTaskDto',
    );
  });
});
