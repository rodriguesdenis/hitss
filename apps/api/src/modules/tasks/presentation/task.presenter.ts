import type { TaskView } from '../application/views/task.view';
import type { TaskResponseDto } from './dto/task.response.dto';

/** TaskView → the documented response fields only, timestamps as ISO 8601 strings. */
export function toTaskResponse(task: TaskView): TaskResponseDto {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    dueDate: task.dueDate,
    completedAt: task.completedAt?.toISOString() ?? null,
    isOverdue: task.isOverdue,
    teams: task.teams.map(({ id, name, colorHex }) => ({ id, name, colorHex })),
    version: task.version,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
