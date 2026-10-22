import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import type { Page, SortDirection } from '../../../../shared/application/page';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { containsPattern } from '../../../../shared/infrastructure/sql/like';
import {
  ListTeamsCriteria,
  TeamReadModel,
  TeamSortField,
  TeamSummary,
  TeamView,
} from '../../application/ports/team.read-model';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface TeamRow {
  id: string;
  name: string;
  color_hex: string;
  description: string | null;
  task_count: number;
  version: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * The owner's active tasks assigned to the team (AC-02.8.x, AC-03.11.3): a soft-deleted task
 * keeps its links but never counts. One correlated subquery per returned row, served by the
 * task_teams team index; a page holds at most 100 teams.
 */
const COLUMNS = Prisma.sql`
  id, name, color_hex, description, version, created_at, updated_at,
  (SELECT count(*)::int FROM task_teams tt JOIN tasks t ON t.id = tt.task_id
   WHERE tt.team_id = teams.id AND t.owner_id = teams.owner_id AND t.deleted_at IS NULL
  ) AS task_count`;

/**
 * ORDER BY comes only from this whitelist (never from input). Every order is total, so equal keys
 * page deterministically (ADR-0006): timestamps end with id; lower(name) needs no tie-break,
 * because teams_owner_id_lower_name_key makes it unique among the owner's active teams (exactly
 * this query's filter), and an id there would add an Incremental Sort on top of that index.
 */
const ORDER: Record<TeamSortField, Record<SortDirection, Prisma.Sql>> = {
  name: {
    asc: Prisma.sql`lower(name) ASC`,
    desc: Prisma.sql`lower(name) DESC`,
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
 * Read side of Team Management: parameterized SQL, owner-scoped, active teams only, with each
 * team's task count. The page and the total are read in one REPEATABLE READ transaction, so they
 * come from one snapshot.
 */
@Injectable()
export class PrismaTeamReadModel extends TeamReadModel {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(ownerId: string, id: string): Promise<TeamView | null> {
    // A malformed id cannot exist; skip the query (the uuid column would reject the cast).
    if (!UUID.test(id)) {
      return null;
    }
    const [row] = await this.prisma.$queryRaw<TeamRow[]>`
      SELECT ${COLUMNS}
      FROM teams WHERE id = ${id}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL`;
    return row ? toView(row) : null;
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
          SELECT ${COLUMNS}
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

  async summaries(
    ownerId: string,
    ids: readonly string[],
  ): Promise<TeamSummary[]> {
    // Malformed ids cannot exist (and would fail the uuid cast); duplicates are asked once.
    const wanted = [
      ...new Set(
        ids.filter((id) => UUID.test(id)).map((id) => id.toLowerCase()),
      ),
    ];
    if (wanted.length === 0) return [];
    return this.prisma.team.findMany({
      where: { ownerId, deletedAt: null, id: { in: wanted } },
      select: { id: true, name: true, colorHex: true },
    });
  }
}

function toView(row: TeamRow): TeamView {
  return {
    id: row.id,
    name: row.name,
    colorHex: row.color_hex,
    description: row.description,
    taskCount: row.task_count,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
