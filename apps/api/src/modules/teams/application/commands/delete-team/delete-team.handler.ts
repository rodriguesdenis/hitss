import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Clock } from '../../../../../shared/application/ports/clock';
import { DomainEventPublisher } from '../../../../../shared/application/ports/domain-event-publisher';
import { UnitOfWork } from '../../../../../shared/application/ports/unit-of-work';
import { ConcurrencyConflict } from '../../../../../shared/domain/domain-error';
import type { DomainEvent } from '../../../../../shared/domain/domain-event';
import { TeamNotFound } from '../../../domain/team.errors';
import { TeamRepository } from '../../../domain/team.repository';
import { DeleteTeamCommand } from './delete-team.command';

/**
 * In one unit of work: load (404, also for a foreign team whatever its If-Match, AC-02.9.8) →
 * If-Match (412) → `team.delete` → versioned soft delete (never touching task_teams: Task
 * Management unassigns in its in-transaction reaction) → in-transaction handlers of TeamDeleted.
 * A failing reaction rolls the soft delete back (AC-02.7.4). After commit, the events go to the
 * EventBus. Without If-Match a lost race is retried once, as in ReplaceTeam.
 */
@CommandHandler(DeleteTeamCommand)
export class DeleteTeamHandler implements ICommandHandler<
  DeleteTeamCommand,
  void
> {
  constructor(
    private readonly teams: TeamRepository,
    private readonly clock: Clock,
    private readonly unitOfWork: UnitOfWork,
    private readonly publisher: DomainEventPublisher,
  ) {}
  async execute(command: DeleteTeamCommand): Promise<void> {
    let events: DomainEvent[];
    try {
      events = await this.attempt(command);
    } catch (error) {
      if (
        !(error instanceof ConcurrencyConflict) ||
        command.expected.kind !== 'any'
      ) {
        throw error;
      }
      events = await this.attempt(command);
    }
    this.publisher.publishAfterCommit(events);
  }

  private attempt({
    ownerId,
    id,
    expected,
  }: DeleteTeamCommand): Promise<DomainEvent[]> {
    return this.unitOfWork.run(async () => {
      const team = await this.teams.findById(ownerId, id);
      if (!team) {
        throw new TeamNotFound();
      }
      team.assertVersion(expected);
      const loadedVersion = team.version;
      team.delete(this.clock.now());
      await this.teams.update(team, loadedVersion);
      const events = team.pullEvents();
      await this.publisher.publishInTransaction(events);
      return events;
    });
  }
}
