import type { ExpectedVersion } from '../../../../../shared/domain/expected-version';

/** Full replacement of one of the owner's teams (AC-02.6.x), guarded by `If-Match` (AC-02.9.x). */
export class ReplaceTeamCommand {
  constructor(
    readonly ownerId: string,
    readonly id: string,
    readonly name: string,
    readonly colorHex: string,
    readonly description: string | null | undefined,
    readonly expected: ExpectedVersion,
  ) {}
}
