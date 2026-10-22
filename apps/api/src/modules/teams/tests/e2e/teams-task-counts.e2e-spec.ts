import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from '@test/support/app';
import {
  bearerOf,
  signUpAndSignIn,
  TestUser,
  twoUsers,
} from '@test/support/auth';
import { useTestDatabase } from '@test/support/postgres';

const TEAMS = '/api/v1/teams';
const TASKS = '/api/v1/tasks';

interface TeamBody {
  id: string;
  name: string;
  taskCount: number;
}

describe('taskCount on teams, from Task Management (e2e, T-003-14b)', () => {
  const db = useTestDatabase();
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp(db.url, {
      config: { authRateLimitEnabled: false },
    });
  });

  afterAll(() => app.close());

  const http = () => request(app.getHttpServer() as App);

  const createTeam = async (user: TestUser, name: string): Promise<string> => {
    const response = await http()
      .post(TEAMS)
      .set('Authorization', bearerOf(user))
      .send({ name, colorHex: '#7C3AED' });
    expect(response.status).toBe(201);
    return (response.body as { data: { id: string } }).data.id;
  };

  const createTask = async (
    user: TestUser,
    title: string,
    teamIds: string[],
  ): Promise<string> => {
    const response = await http()
      .post(TASKS)
      .set('Authorization', bearerOf(user))
      .send({ title, teamIds });
    expect(response.status).toBe(201);
    return (response.body as { data: { id: string } }).data.id;
  };

  const deleteTask = async (user: TestUser, id: string) => {
    const response = await http()
      .delete(`${TASKS}/${id}`)
      .set('Authorization', bearerOf(user));
    expect(response.status).toBe(204);
  };

  const countsOf = async (user: TestUser) => {
    const list = await http().get(TEAMS).set('Authorization', bearerOf(user));
    expect(list.status).toBe(200);
    const teams = (list.body as { data: TeamBody[] }).data;
    const fromList = Object.fromEntries(
      teams.map((team) => [team.name, team.taskCount]),
    );
    const fromGet: Record<string, number> = {};
    for (const team of teams) {
      const one = await http()
        .get(`${TEAMS}/${team.id}`)
        .set('Authorization', bearerOf(user));
      fromGet[team.name] = (one.body as { data: TeamBody }).data.taskCount;
    }
    return { fromList, fromGet };
  };

  it('AC-02.8.1 GET /teams and GET /teams/:id show the active tasks assigned to each team', async () => {
    const user = await signUpAndSignIn(app);
    const mobile = await createTeam(user, 'Mobile');
    const backend = await createTeam(user, 'Backend');
    await createTeam(user, 'Design');
    await createTask(user, 'Login screen', [mobile]);
    await createTask(user, 'Shared API', [mobile, backend]);
    await createTask(user, 'Migration', [backend]);
    await createTask(user, 'Unassigned', []);

    const expected = { Mobile: 2, Backend: 2, Design: 0 };
    const { fromList, fromGet } = await countsOf(user);

    expect(fromList).toEqual(expected);
    expect(fromGet).toEqual(expected);
  });

  it('AC-02.8.2 deleting a task decreases the count of each of its teams by one', async () => {
    const user = await signUpAndSignIn(app);
    const mobile = await createTeam(user, 'Mobile');
    const backend = await createTeam(user, 'Backend');
    const shared = await createTask(user, 'Shared API', [mobile, backend]);
    await createTask(user, 'Login screen', [mobile]);

    await deleteTask(user, shared);

    const { fromList, fromGet } = await countsOf(user);
    expect(fromList).toEqual({ Mobile: 1, Backend: 0 });
    expect(fromGet).toEqual({ Mobile: 1, Backend: 0 });
  });

  it("AC-02.8.1 AC-01.6.1 another owner's tasks never count", async () => {
    const { marina, rafael } = await twoUsers(app);
    await createTeam(marina, 'Mobile');
    const theirs = await createTeam(rafael, 'Mobile');
    await createTask(rafael, 'Rafael task', [theirs]);

    expect((await countsOf(marina)).fromList).toEqual({ Mobile: 0 });
    expect((await countsOf(rafael)).fromList).toEqual({ Mobile: 1 });
  });

  it('AC-02.8.3 a new team counts 0, also right after creation', async () => {
    const user = await signUpAndSignIn(app);

    const response = await http()
      .post(TEAMS)
      .set('Authorization', bearerOf(user))
      .send({ name: 'Fresh', colorHex: '#7C3AED' });

    expect((response.body as { data: TeamBody }).data.taskCount).toBe(0);
  });
});
