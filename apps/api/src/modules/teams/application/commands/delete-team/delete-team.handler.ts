import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Clock } from '../../../../../shared/application/ports/clock';
import { DomainEventPublisher } from '../../../../../shared/application/ports/domain-event-publisher';
import { UnitOfWork } from '../../../../../shared/application/ports/unit-of-work';
import { TeamNotFound } from '../../../domain/team.errors';
import { TeamRepository } from '../../../domain/team.repository';
import { DeleteTeamCommand } from './delete-team.command';

/**
 * In one unit of work: load (404, also for a foreign team, AC-02.9.8) → `team.delete` → soft
 * delete (never touching task_teams: Task Management unassigns in its in-transaction reaction) →
 * in-transaction handlers of TeamDeleted. A failing reaction rolls the soft delete back
 * (AC-02.7.4). After commit, the events go to the EventBus. Last write wins (ADR-0020).
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
  async execute({ ownerId, id }: DeleteTeamCommand): Promise<void> {
    const events = await this.unitOfWork.run(async () => {
      const team = await this.teams.findById(ownerId, id);
      if (!team) {
        throw new TeamNotFound();
      }
      team.delete(this.clock.now());
      await this.teams.update(team);
      const pulled = team.pullEvents();
      await this.publisher.publishInTransaction(pulled);
      return pulled;
    });
    this.publisher.publishAfterCommit(events);
  }
}
