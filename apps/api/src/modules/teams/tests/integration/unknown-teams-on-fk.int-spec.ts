import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import { CreateTaskUseCase } from '../../../tasks/application/use-cases/create-task.use-case';
import { UpdateTaskUseCase } from '../../../tasks/application/use-cases/update-task.use-case';
import { TeamLookup } from '../../team-lookup.service';
import { UnknownTeams } from '../../../tasks/domain/errors/task.errors';
import { TaskStatus } from '../../../tasks/domain/value-objects/task-status.vo';
import { createTestApp } from '@test/support/app';
import { signUpAndSignIn } from '@test/support/auth';
import { useTestDatabase } from '@test/support/postgres';

describe('UNKNOWN_TEAMS after a team-link FK violation (integration)', () => {
  const db = useTestDatabase();
  let app: INestApplication;
  let sql: Client;
  let owner = '';

  beforeAll(async () => {
    app = await createTestApp(db.url, {
      config: { authRateLimitEnabled: false },
    });
    sql = new Client({ connectionString: db.url });
    await sql.connect();
    owner = (await signUpAndSignIn(app)).id;
  });

  afterAll(async () => {
    await sql?.end();
    await app?.close();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createTask = () => app.get(CreateTaskUseCase, { strict: false });
  const updateTask = () => app.get(UpdateTaskUseCase, { strict: false });

  const team = async (): Promise<string> => {
    const id = randomUUID();
    await sql.query(
      `INSERT INTO teams (id, owner_id, name, color_hex, version, created_at, updated_at)
       VALUES ($1, $2, $3, '#7C3AED', 1, now(), now())`,
      [id, owner, `Team-${id.slice(0, 8)}`],
    );
    return id;
  };
  const checkPassesOnce = () =>
    jest
      .spyOn(app.get(TeamLookup, { strict: false }), 'findMissing')
      .mockResolvedValueOnce([]);
  const taskCount = async () =>
    Number(
      (
        await sql.query<{ n: string }>(
          'SELECT count(*) AS n FROM tasks WHERE owner_id = $1',
          [owner],
        )
      ).rows[0]?.n,
    );

  it('AC-03.1.6 create: UNKNOWN_TEAMS lists the id whose row is gone, and no task is written', async () => {
    const live = await team();
    const gone = randomUUID();
    const before = await taskCount();
    const findMissing = checkPassesOnce();

    const error: unknown = await createTask()
      .execute({ ownerId: owner, title: 'Release', teamIds: [live, gone] })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UnknownTeams);
    expect((error as UnknownTeams).teamIds).toEqual([gone]);
    expect(findMissing).toHaveBeenCalledTimes(2);
    expect(await taskCount()).toBe(before);
  });

  it('AC-03.9.3 replace: UNKNOWN_TEAMS lists the id whose row is gone, and the task is unchanged', async () => {
    const live = await team();
    const id = await createTask().execute({
      ownerId: owner,
      title: 'Draft',
      teamIds: [live],
    });
    const gone = randomUUID();
    checkPassesOnce();

    const error: unknown = await updateTask()
      .execute({
        ownerId: owner,
        id,
        title: 'Draft',
        status: TaskStatus.PENDING,
        teamIds: [live, gone],
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UnknownTeams);
    expect((error as UnknownTeams).teamIds).toEqual([gone]);
    const { rows } = await sql.query<{ version: number }>(
      'SELECT version FROM tasks WHERE id = $1',
      [id],
    );
    expect(rows).toEqual([{ version: 1 }]);
    const links = await sql.query(
      'SELECT team_id FROM task_teams WHERE task_id = $1',
      [id],
    );
    expect(links.rows).toEqual([{ team_id: live }]);
  });
});
