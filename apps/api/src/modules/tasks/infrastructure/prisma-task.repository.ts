import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { ConcurrencyConflict } from '../../../shared/domain/domain-error';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { Task } from '../domain/task';
import { TaskNotFound, UnknownTeams } from '../domain/task.errors';
import { TaskRepository } from '../domain/task.repository';
import { TaskMapper } from './task.mapper';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEAM_LINK_FK = 'task_teams_team_id_fkey';
const WITH_TEAMS = { teams: { select: { teamId: true } } } as const;

/**
 * Write-side persistence of the Task aggregate: the tasks row and its task_teams links, always
 * written together. Every statement filters by owner_id; reads only see active rows.
 * Unknown team ids are the application's check (TeamDirectory.findMissing). A team that
 * disappears between that check and the write (TOCTOU) trips the task_teams foreign key; that
 * violation becomes UnknownTeams with the offending ids (422), not an unexpected error (500).
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
    return row ? TaskMapper.toDomain(row) : null;
  }

  async findByTeam(ownerId: string, teamId: string): Promise<Task[]> {
    if (!UUID.test(teamId)) return [];
    const rows = await this.prisma.task.findMany({
      where: { ownerId, deletedAt: null, teams: { some: { teamId } } },
      include: WITH_TEAMS,
      orderBy: { id: 'asc' },
    });
    return rows.map((row) => TaskMapper.toDomain(row));
  }

  async insert(task: Task): Promise<void> {
    await this.withUnknownTeams(task, () =>
      this.transaction(async (tx) => {
        await tx.task.create({ data: TaskMapper.toInsert(task) });
        await this.addLinks(tx, task.id, task.teamIds.values);
      }),
    );
  }

  async update(task: Task, expectedVersion: number): Promise<number> {
    return this.withUnknownTeams(task, () =>
      this.updateRow(task, expectedVersion),
    );
  }

  private updateRow(task: Task, expectedVersion: number): Promise<number> {
    return this.transaction(async (tx) => {
      const { count } = await tx.task.updateMany({
        where: {
          id: task.id,
          ownerId: task.ownerId,
          version: expectedVersion,
          deletedAt: null,
        },
        data: { ...TaskMapper.toUpdate(task), version: { increment: 1 } },
      });
      if (count === 0) {
        // Nothing matched: tell a version conflict apart from a missing row.
        const current = await tx.task.findFirst({
          where: { id: task.id, ownerId: task.ownerId, deletedAt: null },
          select: { version: true },
        });
        throw current
          ? new ConcurrencyConflict(current.version)
          : new TaskNotFound();
      }
      // Diff-sync the links: unchanged ones keep their row (and created_at).
      const teamIds = task.teamIds.values;
      await tx.taskTeam.deleteMany({
        where: { taskId: task.id, teamId: { notIn: teamIds } },
      });
      await this.addLinks(tx, task.id, teamIds);
      return expectedVersion + 1;
    });
  }

  /**
   * Runs a write; a violation of the team-link foreign key becomes UnknownTeams carrying the
   * task's team ids that no longer exist. The failed transaction is already rolled back, so
   * the lookup runs on its own. If every team exists again, the original error passes through.
   */
  private async withUnknownTeams<T>(
    task: Task,
    write: () => Promise<T>,
  ): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (!isTeamLinkViolation(error)) throw error;
      const ids = task.teamIds.values;
      const existing = await this.prisma.team.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      });
      const found = new Set(existing.map((team) => team.id));
      const missing = ids.filter((id) => !found.has(id));
      throw missing.length > 0 ? new UnknownTeams(missing) : error;
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

  /**
   * The single transaction seam. Until the CLS unit of work lands (T-002-05/09), each write is
   * its own interactive transaction; then this becomes the ambient `txHost.tx`
   * (Propagation.Required), joining the caller's transaction without a port change.
   */
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
