import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import type { PrismaTransactionHost } from '../../../shared/infrastructure/transactions/cls-unit-of-work';
import { TransactionHost } from '@nestjs-cls/transactional';
import { Team } from '../domain/team';
import { TeamNameAlreadyExists, TeamNotFound } from '../domain/team.errors';
import { TeamRepository } from '../domain/team.repository';
import { TeamName } from '../domain/value-objects/team-name';
import { TeamMapper } from './team.mapper';

const NAME_UNIQUE_INDEX = 'teams_owner_id_lower_name_key';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Write-side persistence of the Team aggregate. Every statement filters by owner_id, and
 * reads only see active rows (deleted_at IS NULL). Statements run on `txHost.tx`, so they join
 * the transaction of the current unit of work.
 */
@Injectable()
export class PrismaTeamRepository extends TeamRepository {
  constructor(
    @Inject(TransactionHost) private readonly txHost: PrismaTransactionHost,
  ) {
    super();
  }

  /** The client of the ambient transaction (UnitOfWork.run), or the base client outside one. */
  private get prisma() {
    return this.txHost.tx;
  }

  async findById(ownerId: string, id: string): Promise<Team | null> {
    // A malformed id cannot exist; skip the query (the uuid column would reject the cast).
    if (!UUID.test(id)) return null;
    const row = await this.prisma.team.findFirst({
      where: { id, ownerId, deletedAt: null },
    });
    return row ? TeamMapper.toDomain(row) : null;
  }

  async existsActiveByName(
    ownerId: string,
    name: TeamName,
    excludingId?: string,
  ): Promise<boolean> {
    // A malformed id matches no row, so there is nothing to exclude.
    const excluded = excludingId && UUID.test(excludingId) ? excludingId : null;
    // Same expression as the unique index, so the database decides what "same name" means.
    const [row] = await this.prisma.$queryRaw<{ taken: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM teams
        WHERE owner_id = ${ownerId}
          AND deleted_at IS NULL
          AND lower(name) = lower(${name.value})
          AND (${excluded}::uuid IS NULL OR id <> ${excluded}::uuid)
      ) AS taken`;
    return row?.taken ?? false;
  }

  async insert(team: Team): Promise<void> {
    try {
      await this.prisma.team.create({ data: TeamMapper.toInsert(team) });
    } catch (error) {
      throw translateNameCollision(error);
    }
  }

  async update(team: Team): Promise<void> {
    let count: number;
    try {
      ({ count } = await this.prisma.team.updateMany({
        where: { id: team.id, ownerId: team.ownerId, deletedAt: null },
        data: { ...TeamMapper.toUpdate(team), version: { increment: 1 } },
      }));
    } catch (error) {
      throw translateNameCollision(error);
    }
    if (count === 0) throw new TeamNotFound();
  }
}

/** Maps a violation of the name index to the domain error; anything else passes through. */
function translateNameCollision(error: unknown): unknown {
  const isNameCollision =
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    JSON.stringify(error.meta ?? {}).includes(NAME_UNIQUE_INDEX);
  return isNameCollision ? new TeamNameAlreadyExists() : error;
}
