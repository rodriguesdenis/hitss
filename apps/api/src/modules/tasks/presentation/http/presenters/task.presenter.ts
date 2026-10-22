import type { TeamSummary } from '../../../../teams/team-lookup.service';
import type { TaskView } from '../../../application/ports/task.read-model';
import { Task } from '../../../domain/entities/task.entity';
import { DueDate } from '../../../domain/value-objects/due-date.vo';
import type { TaskResponseDto } from '../dto/task-response.dto';

/**
 * TaskView → the documented response fields only, timestamps as ISO 8601 strings. Only the task's
 * own live teams are embedded, by name (a deleted team is never returned by TeamLookup,
 * AC-03.2.5), and isOverdue is derived with the entity's rule (BR-03.9).
 */
export function toTaskResponse({
  task,
  teams,
  today,
}: TaskView): TaskResponseDto {
  const own = new Set(task.teamIds);
  const dueDate = task.dueDate === null ? null : DueDate.create(task.dueDate);
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    dueDate: task.dueDate,
    completedAt: task.completedAt?.toISOString() ?? null,
    isOverdue: Task.isOverdue(task.status, dueDate, today),
    teams: teams
      .filter((team) => own.has(team.id))
      .sort(byNameThenId)
      .map(({ id, name, colorHex }) => ({ id, name, colorHex })),
    version: task.version,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

/** Case-insensitive name order (AC-03.2.5), ties by id so the order is total and stable. */
function byNameThenId(a: TeamSummary, b: TeamSummary): number {
  const [x, y] = [a.name.toLowerCase(), b.name.toLowerCase()];
  if (x !== y) return x < y ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
