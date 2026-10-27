import { Task } from '../../domain/entities/task.entity';
import { DueDate } from '../../domain/value-objects/due-date.vo';
import type {
  TaskRecord,
  TaskView,
} from '../interfaces/task-read-model.interface';
import type { TeamSummary } from '../interfaces/team-directory.interface';

export function toTaskView(
  { teamIds, ...task }: TaskRecord,
  teams: readonly TeamSummary[],
  today: DueDate,
): TaskView {
  const own = new Set(teamIds);
  const dueDate = task.dueDate === null ? null : DueDate.create(task.dueDate);
  return {
    ...task,
    isOverdue: Task.isOverdue(task.status, dueDate, today),
    teams: teams
      .filter((team) => own.has(team.id))
      .sort(byNameThenId)
      .map(({ id, name, colorHex }) => ({ id, name, colorHex })),
  };
}

function byNameThenId(a: TeamSummary, b: TeamSummary): number {
  const [x, y] = [a.name.toLowerCase(), b.name.toLowerCase()];
  if (x !== y) return x < y ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
