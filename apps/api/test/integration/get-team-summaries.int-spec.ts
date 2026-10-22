import { randomUUID } from 'node:crypto';
import { INestApplication, Module } from '@nestjs/common';
import { CqrsModule, QueryBus } from '@nestjs/cqrs';
import { GetTeamSummariesHandler } from '../../src/modules/teams/application/queries/get-team-summaries/get-team-summaries.handler';
import { TeamReadModel } from '../../src/modules/teams/application/ports/team.read-model';
import { GetTeamSummariesQuery } from '../../src/modules/teams/contracts/get-team-summaries.query';
import { PrismaTeamReadModel } from '../../src/modules/teams/infrastructure/prisma-team.read-model';
import { PrismaService } from '../../src/shared/infrastructure/prisma/prisma.service';
import { createTestApp } from '../support/app';
import { useTestDatabase } from '../support/postgres';

/** The handler and its read model, as teams.module.ts will register them (T-002-04). */
@Module({
  imports: [CqrsModule],
  providers: [
    GetTeamSummariesHandler,
    { provide: TeamReadModel, useClass: PrismaTeamReadModel },
  ],
})
class SummariesProbeModule {}

const AT = new Date('2026-10-01T00:00:00.000Z');

describe('GetTeamSummariesQuery through the QueryBus (integration, T-002-10a)', () => {
  const db = useTestDatabase();
  let app: INestApplication;
  let prisma: PrismaService;
  let queryBus: QueryBus;

  beforeAll(async () => {
    app = await createTestApp(db.url, { imports: [SummariesProbeModule] });
    prisma = app.get(PrismaService);
    queryBus = app.get(QueryBus);
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
    queryBus.execute(new GetTeamSummariesQuery(ownerId, ids));
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
});
