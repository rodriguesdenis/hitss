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

@Injectable()
export class PrismaTaskRepository extends TaskRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(ownerId: string, id: string): Promise<Task | null> {
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
      const teamIds = task.teamIds;
      await tx.taskTeam.deleteMany({
        where: { taskId: task.id, teamId: { notIn: teamIds } },
      });
      await this.addLinks(tx, task.id, teamIds);
    });
  }

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

type TaskRowWithTeams = TaskRow & { teams: { teamId: string }[] };

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

function toInsert(task: Task): TaskRow {
  return {
    ...toUpdate(task),
    id: task.id,
    ownerId: task.ownerId,
    version: 1,
    createdAt: task.createdAt,
  };
}

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

function toCalendarDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function fromCalendarDay(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}
