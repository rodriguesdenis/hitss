import type { TaskStatus } from '../../../domain/value-objects/task-status.vo';
import { TaskFields } from './task-fields';

/**
 * Body of `POST /api/v1/tasks` (plan 003 → DTOs). Any other field, owner fields included,
 * → 400 naming it (global pipe, AC-03.1.7, AC-03.12.6).
 */
export class CreateTaskDto {
  @TaskFields.title()
  title!: string;

  @TaskFields.description()
  description?: string | null;

  @TaskFields.status({ required: false })
  status?: TaskStatus;

  @TaskFields.dueDate()
  dueDate?: string | null;

  @TaskFields.teamIds({ required: false })
  teamIds?: string[];
}
