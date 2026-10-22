import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/domain/clock';
import { DomainEventPublisher } from '../../../../shared/application/ports/domain-event-publisher';
import { UnitOfWork } from '../../../../shared/application/ports/unit-of-work';
import { TeamNotFound } from '../../domain/errors/team.errors';
import { TeamRepository } from '../../domain/repositories/team.repository';

export interface DeleteTeamInput {
  readonly ownerId: string;
  readonly id: string;
}

/**
 * In one unit of work: load (404, also for a foreign team) → `team.delete` → soft delete (never
 * touching task_teams: Task Management unassigns in its in-transaction reaction) →
 * in-transaction handlers of TeamDeleted. A failing reaction rolls the soft delete back
 * (AC-02.7.4). After commit, the events go to the EventBus. Last write wins (ADR-0020).
 * T-008-06 replaces the unit of work and the events with one Prisma transaction.
 */
@Injectable()
export class DeleteTeamUseCase {
  constructor(
    private readonly teams: TeamRepository,
    private readonly clock: Clock,
    private readonly unitOfWork: UnitOfWork,
    private readonly publisher: DomainEventPublisher,
  ) {}

  async execute({ ownerId, id }: DeleteTeamInput): Promise<void> {
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
