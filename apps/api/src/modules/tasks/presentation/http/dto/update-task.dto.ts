import type { TaskStatus } from '../../../domain/value-objects/task-status.vo';
import { TaskFields } from './task-fields';

/**
 * Body of `PUT /api/v1/tasks/:id`: a full replacement. `title`, `status` and `teamIds` are
 * required; an omitted description or due date is cleared (AC-03.9.1, AC-03.9.2). The create
 * rules apply, and any other field → 400 naming it (AC-03.9.3).
 */
export class UpdateTaskDto {
  @TaskFields.title()
  title!: string;

  @TaskFields.description()
  description?: string | null;

  @TaskFields.status({ required: true })
  status!: TaskStatus;

  @TaskFields.dueDate()
  dueDate?: string | null;

  @TaskFields.teamIds({ required: true })
  teamIds!: string[];
}
