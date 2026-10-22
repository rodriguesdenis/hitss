import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Prisma } from '../../src/generated/prisma/client';
import { PrismaService } from '../../src/shared/infrastructure/prisma/prisma.service';
import { TeamNameAlreadyExists } from '../../src/modules/teams/domain/team.errors';
import { TeamName } from '../../src/modules/teams/domain/value-objects/team-name';
import { PrismaTeamRepository } from '../../src/modules/teams/infrastructure/prisma-team.repository';
import { TransactionHost } from '@nestjs-cls/transactional';
import { createTestApp } from '../support/app';
import { useTestDatabase } from '../support/postgres';
import {
  aTeam,
  describeTeamRepositoryContract,
} from '../support/team-repository.contract';

describe('PrismaTeamRepository (integration, T-002-03)', () => {
  const db = useTestDatabase();
  let app: INestApplication;
  let prisma: PrismaService;
  let repository: PrismaTeamRepository;

  beforeAll(async () => {
    app = await createTestApp(db.url);
    prisma = app.get(PrismaService);
    repository = new PrismaTeamRepository(app.get(TransactionHost));
  });

  afterAll(async () => {
    await app?.close();
  });

  const newOwner = async (): Promise<string> => {
    const user = await prisma.user.create({
      data: { name: 'Owner', email: `owner-${randomUUID()}@example.test` },
    });
    return user.id;
  };

  describeTeamRepositoryContract(() => ({ repository, newOwner }));

  it('AC-08.3 two concurrent updates from the same load both apply (last write wins)', async () => {
    const ownerId = await newOwner();
    const team = aTeam(ownerId, 'Mobile');
    await repository.insert(team);
    const [first, second] = await Promise.all([
      repository.findById(ownerId, team.id),
      repository.findById(ownerId, team.id),
    ]);
    const now = new Date('2026-10-20T14:00:00.000Z');
    first!.replace({
      name: TeamName.create('One'),
      color: first!.color,
      description: first!.description,
      now,
    });
    second!.replace({
      name: TeamName.create('Two'),
      color: second!.color,
      description: second!.description,
      now,
    });

    const results = await Promise.allSettled([
      repository.update(first!),
      repository.update(second!),
    ]);

    // Last write wins (ADR-0020, AC-08.3): both writes apply, each incrementing the version.
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
    expect((await repository.findById(ownerId, team.id))!.version).toBe(3);
  });

  it('AC-02.1.9 maps the loser of two concurrent creates to TeamNameAlreadyExists', async () => {
    const ownerId = await newOwner();

    const results = await Promise.allSettled([
      repository.insert(aTeam(ownerId, 'Design')),
      repository.insert(aTeam(ownerId, 'DESIGN')),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(
      (r) => r.status === 'rejected',
    ) as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(TeamNameAlreadyExists);
  });

  it('does not mistake a duplicate id for a name collision', async () => {
    const ownerId = await newOwner();
    const team = aTeam(ownerId, 'Original');
    await repository.insert(team);
    const clone = aTeam(ownerId, 'Another name', { id: team.id });

    const error: unknown = await repository
      .insert(clone)
      .catch((e: unknown) => e);

    // The primary-key violation passes through untranslated...
    expect(error).not.toBeInstanceOf(TeamNameAlreadyExists);
    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    const known = error as Prisma.PrismaClientKnownRequestError;
    expect(known.code).toBe('P2002');
    expect(JSON.stringify(known.meta)).toContain('teams_pkey');
    // ...and nothing was written.
    const rows = await prisma.team.findMany({ where: { id: team.id } });
    expect(rows.map((r) => r.name)).toEqual(['Original']);
  });
});
