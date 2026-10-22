import { Injectable } from '@nestjs/common';
import type { Page } from '../../../../shared/application/page';
import {
  ListTeamsCriteria,
  TeamReadModel,
  TeamView,
} from '../ports/team.read-model';

export interface ListTeamsInput extends ListTeamsCriteria {
  readonly ownerId: string;
}

/** One page of the owner's active teams, each with its task count (AC-02.2.x to AC-02.4.x). */
@Injectable()
export class ListTeamsUseCase {
  constructor(private readonly readModel: TeamReadModel) {}

  execute({ ownerId, ...criteria }: ListTeamsInput): Promise<Page<TeamView>> {
    return this.readModel.page(ownerId, criteria);
  }
}
