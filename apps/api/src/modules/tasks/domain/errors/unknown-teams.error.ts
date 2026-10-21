import { DomainError } from '../../../../shared/domain/domain-error';

/**
 * Some team ids are not live teams of the owner (`422 UNKNOWN_TEAMS`). Foreign
 * and never-existing ids are reported alike, so ownership is not revealed.
 */
export class UnknownTeams extends DomainError {
  readonly teamIds: readonly string[];

  constructor(teamIds: readonly string[]) {
    super('Some teams do not exist.');
    this.teamIds = [...teamIds];
  }
}
