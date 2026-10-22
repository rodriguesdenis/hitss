import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ClsService } from 'nestjs-cls';
import { Client } from 'pg';
import { CreateTaskCommand } from '../../src/modules/tasks/application/commands/create-task/create-task.command';
import { ReplaceTaskCommand } from '../../src/modules/tasks/application/commands/replace-task/replace-task.command';
import { TeamDirectory } from '../../src/modules/tasks/application/ports/team-directory';
import { UnknownTeams } from '../../src/modules/tasks/domain/errors/task.errors';
import { TaskStatus } from '../../src/modules/tasks/domain/value-objects/task-status.vo';
import { createTestApp } from '../support/app';
import { signUpAndSignIn } from '../support/auth';
import { useTestDatabase } from '../support/postgres';

/**
 * A team-link foreign-key violation (P2003) inside the unit of work: the directory said every
 * team was live, but one team row is not there. After the rollback the handler asks the
 * TeamDirectory again and reports exactly that id; nothing is written.
 */
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

  const execute = <T>(command: object) =>
    app
      .get(ClsService)
      .run(() => app.get(CommandBus).execute<object, T>(command));

  const team = async (): Promise<string> => {
    const id = randomUUID();
    await sql.query(
      `INSERT INTO teams (id, owner_id, name, color_hex, version, created_at, updated_at)
       VALUES ($1, $2, $3, '#7C3AED', 1, now(), now())`,
      [id, owner, `Team-${id.slice(0, 8)}`],
    );
    return id;
  };
  /** The directory's check passes once, as if the team vanished right after it. */
  const checkPassesOnce = () =>
    jest.spyOn(app.get(TeamDirectory), 'findMissing').mockResolvedValueOnce([]);
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

    const error = await execute(
      new CreateTaskCommand(owner, 'Release', null, undefined, null, [
        live,
        gone,
      ]),
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UnknownTeams);
    expect((error as UnknownTeams).teamIds).toEqual([gone]);
    // Asked twice: the check inside the unit of work, then again after the rollback.
    expect(findMissing).toHaveBeenCalledTimes(2);
    expect(await taskCount()).toBe(before);
  });

  it('AC-03.9.3 replace: UNKNOWN_TEAMS lists the id whose row is gone, and the task is unchanged', async () => {
    const live = await team();
    const { id } = await execute<{ id: string }>(
      new CreateTaskCommand(owner, 'Draft', null, undefined, null, [live]),
    );
    const gone = randomUUID();
    checkPassesOnce();

    const error = await execute(
      new ReplaceTaskCommand(owner, id, 'Draft', TaskStatus.PENDING, [
        live,
        gone,
      ]),
    ).catch((e: unknown) => e);

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
