import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Clock } from '../../../../shared/domain/clock';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { createTestApp } from '@test/support/app';
import { bearerOf, TestUser, twoUsers } from '@test/support/auth';
import { useTestDatabase } from '@test/support/postgres';

const TASKS = '/api/v1/tasks';
const NOW = new Date('2026-10-22T01:00:00.000Z');
const CREATED = new Date('2026-10-20T13:00:00.000Z');

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

describe('GET /api/v1/tasks/:id (e2e)', () => {
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
  const get = (user: TestUser, id: string) =>
    http().get(`${TASKS}/${id}`).set('Authorization', bearerOf(user));

  const createTeam = async (user: TestUser, name: string, colorHex: string) =>
    (
      (
        await http()
          .post('/api/v1/teams')
          .set('Authorization', bearerOf(user))
          .send({ name, colorHex })
      ).body as { data: { id: string } }
    ).data.id;

  async function task(
    owner: TestUser,
    data: {
      title?: string;
      status?: 'PENDING' | 'IN_PROGRESS' | 'DONE';
      dueDate?: string | null;
      teamIds?: string[];
      deleted?: boolean;
    } = {},
  ): Promise<string> {
    const id = randomUUID();
    const status = data.status ?? 'PENDING';
    await prisma.task.create({
      data: {
        id,
        ownerId: owner.id,
        title: data.title ?? 'Implement login screen',
        description: 'Email + password',
        status,
        dueDate: data.dueDate
          ? new Date(`${data.dueDate}T00:00:00.000Z`)
          : null,
        completedAt: status === 'DONE' ? CREATED : null,
        version: 3,
        createdAt: CREATED,
        updatedAt: CREATED,
        deletedAt: data.deleted ? CREATED : null,
        teams: { create: (data.teamIds ?? []).map((teamId) => ({ teamId })) },
      },
    });
    return id;
  }

  const expectNotFound = async (user: TestUser, id: string) => {
    const response = await get(user, id);
    expect(response.status).toBe(404);
    expect((response.body as { error: { code: string } }).error.code).toBe(
      'TASK_NOT_FOUND',
    );
  };

  it('AC-03.8.1 returns the task view with its teams by name, overdue on the UTC day; no ETag (AC-08.3)', async () => {
    const mobile = await createTeam(marina, 'Mobile', '#7c3aed');
    const backend = await createTeam(marina, 'backend', '#0EA5E9');
    const archived = await createTeam(marina, 'Archived', '#111111');
    await prisma.team.update({
      where: { id: archived },
      data: { deletedAt: CREATED },
    });
    const id = await task(marina, {
      status: 'IN_PROGRESS',
      dueDate: '2026-10-21',
      teamIds: [mobile, backend, archived],
    });

    const response = await get(marina, id);

    expect(response.status).toBe(200);
    expect(response.headers.etag).toBeUndefined();
    expect((response.body as { data: TaskBody }).data).toEqual({
      id,
      title: 'Implement login screen',
      description: 'Email + password',
      status: 'IN_PROGRESS',
      dueDate: '2026-10-21',
      completedAt: null,
      isOverdue: true,
      teams: [
        { id: backend, name: 'backend', colorHex: '#0EA5E9' },
        { id: mobile, name: 'Mobile', colorHex: '#7C3AED' },
      ],
      version: 3,
      createdAt: CREATED.toISOString(),
      updatedAt: CREATED.toISOString(),
    });
  });

  it('AC-03.8.1 a DONE task shows its completion time and is never overdue', async () => {
    const id = await task(marina, { status: 'DONE', dueDate: '2026-01-01' });

    const body = (await get(marina, id)).body as { data: TaskBody };

    expect(body.data).toMatchObject({
      status: 'DONE',
      completedAt: CREATED.toISOString(),
      isOverdue: false,
      teams: [],
    });
  });

  it('AC-03.8.2 an unknown, deleted or foreign task id → 404 TASK_NOT_FOUND', async () => {
    const deleted = await task(marina, { deleted: true });
    const theirs = await task(rafael);

    await expectNotFound(marina, randomUUID());
    await expectNotFound(marina, deleted);
    await expectNotFound(marina, theirs);
  });

  it('AC-03.8.3 a malformed id → 400 VALIDATION_FAILED on id', async () => {
    const response = await get(marina, 'abc');

    expect(response.status).toBe(400);
    const body = response.body as {
      error: { code: string; details: { field: string }[] };
    };
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.details.map((detail) => detail.field)).toEqual(['id']);
  });

  it('AC-03.12.5 without a session → 401 UNAUTHENTICATED', async () => {
    const id = await task(marina);

    const response = await http().get(`${TASKS}/${id}`);

    expect(response.status).toBe(401);
    expect((response.body as { error: { code: string } }).error.code).toBe(
      'UNAUTHENTICATED',
    );
  });

  it('documents the 200 { data: Task } response in OpenAPI', async () => {
    const document = (await http().get('/docs/openapi.json')).body as {
      paths: Record<string, { get?: { responses: Record<string, unknown> } }>;
      components: { schemas: Record<string, { properties: object }> };
    };

    const ok = JSON.stringify(
      document.paths['/api/v1/tasks/{id}']?.get?.responses['200'],
    );
    expect(ok).toContain('#/components/schemas/TaskResponseDto');
    expect(
      Object.keys(
        document.components.schemas.TaskResponseDto?.properties ?? {},
      ),
    ).toEqual(
      expect.arrayContaining([
        'id',
        'title',
        'description',
        'status',
        'dueDate',
        'completedAt',
        'isOverdue',
        'teams',
        'version',
        'createdAt',
        'updatedAt',
      ]),
    );
  });
});
