import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/domain/clock';
import { TaskNotFound } from '../../domain/errors/task.errors';
import { TaskRepository } from '../../domain/repositories/task.repository';
import type { TaskStatus } from '../../domain/value-objects/task-status.vo';
import type { TaskView } from '../interfaces/task-read-model.interface';
import { GetTaskUseCase } from './get-task.use-case';

export interface ChangeTaskStatusInput {
  readonly ownerId: string;
  readonly id: string;
  readonly status: TaskStatus;
}

@Injectable()
export class ChangeTaskStatusUseCase {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly clock: Clock,
    private readonly getTask: GetTaskUseCase,
  ) {}

  async execute({
    ownerId,
    id,
    status,
  }: ChangeTaskStatusInput): Promise<TaskView> {
    const task = await this.tasks.findById(ownerId, id);
    if (!task) {
      throw new TaskNotFound();
    }
    if (task.changeStatus(status, this.clock.now())) {
      await this.tasks.update(task);
    }
    return this.getTask.execute({ ownerId, id });
  }
}
