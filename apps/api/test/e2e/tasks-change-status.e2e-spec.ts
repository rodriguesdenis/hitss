import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request, { Response } from 'supertest';
import { App } from 'supertest/types';
import { Clock } from '../../src/shared/application/ports/clock';
import { PrismaService } from '../../src/shared/infrastructure/prisma/prisma.service';
import { createTestApp } from '../support/app';
import { bearerOf, TestUser, twoUsers } from '../support/auth';
import { useTestDatabase } from '../support/postgres';

const TASKS = '/api/v1/tasks';
const NOW = new Date('2026-10-20T13:00:00.000Z');
const EARLIER = new Date('2026-10-19T08:00:00.000Z');

type Status = 'PENDING' | 'IN_PROGRESS' | 'DONE';

interface TaskBody {
  title: string;
  description: string | null;
  status: Status;
  dueDate: string | null;
  completedAt: string | null;
  isOverdue: boolean;
  teams: { id: string }[];
  version: number;
  updatedAt: string;
}

/** PATCH /api/v1/tasks/:id/status on the full AppModule, only the clock fixed. */
describe('PATCH /api/v1/tasks/:id/status (e2e)', () => {
  const db = useTestDatabase();
  let app: INestApplication;
  let prisma: PrismaService;
  let marina: TestUser;
  let rafael: TestUser;

  beforeAll(async () => {
    app = await createTestApp(db.url, {
      config: { authRateLimitEnabled: false, docsEnabled: true },
      providers: [{ provide: Clock, useValue: { now: () => NOW } }],
    });
    prisma = app.get(PrismaService);
    ({ marina, rafael } = await twoUsers(app));
  });

  afterAll(async () => {
    await app?.close();
  });

  const http = () => request(app.getHttpServer() as App);
  const patch = (user: TestUser, id: string, body: unknown) =>
    http()
      .patch(`${TASKS}/${id}/status`)
      .set('Authorization', bearerOf(user))
      .send(body as object);
  const taskOf = (response: Response) =>
    (response.body as { data: TaskBody }).data;
  const codeOf = (response: Response) =>
    (response.body as { error: { code: string } }).error.code;

  /** A task at version 3, last updated (and, if DONE, completed) at EARLIER. */
  async function task(
    owner: TestUser,
    status: Status,
    extra: { dueDate?: string; teamIds?: string[]; deleted?: boolean } = {},
  ): Promise<string> {
    const id = randomUUID();
    await prisma.task.create({
      data: {
        id,
        ownerId: owner.id,
        title: 'Ship it',
        description: 'notes',
        status,
        dueDate: extra.dueDate
          ? new Date(`${extra.dueDate}T00:00:00.000Z`)
          : null,
        completedAt: status === 'DONE' ? EARLIER : null,
        version: 3,
        createdAt: EARLIER,
        updatedAt: EARLIER,
        deletedAt: extra.deleted ? EARLIER : null,
        teams: { create: (extra.teamIds ?? []).map((teamId) => ({ teamId })) },
      },
    });
    return id;
  }

  const stored = (id: string) =>
    prisma.task.findUniqueOrThrow({
      where: { id },
      select: { status: true, version: true, updatedAt: true },
    });

  describe('AC-03.10.1 AC-03.10.2 AC-03.10.3 status transition matrix', () => {
    it.each<[Status, Status, number, string | null]>([
      ['PENDING', 'PENDING', 3, null],
      ['PENDING', 'IN_PROGRESS', 4, null],
      ['PENDING', 'DONE', 4, NOW.toISOString()],
      ['IN_PROGRESS', 'PENDING', 4, null],
      ['IN_PROGRESS', 'IN_PROGRESS', 3, null],
      ['IN_PROGRESS', 'DONE', 4, NOW.toISOString()],
      ['DONE', 'PENDING', 4, null],
      ['DONE', 'IN_PROGRESS', 4, null],
      ['DONE', 'DONE', 3, EARLIER.toISOString()],
    ])(
      '%s → %s: 200, version %i, completedAt %s',
      async (from, to, version, completedAt) => {
        const id = await task(marina, from);

        const response = await patch(marina, id, { status: to });

        expect(response.status).toBe(200);
        expect(response.headers.etag).toBe(`W/"${version}"`);
        const body = taskOf(response);
        expect(body).toMatchObject({ status: to, version, completedAt });
        // Updated time moves only on a real change (AC-03.10.1, AC-03.10.3).
        const updatedAt = (from === to ? EARLIER : NOW).toISOString();
        expect(body.updatedAt).toBe(updatedAt);
        expect(await stored(id)).toEqual({
          status: to,
          version,
          updatedAt: new Date(updatedAt),
        });
      },
    );
  });

  it('AC-03.10.5 a status change touches nothing else', async () => {
    const mobile = (
      (
        await http()
          .post('/api/v1/teams')
          .set('Authorization', bearerOf(marina))
          .send({ name: 'Mobile', colorHex: '#7C3AED' })
      ).body as { data: { id: string } }
    ).data.id;
    const id = await task(marina, 'PENDING', {
      dueDate: '2026-10-31',
      teamIds: [mobile],
    });

    const body = taskOf(await patch(marina, id, { status: 'DONE' }));

    expect(body).toMatchObject({
      title: 'Ship it',
      description: 'notes',
      dueDate: '2026-10-31',
      teams: [{ id: mobile }],
    });
  });

  it('AC-03.14.3 reopening a DONE task with a past due date makes it overdue', async () => {
    const id = await task(marina, 'DONE', { dueDate: '2026-10-01' });

    const body = taskOf(await patch(marina, id, { status: 'PENDING' }));

    expect(body).toMatchObject({ status: 'PENDING', isOverdue: true });
  });

  describe('AC-03.10.4 invalid requests → 400, task unchanged', () => {
    it.each<[string, object, string]>([
      ['no status', {}, 'status'],
      ['the status "FINISHED"', { status: 'FINISHED' }, 'status'],
      ['the status "done"', { status: 'done' }, 'status'],
      ['an extra title', { status: 'DONE', title: 'Hacked' }, 'title'],
      ['an extra version', { status: 'DONE', version: 9 }, 'version'],
      [
        'an extra completedAt',
        { status: 'DONE', completedAt: EARLIER.toISOString() },
        'completedAt',
      ],
      ['an extra createdAt', { status: 'DONE', createdAt: 'x' }, 'createdAt'],
      ['an extra updatedAt', { status: 'DONE', updatedAt: 'x' }, 'updatedAt'],
      ['an extra deletedAt', { status: 'DONE', deletedAt: 'x' }, 'deletedAt'],
      ['an extra teams', { status: 'DONE', teams: [] }, 'teams'],
      ['an extra isOverdue', { status: 'DONE', isOverdue: true }, 'isOverdue'],
    ])('%s', async (_label, body, field) => {
      const id = await task(marina, 'PENDING');

      const response = await patch(marina, id, body);

      expect(response.status).toBe(400);
      expect(codeOf(response)).toBe('VALIDATION_FAILED');
      const details = (
        response.body as { error: { details: { field: string }[] } }
      ).error.details;
      expect(details.map((detail) => detail.field)).toContain(field);
      expect(await stored(id)).toMatchObject({ status: 'PENDING', version: 3 });
    });

    it.each(['__proto__', 'constructor'])('a %s key', async (field) => {
      const id = await task(marina, 'PENDING');

      const response = await http()
        .patch(`${TASKS}/${id}/status`)
        .set('Authorization', bearerOf(marina))
        .set('Content-Type', 'application/json')
        .send(`{"status":"DONE","${field}":{"version":9}}`);

      expect(response.status).toBe(400);
      expect(await stored(id)).toMatchObject({ status: 'PENDING', version: 3 });
    });
  });

  it('AC-03.10.6 an unknown or deleted task → 404 TASK_NOT_FOUND', async () => {
    const deleted = await task(marina, 'PENDING', { deleted: true });

    for (const id of [randomUUID(), deleted]) {
      const response = await patch(marina, id, { status: 'DONE' });
      expect(response.status).toBe(404);
      expect(codeOf(response)).toBe('TASK_NOT_FOUND');
    }
    expect(await stored(deleted)).toMatchObject({
      status: 'PENDING',
      version: 3,
    });
  });

  it("AC-03.12.1 another user's task → 404 TASK_NOT_FOUND and it is unchanged", async () => {
    const theirs = await task(rafael, 'PENDING');

    const response = await patch(marina, theirs, { status: 'DONE' });

    expect(response.status).toBe(404);
    expect(codeOf(response)).toBe('TASK_NOT_FOUND');
    expect(await stored(theirs)).toMatchObject({
      status: 'PENDING',
      version: 3,
    });
  });

  it('a malformed id → 400 on id', async () => {
    const response = await patch(marina, 'abc', { status: 'DONE' });

    expect(response.status).toBe(400);
    expect(codeOf(response)).toBe('VALIDATION_FAILED');
  });

  it('AC-03.12.5 without a session → 401 UNAUTHENTICATED', async () => {
    const id = await task(marina, 'PENDING');

    const response = await http()
      .patch(`${TASKS}/${id}/status`)
      .send({ status: 'DONE' });

    expect(response.status).toBe(401);
    expect(codeOf(response)).toBe('UNAUTHENTICATED');
  });

  it('documents the request body and the 200 response in OpenAPI', async () => {
    const document = (await http().get('/docs/openapi.json')).body as {
      paths: Record<
        string,
        {
          patch?: {
            responses: Record<string, unknown>;
            requestBody?: unknown;
          };
        }
      >;
    };

    const operation = document.paths['/api/v1/tasks/{id}/status']?.patch;
    expect(JSON.stringify(operation?.responses['200'])).toContain(
      '#/components/schemas/TaskResponseDto',
    );
    expect(JSON.stringify(operation?.requestBody)).toContain(
      '#/components/schemas/ChangeTaskStatusDto',
    );
  });
});
