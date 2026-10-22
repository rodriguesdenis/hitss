import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import type { Page, SortDirection } from '../../../shared/application/page';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { containsPattern } from '../../../shared/infrastructure/sql/like';
import {
  ListTeamsCriteria,
  TeamReadModel,
  TeamSortField,
} from '../application/ports/team.read-model';
import type { TeamView } from '../application/views/team.view';

interface TeamRow {
  id: string;
  name: string;
  color_hex: string;
  description: string | null;
  version: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * ORDER BY comes only from this whitelist (never from input). Every sort ends with id, so equal
 * keys page deterministically (ADR-0006). The default -createdAt and `name` follow
 * teams_owner_id_created_at_idx and teams_owner_id_lower_name_key.
 */
const ORDER: Record<TeamSortField, Record<SortDirection, Prisma.Sql>> = {
  name: {
    asc: Prisma.sql`lower(name) ASC, id ASC`,
    desc: Prisma.sql`lower(name) DESC, id DESC`,
  },
  createdAt: {
    asc: Prisma.sql`created_at ASC, id ASC`,
    desc: Prisma.sql`created_at DESC, id DESC`,
  },
  updatedAt: {
    asc: Prisma.sql`updated_at ASC, id ASC`,
    desc: Prisma.sql`updated_at DESC, id DESC`,
  },
};

/**
 * Query side of Team Management: parameterized SQL, owner-scoped, active teams only. The page
 * and the total are read in one REPEATABLE READ transaction, so they come from one snapshot.
 */
@Injectable()
export class PrismaTeamReadModel extends TeamReadModel {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async page(
    ownerId: string,
    { page, search, sort }: ListTeamsCriteria,
  ): Promise<Page<TeamView>> {
    const where = Prisma.sql`owner_id = ${ownerId} AND deleted_at IS NULL${
      search
        ? Prisma.sql` AND name ILIKE ${containsPattern(search)} ESCAPE '\\'`
        : Prisma.empty
    }`;
    const [rows, counted] = await this.prisma.$transaction(
      [
        this.prisma.$queryRaw<TeamRow[]>`
          SELECT id, name, color_hex, description, version, created_at, updated_at
          FROM teams WHERE ${where}
          ORDER BY ${ORDER[sort.field][sort.direction]}
          LIMIT ${page.limit} OFFSET ${page.offset}`,
        this.prisma.$queryRaw<{ total: number }[]>`
          SELECT count(*)::int AS total FROM teams WHERE ${where}`,
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      items: rows.map(toView),
      total: counted[0]?.total ?? 0,
    };
  }
}

function toView(row: TeamRow): TeamView {
  return {
    id: row.id,
    name: row.name,
    colorHex: row.color_hex,
    description: row.description,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
