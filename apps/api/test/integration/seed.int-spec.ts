import { randomUUID } from 'node:crypto';
import pino from 'pino';
import type { AppConfig } from '../../src/config/app-config';
import { loadAppConfig } from '../../src/config/load-config';
import { VALID_ENV } from '../unit/config/testing/expect-invalid';
import { createAuth } from '../../src/modules/identity/auth.factory';
import { BetterAuthPasswordHasher } from '../../src/modules/identity/password-hasher';
import { PrismaService } from '../../src/shared/infrastructure/prisma/prisma.service';
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  DEMO_TASK_IDS,
  DEMO_TEAM_IDS,
  DEMO_USER_ID,
} from '../../src/seed/fixtures';
import { seedDemo } from '../../src/seed/seed-demo';
import { useTestDatabase } from '../support/postgres';

describe('demo seed (integration, T-007-07)', () => {
  const db = useTestDatabase();
  let prisma: PrismaService;
  let config: AppConfig;
  const logger = pino({ level: 'silent' });

  beforeAll(async () => {
    config = loadAppConfig({
      ...VALID_ENV,
      DATABASE_URL: db.url,
      APP_ENV: 'test',
    });
    prisma = new PrismaService(config);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma?.onModuleDestroy();
  });

  const auth = () =>
    createAuth(config, prisma, logger, new BetterAuthPasswordHasher(), {
      fixedUserId: DEMO_USER_ID,
    });

  const run = (
    overrides: Partial<Pick<AppConfig, 'seedDemo' | 'appEnv'>> = {},
  ) =>
    seedDemo({
      config: {
        seedDemo: config.seedDemo,
        appEnv: config.appEnv,
        ...overrides,
      },
      prisma,
      auth,
      now: new Date('2026-10-22T10:00:00.000Z'),
    });

  const wipe = async () => {
    await prisma.taskTeam.deleteMany();
    await prisma.task.deleteMany();
    await prisma.team.deleteMany();
    await prisma.session.deleteMany();
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();
  };

  const snapshot = async () => ({
    users: await prisma.user.findMany({ orderBy: { id: 'asc' } }),
    accounts: await prisma.account.findMany({ orderBy: { id: 'asc' } }),
    teams: await prisma.team.findMany({ orderBy: { id: 'asc' } }),
    tasks: await prisma.task.findMany({ orderBy: { id: 'asc' } }),
    links: await prisma.taskTeam.findMany({
      orderBy: [{ taskId: 'asc' }, { teamId: 'asc' }],
    }),
  });

  beforeEach(wipe);

  it('AC-07.2.1 the demo account signs in with the documented credentials', async () => {
    await run();

    const signedIn = await auth().api.signInEmail({
      body: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
    });

    expect(signedIn.user.email).toBe(DEMO_EMAIL);
  });

  it('AC-01.8.2 the demo user has exactly the fixed id after signUpEmail', async () => {
    const result = await run();

    expect(result).toMatchObject({ seeded: true, user: 'created' });
    const users = await prisma.user.findMany();
    expect(users.map((u) => u.id)).toEqual([DEMO_USER_ID]);
    expect(users[0]?.email).toBe(DEMO_EMAIL);
  });

  it('AC-01.8.2 a second run keeps one account with the same id, password hash and updated_at', async () => {
    await run();
    const before = await snapshot();

    const second = await run();

    expect(second.user).toBe('existing');
    const after = await snapshot();
    expect(after.users).toEqual(before.users);
    expect(after.accounts).toEqual(before.accounts);
    expect(after.accounts).toHaveLength(1);
  });

  it('AC-07.2.2 AC-01.8.3 the demo account owns exactly 3 teams and 10 tasks with the planned spread', async () => {
    await run();

    const teams = await prisma.team.findMany({
      where: { ownerId: DEMO_USER_ID },
    });
    const tasks = await prisma.task.findMany({
      where: { ownerId: DEMO_USER_ID },
      include: { teams: true },
    });
    expect(teams.map((t) => t.name).sort()).toEqual([
      'Backend',
      'Design',
      'Mobile',
    ]);
    expect(tasks).toHaveLength(10);
    const count = (status: string) =>
      tasks.filter((t) => t.status === status).length;
    expect([count('PENDING'), count('IN_PROGRESS'), count('DONE')]).toEqual([
      4, 3, 3,
    ]);
    expect(tasks.some((t) => t.teams.length >= 2)).toBe(true);
    expect(tasks.some((t) => t.teams.length === 0)).toBe(true);
    const today = new Date('2026-10-22T00:00:00.000Z');
    expect(
      tasks.some(
        (t) => t.status !== 'DONE' && t.dueDate !== null && t.dueDate < today,
      ),
    ).toBe(true);
    expect(tasks.some((t) => t.dueDate !== null && t.dueDate > today)).toBe(
      true,
    );
  });

  it('AC-07.2.3 seeding twice produces an identical snapshot and no duplicates', async () => {
    await run();
    const first = await snapshot();

    await run();
    const second = await snapshot();

    expect(second).toEqual(first);
    expect(second.teams).toHaveLength(3);
    expect(second.tasks).toHaveLength(10);
  });

  it('AC-07.1.3 a restart keeps the data and the start-up seed duplicates nothing', async () => {
    await run();
    const before = await snapshot();

    await run();
    await run();

    expect(await snapshot()).toEqual(before);
    expect(await prisma.user.count()).toBe(1);
  });

  it("AC-07.2.4 re-seeding restores seeded records and leaves the evaluator's own untouched", async () => {
    await run();
    const seeded = await snapshot();
    const ownTeam = await prisma.team.create({
      data: {
        id: randomUUID(),
        ownerId: DEMO_USER_ID,
        name: 'Mine',
        colorHex: '#112233',
        createdAt: new Date('2026-10-01T00:00:00.000Z'),
        updatedAt: new Date('2026-10-01T00:00:00.000Z'),
      },
    });
    const ownTask = await prisma.task.create({
      data: {
        id: randomUUID(),
        ownerId: DEMO_USER_ID,
        title: 'My own task',
        createdAt: new Date('2026-10-01T00:00:00.000Z'),
        updatedAt: new Date('2026-10-01T00:00:00.000Z'),
        teams: { create: [{ teamId: ownTeam.id }] },
      },
    });
    await prisma.team.update({
      where: { id: DEMO_TEAM_IDS[0] },
      data: { name: 'Renamed', version: 5 },
    });
    await prisma.task.update({
      where: { id: DEMO_TASK_IDS[0] },
      data: { title: 'Changed', deletedAt: new Date() },
    });
    await prisma.taskTeam.deleteMany({ where: { taskId: DEMO_TASK_IDS[1] } });

    await run();

    const after = await snapshot();
    expect(after.teams.filter((t) => DEMO_TEAM_IDS.includes(t.id))).toEqual(
      seeded.teams,
    );
    expect(after.tasks.filter((t) => DEMO_TASK_IDS.includes(t.id))).toEqual(
      seeded.tasks,
    );
    expect(after.links.filter((l) => DEMO_TASK_IDS.includes(l.taskId))).toEqual(
      seeded.links,
    );
    expect(after.teams.find((t) => t.id === ownTeam.id)).toEqual(ownTeam);
    expect(after.tasks.find((t) => t.id === ownTask.id)).toMatchObject({
      title: 'My own task',
      deletedAt: null,
    });
    expect(
      after.links.some(
        (l) => l.taskId === ownTask.id && l.teamId === ownTeam.id,
      ),
    ).toBe(true);
  });

  it('AC-07.2.4 a seeded team renamed while the evaluator owns a team with its name does not fail the re-seed', async () => {
    await run();
    await prisma.team.update({
      where: { id: DEMO_TEAM_IDS[0] },
      data: { name: 'Renamed' },
    });
    const own = await prisma.team.create({
      data: {
        id: randomUUID(),
        ownerId: DEMO_USER_ID,
        name: 'mobile',
        colorHex: '#112233',
        createdAt: new Date('2026-10-01T00:00:00.000Z'),
        updatedAt: new Date('2026-10-01T00:00:00.000Z'),
      },
    });

    const result = await run();

    expect(result).toMatchObject({ seeded: true, teams: 2, teamsSkipped: 1 });
    expect(await prisma.team.findUnique({ where: { id: own.id } })).toEqual(
      own,
    );
    expect(
      (await prisma.team.findUnique({ where: { id: DEMO_TEAM_IDS[0] } }))?.name,
    ).toBe('Renamed');
    expect(await prisma.task.count({ where: { ownerId: DEMO_USER_ID } })).toBe(
      10,
    );
  });

  it('AC-07.2.5 after a reset (all data deleted) the seed recreates exactly 3 teams and 10 tasks', async () => {
    await run();
    await wipe();
    expect(await prisma.task.count()).toBe(0);

    await run();

    expect(await prisma.team.count()).toBe(3);
    expect(await prisma.task.count()).toBe(10);
    expect(await prisma.user.count()).toBe(1);
  });

  it('AC-01.8.4 SEED_DEMO=false writes no user, team or task and does not fail', async () => {
    const result = await run({ seedDemo: false });

    expect(result).toEqual({
      seeded: false,
      skippedBecause: 'SEED_DEMO=false',
    });
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.team.count()).toBe(0);
    expect(await prisma.task.count()).toBe(0);
  });

  it('AC-01.8.4 APP_ENV=production writes nothing even when SEED_DEMO is forced on', async () => {
    const result = await run({ seedDemo: true, appEnv: 'production' });

    expect(result).toMatchObject({
      seeded: false,
      skippedBecause: 'APP_ENV=production',
    });
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.team.count()).toBe(0);
    expect(await prisma.task.count()).toBe(0);
  });
});
