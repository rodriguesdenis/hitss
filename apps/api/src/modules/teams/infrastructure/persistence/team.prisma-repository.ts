import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type Team as TeamRow,
} from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { Team } from '../../domain/entities/team.entity';
import {
  TeamNameAlreadyExists,
  TeamNotFound,
} from '../../domain/errors/team.errors';
import { TeamRepository } from '../../domain/repositories/team.repository';
import { ColorHex } from '../../domain/value-objects/color-hex.vo';
import { TeamName } from '../../domain/value-objects/team-name.vo';

const NAME_UNIQUE_INDEX = 'teams_owner_id_lower_name_key';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class PrismaTeamRepository extends TeamRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(ownerId: string, id: string): Promise<Team | null> {
    if (!UUID.test(id)) return null;
    const row = await this.prisma.team.findFirst({
      where: { id, ownerId, deletedAt: null },
    });
    return row ? toDomain(row) : null;
  }

  async existsActiveByName(
    ownerId: string,
    name: TeamName,
    excludingId?: string,
  ): Promise<boolean> {
    const excluded = excludingId && UUID.test(excludingId) ? excludingId : null;
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
      await this.prisma.team.create({ data: toInsert(team) });
    } catch (error) {
      throw translateNameCollision(error);
    }
  }

  async update(team: Team): Promise<void> {
    let count: number;
    try {
      ({ count } = await this.prisma.team.updateMany({
        where: { id: team.id, ownerId: team.ownerId, deletedAt: null },
        data: { ...toUpdate(team), version: { increment: 1 } },
      }));
    } catch (error) {
      throw translateNameCollision(error);
    }
    if (count === 0) throw new TeamNotFound();
  }

  async delete(team: Team): Promise<void> {
    const deletedAt = team.deletedAt ?? new Date();
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.team.updateMany({
        where: { id: team.id, ownerId: team.ownerId, deletedAt: null },
        data: { ...toUpdate(team), version: { increment: 1 } },
      });
      if (count === 0) throw new TeamNotFound();
      await tx.$executeRaw`
        UPDATE tasks SET version = version + 1, updated_at = ${deletedAt}
        WHERE owner_id = ${team.ownerId} AND deleted_at IS NULL
          AND id IN (SELECT task_id FROM task_teams WHERE team_id = ${team.id}::uuid)`;
      await tx.taskTeam.deleteMany({ where: { teamId: team.id } });
    });
  }
}

function translateNameCollision(error: unknown): unknown {
  const isNameCollision =
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    JSON.stringify(error.meta ?? {}).includes(NAME_UNIQUE_INDEX);
  return isNameCollision ? new TeamNameAlreadyExists() : error;
}

function toDomain(row: TeamRow): Team {
  return Team.restore({
    id: row.id,
    ownerId: row.ownerId,
    name: TeamName.create(row.name),
    color: ColorHex.create(row.colorHex),
    description: row.description,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  });
}

function toInsert(team: Team): TeamRow {
  return {
    ...toUpdate(team),
    id: team.id,
    ownerId: team.ownerId,
    version: 1,
    createdAt: team.createdAt,
  };
}

function toUpdate(team: Team) {
  return {
    name: team.name.value,
    colorHex: team.color.value,
    description: team.description,
    updatedAt: team.updatedAt,
    deletedAt: team.deletedAt,
  };
}
