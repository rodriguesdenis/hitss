import { Injectable } from '@nestjs/common';
import { TeamNotFound } from '../../domain/errors/team.errors';
import {
  TeamReadModel,
  TeamView,
} from '../interfaces/team-read-model.interface';

export interface GetTeamInput {
  readonly ownerId: string;
  readonly id: string;
}

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
