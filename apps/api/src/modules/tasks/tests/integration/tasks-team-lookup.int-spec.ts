import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { GetTaskUseCase } from '../../application/use-cases/get-task.use-case';
import { TeamLookup } from '../../../teams/application/team-lookup.service';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { createTestApp } from '@test/support/app';
import { useTestDatabase } from '@test/support/postgres';

const AT = new Date('2026-10-01T00:00:00.000Z');

describe('TeamLookup, as TasksModule receives it (integration, T-003-05, T-008-06)', () => {
  const db = useTestDatabase();
  let app: INestApplication;
  let prisma: PrismaService;
  let directory: TeamLookup;

  beforeAll(async () => {
    app = await createTestApp(db.url);
    prisma = app.get(PrismaService);
    directory = app.get(TeamLookup, { strict: false });
  });

  afterAll(async () => {
    await app?.close();
  });

  it("TasksModule's use cases get TeamsModule's exported TeamLookup", () => {
    const useCase = app.get(GetTaskUseCase, { strict: false });
    expect(directory).toBeInstanceOf(TeamLookup);
    expect((useCase as unknown as { teams: TeamLookup }).teams).toBe(directory);
  });

  const newOwner = async (): Promise<string> =>
    (
      await prisma.user.create({
        data: { name: 'Owner', email: `owner-${randomUUID()}@example.test` },
      })
    ).id;

  async function team(
    ownerId: string,
    name: string,
    deleted = false,
  ): Promise<string> {
    const id = randomUUID();
    await prisma.team.create({
      data: {
        id,
        ownerId,
        name,
        colorHex: '#0EA5E9',
        createdAt: AT,
        updatedAt: AT,
        deletedAt: deleted ? AT : null,
      },
    });
    return id;
  }

  it('AC-01.6.5 summarises a live own team; deleted, foreign and unknown teams are excluded', async () => {
    const [ownerId, stranger] = [await newOwner(), await newOwner()];
    const live = await team(ownerId, 'Mobile');
    const deleted = await team(ownerId, 'Archive', true);
    const foreign = await team(stranger, 'Theirs');

    const summaries = await directory.summaries(ownerId, [
      live,
      deleted,
      foreign,
      randomUUID(),
    ]);

    expect(summaries).toEqual([
      { id: live, name: 'Mobile', colorHex: '#0EA5E9' },
    ]);
  });

  it('AC-01.6.5 reports deleted, foreign, unknown and malformed ids as missing, in input order', async () => {
    const [ownerId, stranger] = [await newOwner(), await newOwner()];
    const live = await team(ownerId, 'Mobile');
    const deleted = await team(ownerId, 'Archive', true);
    const foreign = await team(stranger, 'Theirs');
    const unknown = randomUUID();

    const missing = await directory.findMissing(ownerId, [
      'not-a-uuid',
      deleted,
      live,
      foreign,
      unknown,
    ]);

    expect(missing).toEqual(['not-a-uuid', deleted, foreign, unknown]);
  });

  it('answers empty input, and matches ids in any case', async () => {
    const ownerId = await newOwner();
    const live = await team(ownerId, 'Mobile');

    await expect(directory.summaries(ownerId, [])).resolves.toEqual([]);
    await expect(directory.findMissing(ownerId, [])).resolves.toEqual([]);
    await expect(
      directory.findMissing(ownerId, [live.toUpperCase()]),
    ).resolves.toEqual([]);
  });
});
