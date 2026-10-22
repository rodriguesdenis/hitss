import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Clock } from '../../../../../shared/application/ports/clock';
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
 * Load (404) → no-op (AC-02.6.7, nothing written) → name taken by another active team (409) →
 * update. Last write wins (ADR-0020): there is no precondition; the repository still increments
 * `version` as data.
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
  async execute({
    ownerId,
    id,
    name,
    colorHex,
    description,
  }: ReplaceTeamCommand): Promise<{ id: string }> {
    const team = await this.teams.findById(ownerId, id);
    if (!team) {
      throw new TeamNotFound();
    }
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
    await this.teams.update(team);
    return { id };
  }
}
