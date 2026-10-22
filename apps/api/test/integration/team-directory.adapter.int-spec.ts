import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { TeamDirectory } from '../../src/modules/tasks/application/ports/team-directory';
import { TeamLookupDirectory } from '../../src/modules/tasks/infrastructure/adapters/team-directory.adapter';
import { PrismaService } from '../../src/shared/infrastructure/prisma/prisma.service';
import { createTestApp } from '../support/app';
import { useTestDatabase } from '../support/postgres';

const AT = new Date('2026-10-01T00:00:00.000Z');

describe('TeamLookupDirectory, as TasksModule wires it (integration, T-003-05, T-008-05)', () => {
  const db = useTestDatabase();
  let app: INestApplication;
  let prisma: PrismaService;
  let directory: TeamDirectory;

  beforeAll(async () => {
    app = await createTestApp(db.url);
    prisma = app.get(PrismaService);
    directory = app.get(TeamDirectory, { strict: false });
  });

  afterAll(async () => {
    await app?.close();
  });

  it("TasksModule's TeamDirectory is answered by TeamsModule's exported TeamLookup", () => {
    expect(directory).toBeInstanceOf(TeamLookupDirectory);
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
