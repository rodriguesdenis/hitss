import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { ServerResponse } from 'node:http';
import type { Owner } from '../../../shared/domain/owner';
import { CurrentOwner } from '../../../shared/presentation/decorators/current-owner.decorator';
import { CreateTeamCommand } from '../application/commands/create-team/create-team.command';
import { GetTeamQuery } from '../application/queries/get-team/get-team.query';
import type { TeamDetails } from '../application/views/team.view';
import { CreateTeamDto } from './dto/create-team.dto';
import type { TeamResponseDto } from './dto/team-response.dto';
import { toTeamResponse } from './team.presenter';

/** `/api/v1/teams`: private (global auth guard), always scoped to the signed-in owner. */
@Controller('teams')
export class TeamsController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  /**
   * 201 with the created team read back through GetTeam (same shape as every single-team
   * response), `Location` and the version tag (AC-02.1.1).
   */
  @Post()
  @HttpCode(201)
  async create(
    @CurrentOwner() { ownerId }: Owner,
    @Body() body: CreateTeamDto,
    @Res({ passthrough: true }) response: ServerResponse,
  ): Promise<TeamResponseDto> {
    const { id } = await this.commands.execute<
      CreateTeamCommand,
      { id: string }
    >(
      new CreateTeamCommand(
        ownerId,
        body.name,
        body.colorHex,
        body.description,
      ),
    );
    const team = await this.queries.execute<GetTeamQuery, TeamDetails>(
      new GetTeamQuery(ownerId, id),
    );
    response.setHeader('Location', `/api/v1/teams/${team.id}`);
    // Until the shared EtagInterceptor (T-002-07) takes over, in the same W/"<version>" form.
    response.setHeader('ETag', `W/"${team.version}"`);
    return toTeamResponse(team);
  }
}
