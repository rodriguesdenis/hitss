import type { Team as TeamRow } from '../../../../generated/prisma/client';
import { Team } from '../../domain/entities/team.entity';
import { ColorHex } from '../../domain/value-objects/color-hex.vo';
import { TeamDescription } from '../../domain/value-objects/team-description.vo';
import { TeamName } from '../../domain/value-objects/team-name.vo';

/** Prisma row ⇄ Team aggregate. Prisma types never leave infrastructure (rule A2). */
export const TeamMapper = {
  /** Re-validates through the VOs' create(): tightening a VO rule needs a data migration (ADR-0004). */
  toDomain(row: TeamRow): Team {
    return Team.restore({
      id: row.id,
      ownerId: row.ownerId,
      name: TeamName.create(row.name),
      color: ColorHex.create(row.colorHex),
      description: TeamDescription.create(row.description),
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  },

  /** A full row for a new team; persistence starts every team at version 1. */
  toInsert(team: Team): TeamRow {
    return {
      ...TeamMapper.toUpdate(team),
      id: team.id,
      ownerId: team.ownerId,
      version: 1,
      createdAt: team.createdAt,
    };
  },

  /** The columns an update writes; id, owner, version and createdAt are never written. */
  toUpdate(team: Team) {
    return {
      name: team.name.value,
      colorHex: team.color.value,
      description: team.description.value,
      updatedAt: team.updatedAt,
      deletedAt: team.deletedAt,
    };
  },
};
