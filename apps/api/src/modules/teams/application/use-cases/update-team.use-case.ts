import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/domain/clock';
import {
  TeamNameAlreadyExists,
  TeamNotFound,
} from '../../domain/errors/team.errors';
import { TeamRepository } from '../../domain/repositories/team.repository';
import { ColorHex } from '../../domain/value-objects/color-hex.vo';
import { TeamDescription } from '../../domain/value-objects/team-description.vo';
import { TeamName } from '../../domain/value-objects/team-name.vo';

export interface UpdateTeamInput {
  readonly ownerId: string;
  readonly id: string;
  readonly name: string;
  readonly colorHex: string;
  /** Omitted means none: `PUT` is a full replacement (AC-02.6.3). */
  readonly description?: string | null;
}

/**
 * Load (404) → no-op (AC-02.6.7, nothing written) → name taken by another active team (409) →
 * update. Last write wins (ADR-0020): there is no precondition; the repository still increments
 * `version` as data.
 */
@Injectable()
export class UpdateTeamUseCase {
  constructor(
    private readonly teams: TeamRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateTeamInput): Promise<void> {
    const team = await this.teams.findById(input.ownerId, input.id);
    if (!team) {
      throw new TeamNotFound();
    }
    const changed = team.replace({
      name: TeamName.create(input.name),
      color: ColorHex.create(input.colorHex),
      description: TeamDescription.create(input.description),
      now: this.clock.now(),
    });
    if (!changed) {
      return;
    }
    // Excluding itself, so a letter-case-only rename passes (AC-02.6.5); the index decides races.
    if (
      await this.teams.existsActiveByName(input.ownerId, team.name, input.id)
    ) {
      throw new TeamNameAlreadyExists();
    }
    await this.teams.update(team);
  }
}
