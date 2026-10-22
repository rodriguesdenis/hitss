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

/**
 * DELETE /api/v1/tasks/:id on the full AppModule, only the clock fixed. Edit (PUT, T-003-10) and
 * the list endpoint (T-003-08b) extend the "gone everywhere" check when they land; the list read
 * model already ignores deleted tasks under every filter (prisma-task.list.int-spec.ts).
 */
describe('DELETE /api/v1/tasks/:id (e2e)', () => {
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
  const remove = (user: TestUser, id: string) =>
    http().delete(`${TASKS}/${id}`).set('Authorization', bearerOf(user));
  const codeOf = (response: Response) =>
    (response.body as { error: { code: string } }).error.code;

  async function task(owner: TestUser, teamIds: string[] = []) {
    const id = randomUUID();
    await prisma.task.create({
      data: {
        id,
        ownerId: owner.id,
        title: 'Obsolete',
        version: 3,
        createdAt: EARLIER,
        updatedAt: EARLIER,
        teams: { create: teamIds.map((teamId) => ({ teamId })) },
      },
    });
    return id;
  }
  const stored = (id: string) =>
    prisma.task.findUniqueOrThrow({
      where: { id },
      select: {
        deletedAt: true,
        version: true,
        teams: { select: { teamId: true } },
      },
    });

  it('AC-03.11.1 204 with no content; then view, status change and delete → 404; the row and its team links stay', async () => {
    const mobile = (
      (
        await http()
          .post('/api/v1/teams')
          .set('Authorization', bearerOf(marina))
          .send({ name: 'Mobile', colorHex: '#7C3AED' })
      ).body as { data: { id: string } }
    ).data.id;
    const id = await task(marina, [mobile]);

    const response = await remove(marina, id);

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    const view = await http()
      .get(`${TASKS}/${id}`)
      .set('Authorization', bearerOf(marina));
    const status = await http()
      .patch(`${TASKS}/${id}/status`)
      .set('Authorization', bearerOf(marina))
      .send({ status: 'DONE' });
    const again = await remove(marina, id);
    for (const after of [view, status, again]) {
      expect(after.status).toBe(404);
      expect(codeOf(after)).toBe('TASK_NOT_FOUND');
    }
    expect(await stored(id)).toEqual({
      deletedAt: NOW,
      version: 4,
      teams: [{ teamId: mobile }],
    });
  });

  it('AC-03.11.2 an unknown task id → 404 TASK_NOT_FOUND', async () => {
    const response = await remove(marina, randomUUID());

    expect(response.status).toBe(404);
    expect(codeOf(response)).toBe('TASK_NOT_FOUND');
  });

  it("AC-03.12.1 another user's task → 404 TASK_NOT_FOUND and it stays active", async () => {
    const theirs = await task(rafael);

    const response = await remove(marina, theirs);

    expect(response.status).toBe(404);
    expect(codeOf(response)).toBe('TASK_NOT_FOUND');
    expect(await stored(theirs)).toMatchObject({ deletedAt: null, version: 3 });
  });

  it('a malformed id → 400 on id', async () => {
    const response = await remove(marina, 'abc');

    expect(response.status).toBe(400);
    expect(codeOf(response)).toBe('VALIDATION_FAILED');
  });

  it('AC-03.12.5 without a session → 401 UNAUTHENTICATED', async () => {
    const id = await task(marina);

    const response = await http().delete(`${TASKS}/${id}`);

    expect(response.status).toBe(401);
    expect(codeOf(response)).toBe('UNAUTHENTICATED');
    expect(await stored(id)).toMatchObject({ deletedAt: null });
  });

  it('documents the 204 response in OpenAPI', async () => {
    const document = (await http().get('/docs/openapi.json')).body as {
      paths: Record<
        string,
        { delete?: { responses: Record<string, unknown> } }
      >;
    };

    expect(
      Object.keys(
        document.paths['/api/v1/tasks/{id}']?.delete?.responses ?? {},
      ),
    ).toContain('204');
  });
});
