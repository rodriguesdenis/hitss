import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { Clock } from '../../../../../shared/application/ports/clock';
import { TaskNotFound } from '../../../domain/task.errors';
import { TaskRepository } from '../../../domain/task.repository';
import { ChangeTaskStatusCommand } from './change-task-status.command';

/**
 * Plan 003 → ChangeTaskStatus: load, change, write unless it is a no-op (same status: no write,
 * same version, AC-03.10.3), then publish TaskStatusChanged. Without an expected version the
 * client asked for last-write-wins, so a write lost to a concurrent one is reloaded and
 * reapplied once (plan 003 → Error mapping). Unknown, foreign and deleted → TaskNotFound.
 */
@CommandHandler(ChangeTaskStatusCommand)
export class ChangeTaskStatusHandler implements ICommandHandler<
  ChangeTaskStatusCommand,
  { id: string }
> {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly events: EventBus,
    private readonly clock: Clock,
  ) {}
  async execute({
    ownerId,
    id,
    status,
  }: ChangeTaskStatusCommand): Promise<{ id: string }> {
    const task = await this.tasks.findById(ownerId, id);
    if (!task) {
      throw new TaskNotFound();
    }
    if (task.changeStatus(status, this.clock.now())) {
      await this.tasks.update(task);
      this.events.publishAll(task.pullEvents());
    }
    return { id: task.id };
  }
}
