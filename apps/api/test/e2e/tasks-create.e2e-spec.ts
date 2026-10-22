import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request, { Response } from 'supertest';
import { App } from 'supertest/types';
import { Clock } from '../../src/shared/application/ports/clock';
import { createTestApp } from '../support/app';
import { bearerOf, signUpAndSignIn, TestUser } from '../support/auth';
import { useTestDatabase } from '../support/postgres';

const TASKS = '/api/v1/tasks';
const NOW = new Date('2026-10-20T13:00:00.000Z');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

interface TaskBody {
  id: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
  isOverdue: boolean;
  teams: { id: string; name: string; colorHex: string }[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    traceId: string;
  };
}

/**
 * POST /api/v1/tasks on the full AppModule (teams checked through the QueryBus), only the clock
 * fixed. Every rejection also asserts that no task row was written for the user.
 */
describe('POST /api/v1/tasks (e2e)', () => {
  const db = useTestDatabase();
  let app: INestApplication;
  let sql: Client;

  beforeAll(async () => {
    app = await createTestApp(db.url, {
      config: { authRateLimitEnabled: false, docsEnabled: true },
      providers: [{ provide: Clock, useValue: { now: () => NOW } }],
    });
    sql = new Client({ connectionString: db.url });
    await sql.connect();
  });

  afterAll(async () => {
    await sql?.end();
    await app?.close();
  });

  const http = () => request(app.getHttpServer() as App);
  const create = (user: TestUser, body: unknown) =>
    http()
      .post(TASKS)
      .set('Authorization', bearerOf(user))
      .send(body as object);
  const taskOf = (response: Response) =>
    (response.body as { data: TaskBody }).data;

  const createTeam = async (user: TestUser, name: string, colorHex: string) =>
    (
      (
        await http()
          .post('/api/v1/teams')
          .set('Authorization', bearerOf(user))
          .send({ name, colorHex })
      ).body as { data: { id: string } }
    ).data.id;
  const ownTeams = async (user: TestUser, count: number) => {
    const ids: string[] = [];
    for (let n = 1; n <= count; n += 1) {
      ids.push(await createTeam(user, `Team ${n}`, '#7C3AED'));
    }
    return ids;
  };

  const taskRowsOf = async (user: TestUser) =>
    Number(
      (
        await sql.query<{ n: string }>(
          'SELECT count(*) AS n FROM tasks WHERE owner_id = $1',
          [user.id],
        )
      ).rows[0]?.n,
    );

  const expectInvalid = (response: Response, field: string) => {
    expect(response.status).toBe(400);
    const { error } = response.body as ErrorBody;
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(
      (error.details as { field: string }[]).map((detail) => detail.field),
    ).toContain(field);
  };
  const expectRejectedWithNothingWritten = async (
    user: TestUser,
    response: Response,
    field: string,
  ) => {
    expectInvalid(response, field);
    expect(await taskRowsOf(user)).toBe(0);
  };

  describe('defaults and the response', () => {
    it('AC-03.1.1 a title alone → 201 PENDING task at version 1, Location, ETag, owner is the signed-in user', async () => {
      const user = await signUpAndSignIn(app);

      const response = await create(user, { title: 'Write release notes' });

      expect(response.status).toBe(201);
      const task = taskOf(response);
      expect(task).toEqual({
        id: expect.stringMatching(UUID) as string,
        title: 'Write release notes',
        description: null,
        status: 'PENDING',
        dueDate: null,
        completedAt: null,
        isOverdue: false,
        teams: [],
        version: 1,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      });
      expect(response.headers.location).toBe(`${TASKS}/${task.id}`);
      expect(response.headers.etag).toBe('W/"1"');
      const { rows } = await sql.query<{ owner_id: string }>(
        'SELECT owner_id FROM tasks WHERE id = $1',
        [task.id],
      );
      expect(rows).toEqual([{ owner_id: user.id }]);
    });

    it('AC-03.12.6 the new task belongs to the signed-in user only: another user cannot read it', async () => {
      const marina = await signUpAndSignIn(app, 'Marina');
      const joao = await signUpAndSignIn(app, 'Joao');

      const { id } = taskOf(await create(marina, { title: 'Mine' }));

      const response = await http()
        .get(`${TASKS}/${id}`)
        .set('Authorization', bearerOf(joao));
      expect(response.status).toBe(404);
    });

    it('AC-03.12.5 without a session → 401 UNAUTHENTICATED', async () => {
      const response = await http().post(TASKS).send({ title: 'Mine' });

      expect(response.status).toBe(401);
      expect((response.body as ErrorBody).error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('title (AC-03.1.2, AC-03.1.8)', () => {
    it.each([
      [0, false],
      [2, false],
      [3, true],
      [120, true],
      [121, false],
    ])(
      'AC-03.1.2 a title of %i characters padded with spaces → created: %s',
      async (length, created) => {
        const user = await signUpAndSignIn(app);

        const response = await create(user, {
          title: `  ${'a'.repeat(length)}  `,
        });

        if (created) {
          expect(response.status).toBe(201);
          expect(taskOf(response).title).toBe('a'.repeat(length));
        } else {
          await expectRejectedWithNothingWritten(user, response, 'title');
        }
      },
    );

    it('AC-03.1.2 the title is stored trimmed', async () => {
      const user = await signUpAndSignIn(app);

      const response = await create(user, { title: '   Plan sprint   ' });

      expect(taskOf(response).title).toBe('Plan sprint');
    });

    it('AC-03.1.2 a missing title → 400 on title, nothing created', async () => {
      const user = await signUpAndSignIn(app);

      await expectRejectedWithNothingWritten(
        user,
        await create(user, { description: 'No title' }),
        'title',
      );
    });

    it.each([
      ['a newline', 'Plan\nsprint'],
      ['a tab', 'Plan\tsprint'],
      ['a NUL character', 'Plan\u0000sprint'],
      ['an escape character', 'Plan\u001bsprint'],
      ['a trailing tab', 'Plan sprint\t'],
    ])(
      'AC-03.1.8 a title with %s → 400 on title, nothing created',
      async (_label, title) => {
        const user = await signUpAndSignIn(app);

        await expectRejectedWithNothingWritten(
          user,
          await create(user, { title }),
          'title',
        );
      },
    );
  });

  describe('description (AC-03.1.3, AC-03.1.8)', () => {
    it('AC-03.1.3 2000 characters are accepted, 2001 → 400 on description', async () => {
      const user = await signUpAndSignIn(app);

      const ok = await create(user, {
        title: 'Document API',
        description: 'd'.repeat(2000),
      });
      expect(ok.status).toBe(201);

      const tooLong = await create(user, {
        title: 'Document API',
        description: 'd'.repeat(2001),
      });
      expectInvalid(tooLong, 'description');
      expect(await taskRowsOf(user)).toBe(1);
    });

    it('AC-03.1.3 a blank description is stored as none, line breaks are kept', async () => {
      const user = await signUpAndSignIn(app);

      const blank = await create(user, {
        title: 'Document API',
        description: '   ',
      });
      const multiline = await create(user, {
        title: 'Document API',
        description: '  line one\nline two  ',
      });

      expect(taskOf(blank).description).toBeNull();
      expect(taskOf(multiline).description).toBe('line one\nline two');
    });

    it('AC-03.1.8 a description with a tab → 400 on description, nothing created', async () => {
      const user = await signUpAndSignIn(app);

      await expectRejectedWithNothingWritten(
        user,
        await create(user, { title: 'Document API', description: 'a\tb' }),
        'description',
      );
    });
  });

  describe('status (AC-03.1.4)', () => {
    it.each(['PENDING', 'IN_PROGRESS', 'DONE'])(
      'AC-03.1.4 status %s is accepted',
      async (status) => {
        const user = await signUpAndSignIn(app);

        const response = await create(user, { title: 'Fix crash', status });

        expect(response.status).toBe(201);
        expect(taskOf(response).status).toBe(status);
      },
    );

    it.each(['pending', 'BLOCKED', ''])(
      'AC-03.1.4 status "%s" → 400 on status, nothing created',
      async (status) => {
        const user = await signUpAndSignIn(app);

        await expectRejectedWithNothingWritten(
          user,
          await create(user, { title: 'Fix crash', status }),
          'status',
        );
      },
    );

    it('AC-03.1.4 creating a task as DONE records its completion time', async () => {
      const user = await signUpAndSignIn(app);

      const response = await create(user, {
        title: 'Already shipped',
        status: 'DONE',
      });

      expect(taskOf(response).completedAt).toBe(NOW.toISOString());
    });
  });

  describe('due date (AC-03.1.5)', () => {
    it.each(['2026-10-31', '2020-01-15', '2028-02-29'])(
      'AC-03.1.5 %s is accepted and stored as sent',
      async (dueDate) => {
        const user = await signUpAndSignIn(app);

        const response = await create(user, { title: 'Prepare demo', dueDate });

        expect(response.status).toBe(201);
        expect(taskOf(response).dueDate).toBe(dueDate);
      },
    );

    it.each([
      '2026-02-29',
      '2026-13-01',
      '2026-04-31',
      '31/10/2026',
      '20261031',
      '2026-10-31T10:00:00Z',
      'tomorrow',
    ])('AC-03.1.5 "%s" → 400 on dueDate, nothing created', async (dueDate) => {
      const user = await signUpAndSignIn(app);

      await expectRejectedWithNothingWritten(
        user,
        await create(user, { title: 'Prepare demo', dueDate }),
        'dueDate',
      );
    });
  });

  describe('mass assignment (AC-03.1.7, AC-01.6.4, AC-01.6.6, AC-03.12.6)', () => {
    it.each([
      ['id', randomUUID()],
      ['ownerId', 'someone-else'],
      ['owner_id', 'someone-else'],
      ['userId', 'someone-else'],
      ['owner', { id: 'someone-else' }],
      ['version', 7],
      ['completedAt', '2020-01-01T00:00:00.000Z'],
      ['isOverdue', true],
      ['createdAt', '2020-01-01T00:00:00.000Z'],
      ['updatedAt', '2020-01-01T00:00:00.000Z'],
      ['deletedAt', '2020-01-01T00:00:00.000Z'],
      ['teams', [{ id: randomUUID() }]],
      ['priority', 'high'],
    ])(
      'AC-03.1.7 AC-01.6.4 AC-01.6.6 an extra %s → 400 naming it, nothing created',
      async (field, value) => {
        const user = await signUpAndSignIn(app);

        await expectRejectedWithNothingWritten(
          user,
          await create(user, { title: 'Sneaky', [field]: value }),
          field,
        );
      },
    );

    it.each(['__proto__', 'constructor'])(
      'AC-03.1.7 AC-01.6.6 a %s key → 400 naming it, nothing created',
      async (field) => {
        const user = await signUpAndSignIn(app);
        // A raw JSON body: an object literal would not carry __proto__ as an own key.
        const response = await http()
          .post(TASKS)
          .set('Authorization', bearerOf(user))
          .set('Content-Type', 'application/json')
          .send(`{"title":"Sneaky","${field}":{"ownerId":"someone-else"}}`);

        await expectRejectedWithNothingWritten(user, response, field);
      },
    );

    it("AC-03.12.6 AC-01.6.4 an owner object holding another user's id is rejected, not merged", async () => {
      const marina = await signUpAndSignIn(app, 'Marina');
      const joao = await signUpAndSignIn(app, 'Joao');

      const response = await create(marina, {
        title: 'Sneaky',
        owner: { id: joao.id },
      });

      await expectRejectedWithNothingWritten(marina, response, 'owner');
      expect(await taskRowsOf(joao)).toBe(0);
    });
  });

  describe('teams (AC-03.1.6, AC-03.12.3, AC-01.6.5)', () => {
    it('AC-03.1.6 a task assigned to two teams embeds them ordered by name', async () => {
      const user = await signUpAndSignIn(app);
      const mobile = await createTeam(user, 'Mobile', '#7C3AED');
      const backend = await createTeam(user, 'Backend', '#0EA5E9');

      const response = await create(user, {
        title: 'Release 1.0',
        teamIds: [mobile, backend],
      });

      expect(response.status).toBe(201);
      expect(taskOf(response).teams).toEqual([
        { id: backend, name: 'Backend', colorHex: '#0EA5E9' },
        { id: mobile, name: 'Mobile', colorHex: '#7C3AED' },
      ]);
    });

    describe('AC-03.1.6 team count boundaries with 11 teams owned', () => {
      it.each([
        [0, 201],
        [1, 201],
        [10, 201],
      ])('%i distinct teams → %i', async (count, status) => {
        const user = await signUpAndSignIn(app);
        const teams = await ownTeams(user, 11);

        const response = await create(user, {
          title: 'Spread',
          teamIds: teams.slice(0, count),
        });

        expect(response.status).toBe(status);
        expect(taskOf(response).teams).toHaveLength(count);
      });

      it('11 distinct teams → 422 TOO_MANY_TEAMS { max: 10, received: 11 }, nothing created', async () => {
        const user = await signUpAndSignIn(app);
        const teams = await ownTeams(user, 11);

        const response = await create(user, {
          title: 'Spread',
          teamIds: teams,
        });

        expect(response.status).toBe(422);
        expect((response.body as ErrorBody).error).toMatchObject({
          code: 'TOO_MANY_TEAMS',
          details: { max: 10, received: 11 },
        });
        expect(await taskRowsOf(user)).toBe(0);
      });
    });

    it('AC-03.1.6 101 team ids → 400 on teamIds (payload guard)', async () => {
      const user = await signUpAndSignIn(app);

      const response = await create(user, {
        title: 'Spread',
        teamIds: Array.from({ length: 101 }, () => randomUUID()),
      });

      await expectRejectedWithNothingWritten(user, response, 'teamIds');
    });

    it('AC-03.1.6 the same team twice → 400 on teamIds', async () => {
      const user = await signUpAndSignIn(app);
      const mobile = await createTeam(user, 'Mobile', '#7C3AED');

      await expectRejectedWithNothingWritten(
        user,
        await create(user, { title: 'Twice', teamIds: [mobile, mobile] }),
        'teamIds',
      );
    });

    it('AC-03.1.6 a malformed team id → 400 on teamIds', async () => {
      const user = await signUpAndSignIn(app);

      await expectRejectedWithNothingWritten(
        user,
        await create(user, { title: 'Bad id', teamIds: ['not-a-uuid'] }),
        'teamIds',
      );
    });

    it('AC-03.1.6 unknown and deleted teams → 422 UNKNOWN_TEAMS listing exactly them, nothing created', async () => {
      const user = await signUpAndSignIn(app);
      const mobile = await createTeam(user, 'Mobile', '#7C3AED');
      const design = await createTeam(user, 'Design', '#F59E0B');
      await sql.query('UPDATE teams SET deleted_at = now() WHERE id = $1', [
        design,
      ]);
      const never = randomUUID();

      const response = await create(user, {
        title: 'Release',
        teamIds: [mobile, never, design],
      });

      expect(response.status).toBe(422);
      const { error } = response.body as ErrorBody;
      expect(error.code).toBe('UNKNOWN_TEAMS');
      expect(
        [...(error.details as { teamIds: string[] }).teamIds].sort(),
      ).toEqual([never, design].sort());
      expect(await taskRowsOf(user)).toBe(0);
    });

    it("AC-03.12.3 AC-01.6.5 another user's team → 422 UNKNOWN_TEAMS with only that id", async () => {
      const marina = await signUpAndSignIn(app, 'Marina');
      const joao = await signUpAndSignIn(app, 'Joao');
      const mobile = await createTeam(marina, 'Mobile', '#7C3AED');
      const ops = await createTeam(joao, 'Ops', '#111111');

      const response = await create(marina, {
        title: 'Mine',
        teamIds: [mobile, ops],
      });

      expect(response.status).toBe(422);
      expect((response.body as ErrorBody).error).toMatchObject({
        code: 'UNKNOWN_TEAMS',
        details: { teamIds: [ops] },
      });
      expect(await taskRowsOf(marina)).toBe(0);
    });

    it('AC-03.1.6 AC-01.6.5 a foreign team and a never-existing team give identical bodies apart from the id and traceId', async () => {
      const marina = await signUpAndSignIn(app, 'Marina');
      const joao = await signUpAndSignIn(app, 'Joao');
      const ops = await createTeam(joao, 'Ops', '#111111');
      const never = randomUUID();

      const foreign = await create(marina, { title: 'Mine', teamIds: [ops] });
      const unknown = await create(marina, { title: 'Mine', teamIds: [never] });

      expect([foreign.status, unknown.status]).toEqual([422, 422]);
      const normalize = (response: Response, id: string) =>
        JSON.stringify(response.body)
          .replace(id, '<id>')
          .replace(/"traceId":"[^"]*"/, '"traceId":"<trace>"');
      expect(normalize(foreign, ops)).toBe(normalize(unknown, never));
      expect(
        (foreign.body as ErrorBody).error.details as { teamIds: string[] },
      ).toEqual({ teamIds: [ops] });
      expect(
        (unknown.body as ErrorBody).error.details as { teamIds: string[] },
      ).toEqual({ teamIds: [never] });
    });

    it('AC-03.1.6 11 ids none of which exist → TOO_MANY_TEAMS before UNKNOWN_TEAMS', async () => {
      const user = await signUpAndSignIn(app);

      const response = await create(user, {
        title: 'Spread',
        teamIds: Array.from({ length: 11 }, () => randomUUID()),
      });

      expect(response.status).toBe(422);
      expect((response.body as ErrorBody).error.code).toBe('TOO_MANY_TEAMS');
    });
  });

  it('documents the 201 { data: Task } response and the request body in OpenAPI', async () => {
    const document = (await http().get('/docs/openapi.json')).body as {
      paths: Record<
        string,
        {
          post?: {
            responses: Record<string, unknown>;
            requestBody?: unknown;
          };
        }
      >;
    };

    const post = document.paths['/api/v1/tasks']?.post;
    expect(JSON.stringify(post?.responses['201'])).toContain(
      '#/components/schemas/TaskResponseDto',
    );
    expect(JSON.stringify(post?.requestBody)).toContain(
      '#/components/schemas/CreateTaskDto',
    );
  });
});
