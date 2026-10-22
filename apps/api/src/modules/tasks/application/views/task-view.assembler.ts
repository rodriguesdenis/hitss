import { isOverdue } from '../../domain/overdue.policy';
import { DueDate } from '../../domain/value-objects/due-date';
import type { TaskRecord } from '../ports/task.read-model';
import type { TeamSummary } from '../ports/team-directory';
import type { TaskView } from './task.view';

/**
 * Builds the TaskView from a read-model record, the TeamDirectory's live summaries and today's
 * UTC day. Pure, so list handlers can fetch summaries once per page and assemble every row.
 * Only summaries of the task's own teams are embedded: a team the directory did not return
 * (deleted) never appears (AC-03.2.5).
 */
export function assembleTaskView(
  record: TaskRecord,
  summaries: readonly TeamSummary[],
  today: DueDate,
): TaskView {
  const own = new Set(record.teamIds);
  const teams = summaries
    .filter((team) => own.has(team.id))
    .sort(byNameThenId)
    .map(({ id, name, colorHex }) => ({ id, name, colorHex }));
  const dueDate =
    record.dueDate === null ? null : DueDate.create(record.dueDate);

  return {
    id: record.id,
    title: record.title,
    description: record.description,
    status: record.status,
    dueDate: record.dueDate,
    completedAt: record.completedAt,
    isOverdue: isOverdue(record.status, dueDate, today),
    teams,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/** Case-insensitive name order (AC-03.2.5), ties by id so the order is total and stable. */
function byNameThenId(a: TeamSummary, b: TeamSummary): number {
  const [x, y] = [a.name.toLowerCase(), b.name.toLowerCase()];
  if (x !== y) return x < y ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
