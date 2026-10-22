import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { TeamLookup } from '../../src/modules/teams/team-lookup.service';
import { PrismaService } from '../../src/shared/infrastructure/prisma/prisma.service';
import { createTestApp } from '../support/app';
import { useTestDatabase } from '../support/postgres';

const AT = new Date('2026-10-01T00:00:00.000Z');

describe('TeamLookup, as TeamsModule exports it (integration, T-008-05)', () => {
  const db = useTestDatabase();
  let app: INestApplication;
  let prisma: PrismaService;
  let lookup: TeamLookup;

  beforeAll(async () => {
    app = await createTestApp(db.url);
    prisma = app.get(PrismaService);
    lookup = app.get(TeamLookup, { strict: false });
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

  async function team(
    ownerId: string,
    name: string,
    extra: { colorHex?: string; deleted?: boolean } = {},
  ): Promise<string> {
    const id = randomUUID();
    await prisma.team.create({
      data: {
        id,
        ownerId,
        name,
        colorHex: extra.colorHex ?? '#7C3AED',
        createdAt: AT,
        updatedAt: AT,
        deletedAt: extra.deleted ? AT : null,
      },
    });
    return id;
  }

  const summaries = (ownerId: string, ids: readonly string[]) =>
    lookup.summaries(ownerId, ids);
  const byId = <T extends { id: string }>(items: T[]) =>
    [...items].sort((a, b) => (a.id < b.id ? -1 : 1));

  it('returns the id, name and color of the owner’s live teams among the ids', async () => {
    const ownerId = await newOwner();
    const mobile = await team(ownerId, 'Mobile', { colorHex: '#7C3AED' });
    const backend = await team(ownerId, 'Backend', { colorHex: '#0EA5E9' });

    const result = await summaries(ownerId, [mobile, backend]);

    expect(byId(result)).toEqual(
      byId([
        { id: mobile, name: 'Mobile', colorHex: '#7C3AED' },
        { id: backend, name: 'Backend', colorHex: '#0EA5E9' },
      ]),
    );
  });

  it('omits deleted, foreign, unknown and malformed ids', async () => {
    const [ownerId, stranger] = [await newOwner(), await newOwner()];
    const live = await team(ownerId, 'Live');
    const deleted = await team(ownerId, 'Deleted', { deleted: true });
    const foreign = await team(stranger, 'Theirs');

    const result = await summaries(ownerId, [
      live,
      deleted,
      foreign,
      randomUUID(),
      'not-a-uuid',
    ]);

    expect(result.map((t) => t.id)).toEqual([live]);
  });

  it('handles empty and duplicate ids', async () => {
    const ownerId = await newOwner();
    const live = await team(ownerId, 'Live');

    await expect(summaries(ownerId, [])).resolves.toEqual([]);
    const result = await summaries(ownerId, [live, live, live.toUpperCase()]);
    expect(result.map((t) => t.id)).toEqual([live]);
  });

  it('findMissing reports deleted, foreign, unknown and malformed ids in input order', async () => {
    const [ownerId, stranger] = [await newOwner(), await newOwner()];
    const live = await team(ownerId, 'Live');
    const deleted = await team(ownerId, 'Deleted', { deleted: true });
    const foreign = await team(stranger, 'Theirs');
    const unknown = randomUUID();

    await expect(
      lookup.findMissing(ownerId, [
        'not-a-uuid',
        deleted,
        live.toUpperCase(),
        foreign,
        unknown,
      ]),
    ).resolves.toEqual(['not-a-uuid', deleted, foreign, unknown]);
  });
});
