import type { Task as TaskRow } from '../../../../generated/prisma/client';
import { Task } from '../../domain/entities/task.entity';
import { DueDate } from '../../domain/value-objects/due-date.vo';
import { TaskDescription } from '../../domain/value-objects/task-description.vo';
import { parseTaskStatus } from '../../domain/value-objects/task-status.vo';
import { TaskTeamIds } from '../../domain/value-objects/task-team-ids.vo';
import { TaskTitle } from '../../domain/value-objects/task-title.vo';

/** A tasks row with its team links, as the repository loads it. */
export type TaskRowWithTeams = TaskRow & { teams: { teamId: string }[] };

/** Prisma row ⇄ Task aggregate. Prisma types never leave infrastructure (rule A2). */
export const TaskMapper = {
  /** Re-validates through the VOs' create(): tightening a VO rule needs a data migration (ADR-0004). */
  toDomain(row: TaskRowWithTeams): Task {
    return Task.reconstitute({
      id: row.id,
      ownerId: row.ownerId,
      title: TaskTitle.create(row.title),
      description: TaskDescription.create(row.description),
      status: parseTaskStatus(row.status),
      dueDate: row.dueDate ? DueDate.create(toCalendarDay(row.dueDate)) : null,
      teamIds: TaskTeamIds.of(row.teams.map((link) => link.teamId)),
      completedAt: row.completedAt,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  },

  /** A full tasks row for a new task (links are written separately); version starts at 1. */
  toInsert(task: Task): TaskRow {
    return {
      ...TaskMapper.toUpdate(task),
      id: task.id,
      ownerId: task.ownerId,
      version: 1,
      createdAt: task.createdAt,
    };
  },

  /** The columns an update writes; id, owner, version and createdAt are never written. */
  toUpdate(task: Task) {
    return {
      title: task.title.value,
      description: task.description.value,
      status: task.status,
      dueDate: task.dueDate ? fromCalendarDay(task.dueDate.value) : null,
      completedAt: task.completedAt,
      updatedAt: task.updatedAt,
      deletedAt: task.deletedAt,
    };
  },
};

// A `date` column travels as midnight UTC; reading and writing in UTC keeps the calendar day
// independent of the server's time zone.
function toCalendarDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function fromCalendarDay(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}
