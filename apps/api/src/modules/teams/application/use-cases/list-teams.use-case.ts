import { Injectable } from '@nestjs/common';
import type { Page } from '../../../../shared/application/page';
import {
  ListTeamsCriteria,
  TeamReadModel,
  TeamView,
} from '../interfaces/team-read-model.interface';

export interface ListTeamsInput extends ListTeamsCriteria {
  readonly ownerId: string;
}

@Injectable()
export class ListTeamsUseCase {
  constructor(private readonly readModel: TeamReadModel) {}

  execute({ ownerId, ...criteria }: ListTeamsInput): Promise<Page<TeamView>> {
    return this.readModel.page(ownerId, criteria);
  }
}
