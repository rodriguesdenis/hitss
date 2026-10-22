import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/domain/clock';
import { TaskNotFound } from '../../domain/errors/task.errors';
import { TaskRepository } from '../../domain/repositories/task.repository';

export interface DeleteTaskInput {
  readonly ownerId: string;
  readonly id: string;
}

/**
 * Soft delete: load, `delete(now)`, write `deleted_at`. The row and its task_teams links stay
 * (history); every read ignores them. Unknown, foreign or already deleted → TaskNotFound
 * (AC-03.11.2).
 */
@Injectable()
export class DeleteTaskUseCase {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly clock: Clock,
  ) {}

  async execute({ ownerId, id }: DeleteTaskInput): Promise<void> {
    const task = await this.tasks.findById(ownerId, id);
    if (!task) {
      throw new TaskNotFound();
    }
    task.delete(this.clock.now());
    await this.tasks.update(task);
  }
}
