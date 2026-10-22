import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { Prisma } from '../../../generated/prisma/client';
import type { PrismaTransactionHost } from '../../../shared/infrastructure/transactions/cls-unit-of-work';
import { Task } from '../domain/task';
import { TaskNotFound, UnknownTeams } from '../domain/task.errors';
import { TaskRepository } from '../domain/task.repository';
import { TaskMapper } from './task.mapper';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEAM_LINK_FK = 'task_teams_team_id_fkey';
const WITH_TEAMS = { teams: { select: { teamId: true } } } as const;
/** First key of the team-link advisory locks (pg_advisory_xact_lock(int4, int4)): "tt". */
const TEAM_LINK_LOCK_SPACE = 0x7474;

/**
 * Write-side persistence of the Task aggregate: the tasks row and its task_teams links, always
 * written together. Every statement filters by owner_id; reads only see active rows.
 * Unknown team ids are the application's check (TeamDirectory.findMissing). A violation of the
 * task_teams team foreign key becomes UnknownTeams without ids (422, not 500); after the
 * rollback the command handler asks TeamDirectory.findMissing again for the precise ids
 * (preciseUnknownTeams). This repository never reads Team
 * Management's tables (constitution II.2).
 *
 * P2003 only covers a team row that is physically gone. A team SOFT-deleted concurrently with
 * a write is handled by `lockTeamLinks` (T-003-13): the write and the TeamDeleted reaction
 * serialize on a per-team advisory lock, so the second one sees the first one's commit.
 *
 * Statements run on `txHost.tx`, so they join the unit of work's transaction (the
 * TeamDeleted reaction runs inside DeleteTeam's). A write that needs several statements opens
 * one with `txHost.withTransaction`, which joins the ambient transaction when there is one
 * (Propagation.Required); a nested `prisma.$transaction` is not possible on a transaction
 * client.
 */
@Injectable()
export class PrismaTaskRepository extends TaskRepository {
  constructor(
    @Inject(TransactionHost) private readonly txHost: PrismaTransactionHost,
  ) {
    super();
  }

  /** The client of the ambient transaction (UnitOfWork.run), or the base client outside one. */
  private get prisma() {
    return this.txHost.tx;
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
    await this.withUnknownTeams(() =>
      this.transaction(async (tx) => {
        await tx.task.create({ data: TaskMapper.toInsert(task) });
        await this.addLinks(tx, task.id, task.teamIds.values);
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
        data: { ...TaskMapper.toUpdate(task), version: { increment: 1 } },
      });
      if (count === 0) {
        throw new TaskNotFound();
      }
      // Diff-sync the links: unchanged ones keep their row (and created_at).
      const teamIds = task.teamIds.values;
      await tx.taskTeam.deleteMany({
        where: { taskId: task.id, teamId: { notIn: teamIds } },
      });
      await this.addLinks(tx, task.id, teamIds);
    });
  }

  /**
   * Runs a write; a violation of the team-link foreign key becomes UnknownTeams without ids.
   * Which ids are missing is the TeamDirectory's answer, so the handler asks it again rather
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

  /**
   * Must stay READ COMMITTED; the TeamDeleted/link lock relies on it: after waiting for the lock,
   * the next statement must see what the other transaction committed meanwhile. Under REPEATABLE
   * READ the reaction would keep its older snapshot and miss links committed while it waited.
   */
  async lockTeamLinks(teamIds: readonly string[]): Promise<void> {
    if (!this.txHost.isTransactionActive()) {
      throw new Error('lockTeamLinks needs a transaction (UnitOfWork.run)');
    }
    // Sorted and distinct, so two writers never wait for each other in opposite orders.
    const ids = [...new Set(teamIds.map((id) => id.toLowerCase()))].sort();
    for (const id of ids) {
      await this.prisma.$executeRaw`
        SELECT pg_advisory_xact_lock(${TEAM_LINK_LOCK_SPACE}::int4, hashtext(${id}))`;
    }
  }

  /**
   * The single transaction seam: joins the unit of work's transaction when there is one
   * (Propagation.Required), else opens one for this write.
   */
  private transaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.txHost.withTransaction(() => work(this.txHost.tx));
  }
}

function isTeamLinkViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2003' &&
    JSON.stringify(error.meta ?? {}).includes(TEAM_LINK_FK)
  );
}
