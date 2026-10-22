import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { Clock } from '../../../../../shared/application/ports/clock';
import { TaskNotFound } from '../../../domain/task.errors';
import { TaskRepository } from '../../../domain/task.repository';
import { DeleteTaskCommand } from './delete-task.command';

/**
 * Plan 003 → DeleteTask: load, `delete(now)`, write `deleted_at` with the version guard, publish
 * TaskDeleted. The row and its team links stay (soft delete, history); every read ignores them.
 * Unknown, foreign or already deleted → TaskNotFound (AC-03.11.2). As with a status change, a
 * write lost to a concurrent one is reloaded and reapplied once (last write wins).
 */
@CommandHandler(DeleteTaskCommand)
export class DeleteTaskHandler implements ICommandHandler<
  DeleteTaskCommand,
  void
> {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly events: EventBus,
    private readonly clock: Clock,
  ) {}
  async execute({ ownerId, id }: DeleteTaskCommand): Promise<void> {
    const task = await this.tasks.findById(ownerId, id);
    if (!task) {
      throw new TaskNotFound();
    }
    task.delete(this.clock.now());
    await this.tasks.update(task);
    this.events.publishAll(task.pullEvents());
  }
}
