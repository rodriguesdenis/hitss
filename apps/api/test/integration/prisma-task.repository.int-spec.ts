import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConcurrencyConflict } from '../../src/shared/domain/domain-error';
import { UnknownTeams } from '../../src/modules/tasks/domain/task.errors';
import { PrismaService } from '../../src/shared/infrastructure/prisma/prisma.service';
import { TaskStatus } from '../../src/modules/tasks/domain/value-objects/task-status';
import { TaskTeamIds } from '../../src/modules/tasks/domain/value-objects/task-team-ids';
import { PrismaTaskRepository } from '../../src/modules/tasks/infrastructure/prisma-task.repository';
import { createTestApp } from '../support/app';
import { expectProbePassed, runProbeInTimeZone } from '../support/in-time-zone';
import { useTestDatabase } from '../support/postgres';
import {
  aTask,
  describeTaskRepositoryContract,
} from '../support/task-repository.contract';

const LATER = new Date('2026-10-21T11:00:00.000Z');

describe('PrismaTaskRepository (integration, T-003-04)', () => {
  const db = useTestDatabase();
  let app: INestApplication;
  let prisma: PrismaService;
  let repository: PrismaTaskRepository;

  beforeAll(async () => {
    app = await createTestApp(db.url);
    prisma = app.get(PrismaService);
    repository = new PrismaTaskRepository(prisma);
  });

  afterAll(async () => {
    await app?.close();
  });

  const newOwner = async (): Promise<string> =>
    (
      await prisma.user.create({
        data: { name: 'Owner', email: `owner-${randomUUID()}@example.test` },
      })
    ).id;

  const newTeam = async (ownerId: string): Promise<string> => {
    const id = randomUUID();
    const now = new Date('2026-10-21T08:00:00.000Z');
    await prisma.team.create({
      data: {
        id,
        ownerId,
        name: `Team ${id.slice(0, 8)}`,
        colorHex: '#7C3AED',
        createdAt: now,
        updatedAt: now,
      },
    });
    return id;
  };

  describeTaskRepositoryContract(() => ({
    repository,
    newOwner,
    newTeam,
    // A random id has no teams row, so the link trips the foreign key.
    unknownTeam: () => Promise.resolve(randomUUID()),
  }));

  it('AC-03.15.3 lets exactly one of two concurrent updates at the same version win', async () => {
    const ownerId = await newOwner();
    const task = aTask(ownerId);
    await repository.insert(task);
    const [first, second] = await Promise.all([
      repository.findById(ownerId, task.id),
      repository.findById(ownerId, task.id),
    ]);
    first!.changeStatus(TaskStatus.IN_PROGRESS, LATER);
    second!.changeStatus(TaskStatus.DONE, LATER);

    const results = await Promise.allSettled([
      repository.update(first!, 1),
      repository.update(second!, 1),
    ]);

    const won = results.filter((r) => r.status === 'fulfilled');
    const lost = results.filter((r) => r.status === 'rejected');
    expect(won).toHaveLength(1);
    expect((won[0] as PromiseFulfilledResult<number>).value).toBe(2);
    expect(lost).toHaveLength(1);
    const reason: unknown = (lost[0] as PromiseRejectedResult).reason;
    expect(reason).toBeInstanceOf(ConcurrencyConflict);
    expect((reason as ConcurrencyConflict).currentVersion).toBe(2);
    expect((await repository.findById(ownerId, task.id))!.version).toBe(2);
  });

  it('writes the row and the links in one transaction: a failing link rolls the update back', async () => {
    const ownerId = await newOwner();
    const team = await newTeam(ownerId);
    const task = aTask(ownerId, { teamIds: [team] });
    await repository.insert(task);
    const gone = randomUUID(); // no teams row: the link insert trips the foreign key

    task.changeStatus(TaskStatus.DONE, LATER);
    task.assignTo(TaskTeamIds.of([team, gone]), LATER);

    const error: unknown = await repository
      .update(task, 1)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnknownTeams);
    const stored = (await repository.findById(ownerId, task.id))!;
    expect(stored.version).toBe(1);
    expect(stored.status).toBe('PENDING');
    expect(stored.teamIds.values).toEqual([team]);
  });

  it('translates only the team-link foreign key: an unknown owner fails as it is', async () => {
    const task = aTask(randomUUID());

    const error: unknown = await repository
      .insert(task)
      .catch((e: unknown) => e);

    expect(error).not.toBeInstanceOf(UnknownTeams);
    expect(error).toMatchObject({ code: 'P2003' });
  });

  it('stores nothing when a new task links an unknown team', async () => {
    const ownerId = await newOwner();
    const task = aTask(ownerId, { teamIds: [randomUUID()] });

    await expect(repository.insert(task)).rejects.toBeInstanceOf(UnknownTeams);
    await expect(prisma.task.count({ where: { id: task.id } })).resolves.toBe(
      0,
    );
  });

  it('keeps unchanged links (same row, same created_at) when the team set changes', async () => {
    const ownerId = await newOwner();
    const [kept, added] = [await newTeam(ownerId), await newTeam(ownerId)];
    const task = aTask(ownerId, { teamIds: [kept] });
    await repository.insert(task);
    // A fixed past timestamp: a re-created row would get the default (now) instead.
    const pinned = new Date('2020-01-01T00:00:00.000Z');
    const link = { taskId_teamId: { taskId: task.id, teamId: kept } };
    await prisma.taskTeam.update({ where: link, data: { createdAt: pinned } });

    task.assignTo(TaskTeamIds.of([kept, added]), LATER);
    await repository.update(task, 1);

    const after = await prisma.taskTeam.findUniqueOrThrow({ where: link });
    expect(after.createdAt).toEqual(pinned);
  });

  it('stores the due date as that calendar day', async () => {
    const ownerId = await newOwner();
    const task = aTask(ownerId, { dueDate: '2026-12-31' });
    await repository.insert(task);

    const [row] = await prisma.$queryRaw<{ day: string }[]>`
      SELECT due_date::text AS day FROM tasks WHERE id = ${task.id}::uuid`;

    expect(row?.day).toBe('2026-12-31');
  });

  // A test cannot change its own process's zone, so each zone runs in a child process that
  // writes and reads through PrismaTaskRepository against this file's database.
  it.each(['Pacific/Kiritimati', 'America/Los_Angeles'])(
    'stores and loads year-edge calendar days with the process in %s',
    (zone) => {
      expectProbePassed(
        runProbeInTimeZone('task-due-date.tz-probe.ts', zone, {
          PROBE_DATABASE_URL: db.url,
        }),
      );
    },
  );
});
