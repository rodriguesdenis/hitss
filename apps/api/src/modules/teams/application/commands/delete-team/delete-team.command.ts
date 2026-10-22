import type { ExpectedVersion } from '../../../../../shared/domain/expected-version';

/** Soft-delete one of the owner's teams (AC-02.7.x), guarded by `If-Match` (AC-02.9.3). */
export class DeleteTeamCommand {
  constructor(
    readonly ownerId: string,
    readonly id: string,
    readonly expected: ExpectedVersion,
  ) {}
}
