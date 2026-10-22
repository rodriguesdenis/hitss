import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from '../support/app';
import { bearerOf, signUpAndSignIn, TestUser } from '../support/auth';
import { useTestDatabase } from '../support/postgres';

interface TaskBody {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
  teams: { id: string; name: string }[];
  version: number;
}

/**
 * Deleting a team through DELETE /api/v1/teams/:id (T-003-13): its tasks survive, lose only that
 * team, and get a new version, in the same transaction as the soft delete. The stale-If-Match
 * row (412 on an edit based on the old version) comes with If-Match on tasks, T-003-17.
 */
describe('Deleting a team unassigns it from its tasks (e2e)', () => {
  const db = useTestDatabase();
  let app: INestApplication;
  let user: TestUser;

  beforeAll(async () => {
    app = await createTestApp(db.url, {
      config: { authRateLimitEnabled: false },
    });
    user = await signUpAndSignIn(app);
  });

  afterAll(async () => {
    await app?.close();
  });

  const http = () => request(app.getHttpServer() as App);
  const as = <T extends request.Test>(test: T) =>
    test.set('Authorization', bearerOf(user));
  const createTeam = async (name: string) =>
    (
      (
        await as(http().post('/api/v1/teams')).send({
          name,
          colorHex: '#7C3AED',
        })
      ).body as { data: { id: string } }
    ).data.id;
  const createTask = async (body: object) =>
    (
      (await as(http().post('/api/v1/tasks')).send(body)).body as {
        data: TaskBody;
      }
    ).data;
  const getTask = async (id: string) => {
    const response = await as(http().get(`/api/v1/tasks/${id}`));
    return {
      task: (response.body as { data: TaskBody }).data,
      etag: response.headers.etag,
    };
  };

  it('AC-02.7.2 AC-03.13.1 AC-03.13.2 AC-03.13.3 AC-03.13.4 AC-03.2.5 tasks survive, lose only that team, and get a new version', async () => {
    const mobile = await createTeam('Mobile');
    const backend = await createTeam('Backend');
    const both = await createTask({
      title: 'Release 1.0',
      teamIds: [mobile, backend],
    });
    const only = await createTask({
      title: 'Mobile only',
      status: 'DONE',
      dueDate: '2026-10-31',
      teamIds: [mobile],
    });
    const untouched = await createTask({
      title: 'Backend only',
      teamIds: [backend],
    });

    const deleted = await as(http().delete(`/api/v1/teams/${mobile}`));
    expect(deleted.status).toBe(204);

    const afterBoth = await getTask(both.id);
    expect(afterBoth.task.teams.map((team) => team.id)).toEqual([backend]);
    expect(afterBoth.task.version).toBe(2);
    // An edit based on the old version is detectable: the tag moved (AC-03.13.4).
    expect(afterBoth.etag).toBe('W/"2"');

    const afterOnly = await getTask(only.id);
    expect(afterOnly.task).toMatchObject({
      title: 'Mobile only',
      status: 'DONE',
      dueDate: '2026-10-31',
      completedAt: only.completedAt,
      teams: [],
      version: 2,
    });

    expect((await getTask(untouched.id)).task.version).toBe(1);

    const filtered = await as(
      http().get('/api/v1/tasks').query({ teamId: mobile }),
    );
    expect(filtered.status).toBe(200);
    expect(filtered.body).toMatchObject({ data: [], meta: { total: 0 } });
  });
});
