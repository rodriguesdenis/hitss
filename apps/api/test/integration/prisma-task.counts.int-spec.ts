import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { TaskStatus } from '../../src/modules/tasks/domain/value-objects/task-status';
import { PrismaTaskReadModel } from '../../src/modules/tasks/infrastructure/prisma-task.read-model';
import { PrismaService } from '../../src/shared/infrastructure/prisma/prisma.service';
import { createTestApp } from '../support/app';
import { useTestDatabase } from '../support/postgres';

const AT = new Date('2026-10-01T00:00:00.000Z');

describe('PrismaTaskReadModel.countByTeams (integration, T-003-14a)', () => {
  const db = useTestDatabase();
  let app: INestApplication;
  let prisma: PrismaService;
  let readModel: PrismaTaskReadModel;

  beforeAll(async () => {
    app = await createTestApp(db.url);
    prisma = app.get(PrismaService);
    readModel = new PrismaTaskReadModel(prisma);
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

  async function newTeam(ownerId: string): Promise<string> {
    const id = randomUUID();
    await prisma.team.create({
      data: {
        id,
        ownerId,
        name: `Team ${id.slice(0, 8)}`,
        colorHex: '#7C3AED',
        createdAt: AT,
        updatedAt: AT,
      },
    });
    return id;
  }

  async function task(
    ownerId: string,
    teams: string[],
    extra: { status?: TaskStatus; deleted?: boolean } = {},
  ): Promise<string> {
    const id = randomUUID();
    const status = extra.status ?? TaskStatus.PENDING;
    await prisma.task.create({
      data: {
        id,
        ownerId,
        title: `Task ${id.slice(0, 8)}`,
        status,
        completedAt: status === TaskStatus.DONE ? AT : null,
        createdAt: AT,
        updatedAt: AT,
        deletedAt: extra.deleted ? AT : null,
        teams: { create: teams.map((teamId) => ({ teamId })) },
      },
    });
    return id;
  }

  const asObject = (map: ReadonlyMap<string, number>) =>
    Object.fromEntries(map);

  it('AC-02.8.1 counts the owner’s active tasks per team, whatever their status', async () => {
    const ownerId = await newOwner();
    const [mobile, backend, design] = [
      await newTeam(ownerId),
      await newTeam(ownerId),
      await newTeam(ownerId),
    ];
    await task(ownerId, [mobile, backend], { status: TaskStatus.PENDING });
    await task(ownerId, [mobile], { status: TaskStatus.IN_PROGRESS });
    await task(ownerId, [mobile], { status: TaskStatus.DONE });
    await task(ownerId, []);

    const counts = await readModel.countByTeams(ownerId, [
      mobile,
      backend,
      design,
    ]);

    expect(asObject(counts)).toEqual({
      [mobile]: 3,
      [backend]: 1,
      [design]: 0,
    });
  });

  it('AC-03.11.3 AC-02.8.2 never counts a deleted task (its links remain) or an unassigned one', async () => {
    const ownerId = await newOwner();
    const team = await newTeam(ownerId);
    await task(ownerId, [team]);
    await task(ownerId, [team], { deleted: true });
    const unassigned = await task(ownerId, [team]);
    await prisma.taskTeam.deleteMany({ where: { taskId: unassigned } });

    const links = await prisma.taskTeam.count({ where: { teamId: team } });
    const counts = await readModel.countByTeams(ownerId, [team]);

    expect(links).toBe(2);
    expect(counts.get(team)).toBe(1);
  });

  it('reports 0 for unknown, foreign and malformed ids, and one entry per distinct id', async () => {
    const [ownerId, stranger] = [await newOwner(), await newOwner()];
    const mine = await newTeam(ownerId);
    const theirs = await newTeam(stranger);
    await task(ownerId, [mine]);
    await task(stranger, [theirs]);
    const unknown = randomUUID();

    const counts = await readModel.countByTeams(ownerId, [
      mine,
      theirs,
      unknown,
      'not-a-uuid',
      mine,
    ]);

    expect(asObject(counts)).toEqual({
      [mine]: 1,
      [theirs]: 0,
      [unknown]: 0,
      'not-a-uuid': 0,
    });
  });

  it('returns an empty map for no ids, and answers N teams with one query', async () => {
    const ownerId = await newOwner();
    const teams = [
      await newTeam(ownerId),
      await newTeam(ownerId),
      await newTeam(ownerId),
    ];
    for (const team of teams) await task(ownerId, [team]);
    const queries: string[] = [];
    prisma.$on('query', (event) => queries.push(event.query));

    const empty = await readModel.countByTeams(ownerId, []);
    const emptyQueries = queries.length;
    const counts = await readModel.countByTeams(ownerId, teams);

    expect(empty.size).toBe(0);
    expect(emptyQueries).toBe(0);
    expect(queries).toHaveLength(1);
    expect([...counts.values()]).toEqual([1, 1, 1]);
  });
});
