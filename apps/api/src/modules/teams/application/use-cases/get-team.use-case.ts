import { Injectable } from '@nestjs/common';
import { TeamNotFound } from '../../domain/errors/team.errors';
import { TeamReadModel, TeamView } from '../ports/team.read-model';

export interface GetTeamInput {
  readonly ownerId: string;
  readonly id: string;
}

/** One of the owner's active teams, with its task count, or TeamNotFound (AC-02.5.x). */
@Injectable()
export class GetTeamUseCase {
  constructor(private readonly readModel: TeamReadModel) {}

  async execute({ ownerId, id }: GetTeamInput): Promise<TeamView> {
    const view = await this.readModel.findById(ownerId, id);
    if (!view) {
      throw new TeamNotFound();
    }
    return view;
  }
}
