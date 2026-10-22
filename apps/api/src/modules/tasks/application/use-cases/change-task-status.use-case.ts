import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/domain/clock';
import { TaskNotFound } from '../../domain/errors/task.errors';
import { TaskRepository } from '../../domain/repositories/task.repository';
import type { TaskStatus } from '../../domain/value-objects/task-status.vo';

export interface ChangeTaskStatusInput {
  readonly ownerId: string;
  readonly id: string;
  readonly status: TaskStatus;
}

/**
 * Load, `changeStatus`, write unless it is a no-op: the same status writes nothing and keeps the
 * version, updated time and completion time (AC-03.10.3). Unknown, foreign and deleted →
 * TaskNotFound. Last write wins (ADR-0020).
 */
@Injectable()
export class ChangeTaskStatusUseCase {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly clock: Clock,
  ) {}

  async execute({ ownerId, id, status }: ChangeTaskStatusInput): Promise<void> {
    const task = await this.tasks.findById(ownerId, id);
    if (!task) {
      throw new TaskNotFound();
    }
    if (task.changeStatus(status, this.clock.now())) {
      await this.tasks.update(task);
    }
  }
}
