import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/domain/clock';
import { TaskNotFound } from '../../domain/errors/task.errors';
import { TaskRepository } from '../../domain/repositories/task.repository';

export interface DeleteTaskInput {
  readonly ownerId: string;
  readonly id: string;
}

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
