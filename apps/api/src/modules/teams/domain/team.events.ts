import { DomainEvent } from '../../../shared/domain/domain-event';

/** Raised by `Team.delete`; Task Management unassigns the team from its tasks. */
export class TeamDeleted extends DomainEvent {
  constructor(
    readonly teamId: string,
    readonly ownerId: string,
    occurredAt: Date,
  ) {
    super(occurredAt);
  }
}
