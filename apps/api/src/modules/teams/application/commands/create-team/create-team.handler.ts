import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Clock } from '../../../../../shared/application/ports/clock';
import { IdGenerator } from '../../../../../shared/application/ports/id-generator';
import { Team } from '../../../domain/team';
import { TeamNameAlreadyExists } from '../../../domain/team.errors';
import { TeamRepository } from '../../../domain/team.repository';
import { ColorHex } from '../../../domain/value-objects/color-hex';
import { TeamDescription } from '../../../domain/value-objects/team-description';
import { TeamName } from '../../../domain/value-objects/team-name';
import { CreateTeamCommand } from './create-team.command';

/**
 * Builds the value objects (the domain re-validates what the DTO checked), rejects a name the
 * owner already uses on an active team, and inserts the team at version 1. Commands return ids;
 * the controller reads the team back through GetTeamQuery.
 */
@CommandHandler(CreateTeamCommand)
export class CreateTeamHandler implements ICommandHandler<
  CreateTeamCommand,
  { id: string }
> {
  constructor(
    private readonly teams: TeamRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}
  async execute({
    ownerId,
    name,
    colorHex,
    description,
  }: CreateTeamCommand): Promise<{ id: string }> {
    const team = Team.create({
      id: this.ids.next(),
      ownerId,
      name: TeamName.create(name),
      color: ColorHex.create(colorHex),
      description: TeamDescription.create(description),
      now: this.clock.now(),
    });
    // Fast path for the common case; the unique index settles races in insert (AC-02.1.9).
    if (await this.teams.existsActiveByName(ownerId, team.name)) {
      throw new TeamNameAlreadyExists();
    }
    await this.teams.insert(team);
    return { id: team.id };
  }
}
