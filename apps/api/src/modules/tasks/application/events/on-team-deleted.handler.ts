import { Injectable } from '@nestjs/common';
import {
  InTransactionEventHandler,
  InTransactionHandler,
} from '../../../../shared/application/in-transaction-handler';
import { TeamDeleted } from '../../../teams/contracts/team-deleted.event';
import { TaskRepository } from '../../domain/repositories/task.repository';

/**
 * Team Management deleted a team: unassign it from the owner's tasks, inside DeleteTeam's unit
 * of work (`@InTransactionHandler`, not an `@EventsHandler`), so the soft delete and the
 * unassignments commit or roll back together (AC-02.7.2, AC-02.7.4). Each affected task loses
 * only that team and gets a new version and updated time (AC-03.13.x); replaying the event
 * finds nothing left to do. The team-link lock makes a concurrent task write either finish
 * first (its new link is then removed here) or wait and see the team deleted.
 */
@Injectable()
@InTransactionHandler(TeamDeleted)
export class OnTeamDeletedHandler implements InTransactionEventHandler<TeamDeleted> {
  constructor(private readonly tasks: TaskRepository) {}

  async handle({ teamId, ownerId, occurredAt }: TeamDeleted): Promise<void> {
    await this.tasks.lockTeamLinks([teamId]);
    for (const task of await this.tasks.findByTeam(ownerId, teamId)) {
      if (task.unassignTeam(teamId, occurredAt)) {
        await this.tasks.update(task);
      }
    }
  }
}
