import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { Clock } from '../../../../../shared/application/ports/clock';
import { IdGenerator } from '../../../../../shared/application/ports/id-generator';
import { Traced } from '../../../../../shared/observability/tracing/traced-handler';
import { Task } from '../../../domain/task';
import { UnknownTeams } from '../../../domain/task.errors';
import { TaskRepository } from '../../../domain/task.repository';
import { DueDate } from '../../../domain/value-objects/due-date';
import { TaskDescription } from '../../../domain/value-objects/task-description';
import { TaskTeamIds } from '../../../domain/value-objects/task-team-ids';
import { TaskTitle } from '../../../domain/value-objects/task-title';
import { TeamDirectory } from '../../ports/team-directory';
import { CreateTaskCommand } from './create-task.command';

/**
 * Plan 003 → CreateTask: builds the value objects (the team count first, BR-03.8), rejects
 * teams that are not the owner's live teams, inserts the task at version 1 and publishes its
 * events. Every check runs before the insert, so nothing is written on any error. Commands
 * return ids; the controller reads the task back through GetTaskQuery.
 */
@CommandHandler(CreateTaskCommand)
export class CreateTaskHandler implements ICommandHandler<
  CreateTaskCommand,
  { id: string }
> {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly teams: TeamDirectory,
    private readonly events: EventBus,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  @Traced()
  async execute(command: CreateTaskCommand): Promise<{ id: string }> {
    const teamIds = TaskTeamIds.of(command.teamIds);
    const task = Task.create({
      id: this.ids.next(),
      ownerId: command.ownerId,
      title: TaskTitle.create(command.title),
      description: TaskDescription.create(command.description),
      status: command.status,
      dueDate: command.dueDate ? DueDate.create(command.dueDate) : null,
      teamIds,
      now: this.clock.now(),
    });
    // Foreign, deleted and never-existing ids are reported alike (AC-03.1.6, AC-03.12.3).
    const missing = await this.teams.findMissing(
      command.ownerId,
      teamIds.values,
    );
    if (missing.length > 0) {
      throw new UnknownTeams(missing);
    }
    await this.tasks.insert(task);
    this.events.publishAll(task.pullEvents());
    return { id: task.id };
  }
}
