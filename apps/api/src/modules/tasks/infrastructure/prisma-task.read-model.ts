import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import type { Page, SortDirection } from '../../../shared/application/page';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { containsPattern } from '../../../shared/infrastructure/sql/like';
import {
  ListTasksCriteria,
  TaskReadModel,
  TaskRecord,
  TaskSortField,
} from '../application/ports/task.read-model';
import type { TaskStatus } from '../domain/value-objects/task-status';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// team_ids: ordered by the uuid itself, so task_teams_pkey (task_id, team_id) returns them sorted
// with no Sort node; for canonical lower-case uuids that is also their text order.
interface TaskListRow {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  due_date: string | null;
  completed_at: Date | null;
  version: number;
  created_at: Date;
  updated_at: Date;
  team_ids: string[];
}

/**
 * ORDER BY comes only from this whitelist (never from input) and always ends with id in the same
 * direction (AC-03.6.4). dueDate keeps tasks without a date last in both directions (AC-03.6.3);
 * title ignores case; status follows the enum, i.e. the lifecycle order (AC-03.6.2). The default
 * -createdAt, one status and dueDate ASC follow tasks_owner_created_idx,
 * tasks_owner_status_created_idx and tasks_owner_due_idx.
 */
const ORDER: Record<TaskSortField, Record<SortDirection, Prisma.Sql>> = {
  createdAt: {
    asc: Prisma.sql`t.created_at ASC, t.id ASC`,
    desc: Prisma.sql`t.created_at DESC, t.id DESC`,
  },
  updatedAt: {
    asc: Prisma.sql`t.updated_at ASC, t.id ASC`,
    desc: Prisma.sql`t.updated_at DESC, t.id DESC`,
  },
  dueDate: {
    asc: Prisma.sql`t.due_date ASC NULLS LAST, t.id ASC`,
    desc: Prisma.sql`t.due_date DESC NULLS LAST, t.id DESC`,
  },
  title: {
    asc: Prisma.sql`lower(t.title) ASC, t.id ASC`,
    desc: Prisma.sql`lower(t.title) DESC, t.id DESC`,
  },
  status: {
    asc: Prisma.sql`t.status ASC, t.id ASC`,
    desc: Prisma.sql`t.status DESC, t.id DESC`,
  },
};

/**
 * Query side of Task Management: flat records straight from the tables, never aggregates.
 * Every query is owner-scoped and sees active tasks only (deleted_at IS NULL). Team links are
 * returned as ids; names and colors come from the TeamDirectory (constitution II.2).
 */
@Injectable()
export class PrismaTaskReadModel extends TaskReadModel {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(ownerId: string, id: string): Promise<TaskRecord | null> {
    // A malformed id cannot exist; skip the query (the uuid column would reject the cast).
    if (!UUID.test(id)) return null;
    const row = await this.prisma.task.findFirst({
      where: { id, ownerId, deletedAt: null },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        dueDate: true,
        completedAt: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        teams: { select: { teamId: true }, orderBy: { teamId: 'asc' } },
      },
    });
    if (!row) return null;
    const { teams, dueDate, ...columns } = row;
    return {
      ...columns,
      // A `date` column travels as midnight UTC: the UTC day is the calendar day.
      dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : null,
      teamIds: teams.map((link) => link.teamId),
    };
  }

  async list(
    ownerId: string,
    { page, teamId, statuses, search, sort }: ListTasksCriteria,
  ): Promise<Page<TaskRecord>> {
    // A malformed team id cannot match a link; skip the queries (the uuid cast would fail).
    if (teamId !== undefined && !UUID.test(teamId))
      return { items: [], total: 0 };
    const where = Prisma.sql`t.owner_id = ${ownerId} AND t.deleted_at IS NULL${
      teamId
        ? Prisma.sql` AND EXISTS (SELECT 1 FROM task_teams f WHERE f.task_id = t.id AND f.team_id = ${teamId}::uuid)`
        : Prisma.empty
    }${statusFilter(statuses)}${
      search
        ? Prisma.sql` AND (t.title ILIKE ${containsPattern(search)} ESCAPE '\\' OR t.description ILIKE ${containsPattern(search)} ESCAPE '\\')`
        : Prisma.empty
    }`;
    const [rows, counted] = await this.prisma.$transaction(
      [
        this.prisma.$queryRaw<TaskListRow[]>`
          SELECT t.id, t.title, t.description, t.status, t.due_date::text AS due_date,
                 t.completed_at, t.version, t.created_at, t.updated_at,
                 ARRAY(SELECT tt.team_id FROM task_teams tt
                       WHERE tt.task_id = t.id ORDER BY tt.team_id)::text[] AS team_ids
          FROM tasks t WHERE ${where}
          ORDER BY ${ORDER[sort.field][sort.direction]}
          LIMIT ${page.limit} OFFSET ${page.offset}`,
        this.prisma.$queryRaw<{ total: number }[]>`
          SELECT count(*)::int AS total FROM tasks t WHERE ${where}`,
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items: rows.map(toRecord), total: counted[0]?.total ?? 0 };
  }
}

/**
 * One status is an equality, so tasks_owner_status_created_idx can return rows already in order;
 * `= ANY(...)` never uses it, even with one element (plan 003, verified on the compose image).
 */
function statusFilter(statuses: readonly TaskStatus[] | undefined): Prisma.Sql {
  if (!statuses || statuses.length === 0) return Prisma.empty;
  if (statuses.length === 1)
    return Prisma.sql` AND t.status = ${statuses[0]}::task_status`;
  return Prisma.sql` AND t.status = ANY(${[...statuses]}::task_status[])`;
}

function toRecord(row: TaskListRow): TaskRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    dueDate: row.due_date,
    completedAt: row.completed_at,
    teamIds: row.team_ids,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
