import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import type { Task as TaskRow } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { Task } from '../../domain/entities/task.entity';
import { TaskNotFound, UnknownTeams } from '../../domain/errors/task.errors';
import { TaskRepository } from '../../domain/repositories/task.repository';
import { DueDate } from '../../domain/value-objects/due-date.vo';
import { parseTaskStatus } from '../../domain/value-objects/task-status.vo';
import { TaskTitle } from '../../domain/value-objects/task-title.vo';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEAM_LINK_FK = 'task_teams_team_id_fkey';
const WITH_TEAMS = { teams: { select: { teamId: true } } } as const;

/**
 * Write-side persistence of the Task aggregate: the tasks row and its task_teams links, always
 * written together in one transaction. Every statement filters by owner_id; reads only see
 * active rows. Unknown team ids are the application's check (TeamLookup.assertAllLive). A
 * violation of the task_teams team foreign key becomes UnknownTeams without ids (422, not 500);
 * the use case then asks TeamLookup again for the precise ids (TeamLookup.assertAllLive). This
 * repository never reads Team Management's tables.
 *
 * A team soft-deleted between the TeamLookup check and the write still satisfies the foreign key
 * and leaves a link to a deleted team. Reads never show deleted teams, so it stays invisible;
 * accepted by ADR-0020.
 */
@Injectable()
export class PrismaTaskRepository extends TaskRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(ownerId: string, id: string): Promise<Task | null> {
    // A malformed id cannot exist; skip the query (the uuid column would reject the cast).
    if (!UUID.test(id)) return null;
    const row = await this.prisma.task.findFirst({
      where: { id, ownerId, deletedAt: null },
      include: WITH_TEAMS,
    });
    return row ? toDomain(row) : null;
  }

  async insert(task: Task): Promise<void> {
    await this.withUnknownTeams(() =>
      this.transaction(async (tx) => {
        await tx.task.create({ data: toInsert(task) });
        await this.addLinks(tx, task.id, task.teamIds);
      }),
    );
  }

  async update(task: Task): Promise<void> {
    return this.withUnknownTeams(() => this.updateRow(task));
  }

  private updateRow(task: Task): Promise<void> {
    return this.transaction(async (tx) => {
      const { count } = await tx.task.updateMany({
        where: {
          id: task.id,
          ownerId: task.ownerId,
          deletedAt: null,
        },
        data: { ...toUpdate(task), version: { increment: 1 } },
      });
      if (count === 0) {
        throw new TaskNotFound();
      }
      // Diff-sync the links: unchanged ones keep their row (and created_at).
      const teamIds = task.teamIds;
      await tx.taskTeam.deleteMany({
        where: { taskId: task.id, teamId: { notIn: teamIds } },
      });
      await this.addLinks(tx, task.id, teamIds);
    });
  }

  /**
   * Runs a write; a violation of the team-link foreign key becomes UnknownTeams without ids.
   * Which ids are missing is TeamLookup's answer, so the use case asks it again rather
   * than this repository querying the teams table.
   */
  private async withUnknownTeams<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      throw isTeamLinkViolation(error) ? new UnknownTeams([]) : error;
    }
  }

  private async addLinks(
    tx: Prisma.TransactionClient,
    taskId: string,
    teamIds: string[],
  ): Promise<void> {
    if (teamIds.length === 0) return;
    await tx.taskTeam.createMany({
      data: teamIds.map((teamId) => ({ taskId, teamId })),
      skipDuplicates: true,
    });
  }

  /** The single transaction seam: the tasks row and its links are written together. */
  private transaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(work);
  }
}

function isTeamLinkViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2003' &&
    JSON.stringify(error.meta ?? {}).includes(TEAM_LINK_FK)
  );
}

/** A tasks row with its team links, as the repository loads it. */
type TaskRowWithTeams = TaskRow & { teams: { teamId: string }[] };

/** Re-validates through the entity and its value objects: tightening a rule needs a data migration (ADR-0004). */
function toDomain(row: TaskRowWithTeams): Task {
  return Task.restore({
    id: row.id,
    ownerId: row.ownerId,
    title: TaskTitle.create(row.title),
    description: row.description,
    status: parseTaskStatus(row.status),
    dueDate: row.dueDate ? DueDate.create(toCalendarDay(row.dueDate)) : null,
    teamIds: row.teams.map((link) => link.teamId),
    completedAt: row.completedAt,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  });
}

/** A full tasks row for a new task (links are written separately); version starts at 1. */
function toInsert(task: Task): TaskRow {
  return {
    ...toUpdate(task),
    id: task.id,
    ownerId: task.ownerId,
    version: 1,
    createdAt: task.createdAt,
  };
}

/** The columns an update writes; id, owner, version and createdAt are never written. */
function toUpdate(task: Task) {
  return {
    title: task.title.value,
    description: task.description,
    status: task.status,
    dueDate: task.dueDate ? fromCalendarDay(task.dueDate.value) : null,
    completedAt: task.completedAt,
    updatedAt: task.updatedAt,
    deletedAt: task.deletedAt,
  };
}

// A `date` column travels as midnight UTC; reading and writing in UTC keeps the calendar day
// independent of the server's time zone.
function toCalendarDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function fromCalendarDay(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}
