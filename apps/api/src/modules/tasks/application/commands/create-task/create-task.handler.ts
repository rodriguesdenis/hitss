import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Clock } from '../../../../../shared/application/ports/clock';
import { DomainEventPublisher } from '../../../../../shared/application/ports/domain-event-publisher';
import { IdGenerator } from '../../../../../shared/application/ports/id-generator';
import { UnitOfWork } from '../../../../../shared/application/ports/unit-of-work';
import { Task } from '../../../domain/task';
import { UnknownTeams } from '../../../domain/task.errors';
import { TaskRepository } from '../../../domain/task.repository';
import { DueDate } from '../../../domain/value-objects/due-date';
import { TaskDescription } from '../../../domain/value-objects/task-description';
import { TaskTeamIds } from '../../../domain/value-objects/task-team-ids';
import { TaskTitle } from '../../../domain/value-objects/task-title';
import { TeamDirectory } from '../../ports/team-directory';
import { preciseUnknownTeams } from '../precise-unknown-teams';
import { CreateTaskCommand } from './create-task.command';

/**
 * Plan 003 → CreateTask: builds the value objects (the team count first, BR-03.8), then, in one
 * unit of work, locks the team links, rejects teams that are not the owner's live teams and
 * inserts the task at version 1. The lock serializes this write with a concurrent TeamDeleted
 * reaction, so a team deleted meanwhile is either reported here or unassigned there (T-003-13).
 * Every check runs before the insert, so nothing is written on any error; a team-link foreign-key
 * violation is reported with the precise ids (preciseUnknownTeams). Events are published after
 * commit. Commands return ids; the controller reads the task back through GetTaskQuery.
 */
@CommandHandler(CreateTaskCommand)
export class CreateTaskHandler implements ICommandHandler<
  CreateTaskCommand,
  { id: string }
> {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly teams: TeamDirectory,
    private readonly unitOfWork: UnitOfWork,
    private readonly publisher: DomainEventPublisher,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}
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
    try {
      await this.unitOfWork.run(async () => {
        await this.tasks.lockTeamLinks(teamIds.values);
        // Foreign, deleted and never-existing ids are reported alike (AC-03.1.6, AC-03.12.3).
        const missing = await this.teams.findMissing(
          command.ownerId,
          teamIds.values,
        );
        if (missing.length > 0) {
          throw new UnknownTeams(missing);
        }
        await this.tasks.insert(task);
      });
    } catch (error) {
      throw await preciseUnknownTeams(
        error,
        this.teams,
        command.ownerId,
        teamIds.values,
      );
    }
    this.publisher.publishAfterCommit(task.pullEvents());
    return { id: task.id };
  }
}
