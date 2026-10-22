import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { TransactionHost } from '@nestjs-cls/transactional';
import { ClsService } from 'nestjs-cls';
import { Client } from 'pg';
import { OnTeamDeletedHandler } from '../../src/modules/tasks/application/events/on-team-deleted.handler';
import { CreateTaskCommand } from '../../src/modules/tasks/application/commands/create-task/create-task.command';
import { Task } from '../../src/modules/tasks/domain/task';
import { UnknownTeams } from '../../src/modules/tasks/domain/task.errors';
import { TaskRepository } from '../../src/modules/tasks/domain/task.repository';
import { TaskDescription } from '../../src/modules/tasks/domain/value-objects/task-description';
import { TaskTeamIds } from '../../src/modules/tasks/domain/value-objects/task-team-ids';
import { TaskTitle } from '../../src/modules/tasks/domain/value-objects/task-title';
import { DeleteTeamCommand } from '../../src/modules/teams/application/commands/delete-team/delete-team.command';
import { TeamDeleted } from '../../src/modules/teams/contracts/team-deleted.event';
import { UnitOfWork } from '../../src/shared/application/ports/unit-of-work';
import { ExpectedVersion } from '../../src/shared/domain/expected-version';
import type { PrismaTransactionHost } from '../../src/shared/infrastructure/transactions/cls-unit-of-work';
import { createTestApp } from '../support/app';
import { signUpAndSignIn } from '../support/auth';
import { useTestDatabase } from '../support/postgres';

const CREATED = new Date('2026-10-20T13:00:00.000Z');

/** A promise and the function that settles it: holds a transaction open at a chosen point. */
function gate(): { opened: Promise<void>; open: () => void } {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { opened, open };
}

/** Whether `promise` is still pending after `ms` (it is blocked on a lock). */
const stillPending = async (promise: Promise<unknown>, ms = 400) => {
  const pending = Symbol('pending');
  const winner = await Promise.race([
    promise.then(
      () => 'settled',
      () => 'settled',
    ),
    new Promise((resolve) => setTimeout(() => resolve(pending), ms)),
  ]);
  return winner === pending;
};

/**
 * The TeamDeleted reaction (T-003-13) on the full AppModule: it runs inside DeleteTeam's unit of
 * work, rolls back with it, and serializes with concurrent task writes on the team-link lock.
 */
describe('OnTeamDeletedHandler (integration, T-003-13)', () => {
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

  /** Runs in a CLS context, as the request middleware does for HTTP. */
  const inCls = <T>(work: () => Promise<T>) => app.get(ClsService).run(work);
  const deleteTeam = (id: string) =>
    inCls(() =>
      app
        .get(CommandBus)
        .execute(new DeleteTeamCommand(owner, id, ExpectedVersion.any())),
    );

  const team = async (name: string): Promise<string> => {
    const id = randomUUID();
    await sql.query(
      `INSERT INTO teams (id, owner_id, name, color_hex, version, created_at, updated_at)
       VALUES ($1, $2, $3, '#7C3AED', 1, $4, $4)`,
      [id, owner, `${name}-${id.slice(0, 8)}`, CREATED],
    );
    return id;
  };
  const aTask = (teamIds: string[]) =>
    Task.create({
      id: randomUUID(),
      ownerId: owner,
      title: TaskTitle.create('Release'),
      description: TaskDescription.create(null),
      dueDate: null,
      teamIds: TaskTeamIds.of(teamIds),
      now: CREATED,
    });
  const task = async (teamIds: string[]): Promise<string> => {
    const created = aTask(teamIds);
    await app.get(TaskRepository).insert(created);
    return created.id;
  };

  const teamDeleted = async (id: string) =>
    (
      await sql.query<{ deleted: boolean }>(
        'SELECT deleted_at IS NOT NULL AS deleted FROM teams WHERE id = $1',
        [id],
      )
    ).rows[0]?.deleted;
  const taskState = async (id: string) => {
    const { rows } = await sql.query<{ version: number; updated_at: Date }>(
      'SELECT version, updated_at FROM tasks WHERE id = $1',
      [id],
    );
    const links = await sql.query<{ team_id: string }>(
      'SELECT team_id FROM task_teams WHERE task_id = $1 ORDER BY team_id',
      [id],
    );
    return {
      version: rows[0]?.version,
      updatedAt: rows[0]?.updated_at,
      teamIds: links.rows.map((row) => row.team_id),
    };
  };

  it('AC-02.7.2 AC-03.13.1 AC-03.13.2 AC-03.13.4 deleting a team unassigns it from its tasks in the same transaction', async () => {
    const mobile = await team('Mobile');
    const backend = await team('Backend');
    const both = await task([mobile, backend]);
    const mobileOnly = await task([mobile]);
    const backendOnly = await task([backend]);

    await deleteTeam(mobile);

    expect(await teamDeleted(mobile)).toBe(true);
    const bothState = await taskState(both);
    expect(bothState.teamIds).toEqual([backend]);
    expect(bothState.version).toBe(2);
    expect(bothState.updatedAt?.getTime()).toBeGreaterThan(CREATED.getTime());
    expect(await taskState(mobileOnly)).toMatchObject({
      teamIds: [],
      version: 2,
    });
    expect(await taskState(backendOnly)).toEqual({
      teamIds: [backend],
      version: 1,
      updatedAt: CREATED,
    });
  });

  it('AC-02.7.4 a failing task-side reaction rolls the team delete back: team active, links intact', async () => {
    const mobile = await team('Mobile');
    const linked = await task([mobile]);
    jest
      .spyOn(app.get(TaskRepository), 'update')
      .mockRejectedValueOnce(new Error('task-side reaction failed'));

    await expect(deleteTeam(mobile)).rejects.toThrow(
      'task-side reaction failed',
    );

    expect(await teamDeleted(mobile)).toBe(false);
    expect(await taskState(linked)).toEqual({
      teamIds: [mobile],
      version: 1,
      updatedAt: CREATED,
    });
  });

  it('replaying TeamDeleted is a no-op', async () => {
    const mobile = await team('Mobile');
    const linked = await task([mobile]);
    await deleteTeam(mobile);
    const after = await taskState(linked);

    await inCls(() =>
      app
        .get(UnitOfWork)
        .run(() =>
          app
            .get(OnTeamDeletedHandler)
            .handle(new TeamDeleted(mobile, owner, new Date())),
        ),
    );

    expect(await taskState(linked)).toEqual(after);
  });

  describe('a team deleted concurrently with a task write never leaves a stale link', () => {
    it('the reaction locks first: the task write waits, then reports the team as unknown', async () => {
      const mobile = await team('Mobile');
      const hold = gate();
      const locked = gate();
      const txHost: PrismaTransactionHost = app.get(TransactionHost);
      // DeleteTeam's unit of work, held open right after its reaction took the lock.
      const deleting = inCls(() =>
        app.get(UnitOfWork).run(async () => {
          await txHost.tx.team.update({
            where: { id: mobile },
            data: { deletedAt: new Date() },
          });
          await app
            .get(OnTeamDeletedHandler)
            .handle(new TeamDeleted(mobile, owner, new Date()));
          locked.open();
          await hold.opened;
        }),
      );
      await locked.opened;

      const creating = inCls(() =>
        app
          .get(CommandBus)
          .execute(
            new CreateTaskCommand(owner, 'Release', null, undefined, null, [
              mobile,
            ]),
          ),
      );

      expect(await stillPending(creating)).toBe(true);
      hold.open();
      await deleting;
      const error: unknown = await creating.catch((e: unknown) => e);
      expect(error).toBeInstanceOf(UnknownTeams);
      expect((error as UnknownTeams).teamIds).toEqual([mobile]);
      const { rows } = await sql.query(
        'SELECT 1 FROM task_teams WHERE team_id = $1',
        [mobile],
      );
      expect(rows).toEqual([]);
    });

    it('the task write locks first: the reaction waits, then removes the new link', async () => {
      const mobile = await team('Mobile');
      const hold = gate();
      const written = gate();
      const created = aTask([mobile]);
      // A task write's unit of work (as CreateTask runs it), held open after its insert.
      const writing = inCls(() =>
        app.get(UnitOfWork).run(async () => {
          const tasks = app.get(TaskRepository);
          await tasks.lockTeamLinks([mobile]);
          await tasks.insert(created);
          written.open();
          await hold.opened;
        }),
      );
      await written.opened;

      const deleting = deleteTeam(mobile);

      expect(await stillPending(deleting)).toBe(true);
      hold.open();
      await writing;
      await deleting;
      expect(await teamDeleted(mobile)).toBe(true);
      expect(await taskState(created.id)).toMatchObject({
        teamIds: [],
        version: 2,
      });
    });
  });

  it('lockTeamLinks refuses to run outside a transaction', async () => {
    await expect(
      inCls(() => app.get(TaskRepository).lockTeamLinks([randomUUID()])),
    ).rejects.toThrow('needs a transaction');
  });
});
