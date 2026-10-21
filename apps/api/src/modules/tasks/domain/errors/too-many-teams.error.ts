import { DomainError } from '../../../../shared/domain/domain-error';

/** More distinct teams than a task may have (`422 TOO_MANY_TEAMS`). */
export class TooManyTeams extends DomainError {
  constructor(
    readonly max: number,
    readonly received: number,
  ) {
    super(`A task can have at most ${max} teams.`);
  }
}
