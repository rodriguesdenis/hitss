import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Clock } from '../../../../../shared/application/ports/clock';
import { DomainEventPublisher } from '../../../../../shared/application/ports/domain-event-publisher';
import { UnitOfWork } from '../../../../../shared/application/ports/unit-of-work';
import { ConcurrencyConflict } from '../../../../../shared/domain/domain-error';
import type { DomainEvent } from '../../../../../shared/domain/domain-event';
import { Traced } from '../../../../../shared/observability/tracing/traced-handler';
import { TaskNotFound, UnknownTeams } from '../../../domain/task.errors';
import { TaskRepository } from '../../../domain/task.repository';
import { DueDate } from '../../../domain/value-objects/due-date';
import { TaskDescription } from '../../../domain/value-objects/task-description';
import { TaskTeamIds } from '../../../domain/value-objects/task-team-ids';
import { TaskTitle } from '../../../domain/value-objects/task-title';
import { TeamDirectory } from '../../ports/team-directory';
import { preciseUnknownTeams } from '../precise-unknown-teams';
import { ReplaceTaskCommand } from './replace-task.command';

/**
 * Plan 003 → ReplaceTask:
 * 1. Load the owner's active task; unknown, foreign or deleted → TaskNotFound. Not found wins
 *    over every other error.
 * 2. Run the create checks: the team count first (TooManyTeams), the value objects, then
 *    UnknownTeams for ids that are not the owner's live teams.
 * 3. Apply `edit`, `assignTo` and `changeStatus`, then write once (version + 1) unless nothing
 *    changed. An identical replacement (team order ignored) is a no-op (AC-03.9.5).
 * Steps 1–3 run in one unit of work that first locks the new team links, so a team deleted
 * concurrently is either reported here or unassigned by the TeamDeleted reaction (T-003-13).
 * Events are published after commit. A team-link foreign-key violation is reported with the
 * precise ids (preciseUnknownTeams).
 * Without an expected version the client asked for last-write-wins, so a write lost to a
 * concurrent one is reloaded and reapplied once.
 */
@CommandHandler(ReplaceTaskCommand)
export class ReplaceTaskHandler implements ICommandHandler<
  ReplaceTaskCommand,
  { id: string }
> {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly teams: TeamDirectory,
    private readonly unitOfWork: UnitOfWork,
    private readonly publisher: DomainEventPublisher,
    private readonly clock: Clock,
  ) {}

  @Traced()
  async execute(command: ReplaceTaskCommand): Promise<{ id: string }> {
    let events: DomainEvent[];
    try {
      events = await this.attemptOnceMoreOnConflict(command);
    } catch (error) {
      throw await preciseUnknownTeams(
        error,
        this.teams,
        command.ownerId,
        command.teamIds,
      );
    }
    this.publisher.publishAfterCommit(events);
    return { id: command.id };
  }

  private async attemptOnceMoreOnConflict(
    command: ReplaceTaskCommand,
  ): Promise<DomainEvent[]> {
    try {
      return await this.attempt(command);
    } catch (error) {
      if (!(error instanceof ConcurrencyConflict)) throw error;
      return this.attempt(command);
    }
  }

  private attempt(command: ReplaceTaskCommand): Promise<DomainEvent[]> {
    return this.unitOfWork.run(() => this.replace(command));
  }

  private async replace(command: ReplaceTaskCommand): Promise<DomainEvent[]> {
    const { ownerId, id } = command;
    const task = await this.tasks.findById(ownerId, id);
    if (!task) {
      throw new TaskNotFound();
    }
    const teamIds = TaskTeamIds.of(command.teamIds);
    const fields = {
      title: TaskTitle.create(command.title),
      description: TaskDescription.create(command.description),
      dueDate: command.dueDate ? DueDate.create(command.dueDate) : null,
    };
    await this.tasks.lockTeamLinks(teamIds.values);
    const missing = await this.teams.findMissing(ownerId, teamIds.values);
    if (missing.length > 0) {
      throw new UnknownTeams(missing);
    }

    const now = this.clock.now();
    // Each method touches updatedAt only when it changes something; no short-circuit, all run.
    const changes = [
      task.edit({ ...fields, now }),
      task.assignTo(teamIds, now),
      task.changeStatus(command.status, now),
    ];
    if (changes.includes(true)) {
      await this.tasks.update(task, task.version);
    }
    return task.pullEvents();
  }
}
