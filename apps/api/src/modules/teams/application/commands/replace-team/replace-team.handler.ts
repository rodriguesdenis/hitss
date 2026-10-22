import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Clock } from '../../../../../shared/application/ports/clock';
import { ConcurrencyConflict } from '../../../../../shared/domain/domain-error';
import { Traced } from '../../../../../shared/observability/tracing/traced-handler';
import {
  TeamNameAlreadyExists,
  TeamNotFound,
} from '../../../domain/team.errors';
import { TeamRepository } from '../../../domain/team.repository';
import { ColorHex } from '../../../domain/value-objects/color-hex';
import { TeamDescription } from '../../../domain/value-objects/team-description';
import { TeamName } from '../../../domain/value-objects/team-name';
import { ReplaceTeamCommand } from './replace-team.command';

/**
 * Check order (ADR-0015): load (404) → precondition (412, also for an unmatchable tag) → no-op
 * (AC-02.6.7, nothing written) → name taken by another active team (409) → versioned update.
 *
 * Without `If-Match` the client asked for no precondition, so a write that lands between our load
 * and our save is not its conflict: the handler reloads and reapplies once (plan 003). With
 * `If-Match` the lost race is the client's 412 (AC-02.9.5).
 */
@CommandHandler(ReplaceTeamCommand)
export class ReplaceTeamHandler implements ICommandHandler<
  ReplaceTeamCommand,
  { id: string }
> {
  constructor(
    private readonly teams: TeamRepository,
    private readonly clock: Clock,
  ) {}

  @Traced()
  async execute(command: ReplaceTeamCommand): Promise<{ id: string }> {
    try {
      return await this.attempt(command);
    } catch (error) {
      if (
        error instanceof ConcurrencyConflict &&
        command.expected.kind === 'any'
      ) {
        return this.attempt(command);
      }
      throw error;
    }
  }

  private async attempt({
    ownerId,
    id,
    name,
    colorHex,
    description,
    expected,
  }: ReplaceTeamCommand): Promise<{ id: string }> {
    const team = await this.teams.findById(ownerId, id);
    if (!team) {
      throw new TeamNotFound();
    }
    team.assertVersion(expected);
    const loadedVersion = team.version;
    const changed = team.replace({
      name: TeamName.create(name),
      color: ColorHex.create(colorHex),
      description: TeamDescription.create(description),
      now: this.clock.now(),
    });
    if (!changed) {
      return { id };
    }
    // Excluding itself, so a letter-case-only rename passes (AC-02.6.5); the index decides races.
    if (await this.teams.existsActiveByName(ownerId, team.name, id)) {
      throw new TeamNameAlreadyExists();
    }
    await this.teams.update(team, loadedVersion);
    return { id };
  }
}
