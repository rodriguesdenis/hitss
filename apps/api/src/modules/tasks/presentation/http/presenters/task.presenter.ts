import type { TeamSummary } from '../../../application/interfaces/team-directory.interface';
import type { TaskView } from '../../../application/interfaces/task-read-model.interface';
import { Task } from '../../../domain/entities/task.entity';
import { DueDate } from '../../../domain/value-objects/due-date.vo';
import type { TaskResponseDto } from '../dto/task-response.dto';

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

function byNameThenId(a: TeamSummary, b: TeamSummary): number {
  const [x, y] = [a.name.toLowerCase(), b.name.toLowerCase()];
  if (x !== y) return x < y ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
