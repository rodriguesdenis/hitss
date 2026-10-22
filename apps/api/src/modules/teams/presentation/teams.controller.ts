import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { ServerResponse } from 'node:http';
import { ApiTags } from '@nestjs/swagger';
import type { Page } from '../../../shared/application/page';
import type { Owner } from '../../../shared/domain/owner';
import {
  ApiCreatedEnvelope,
  ApiPageEnvelope,
} from '../../../shared/presentation/openapi/api-envelope';
import type { PageMeta } from '../../../shared/presentation/openapi/api-envelope';
import { toPageMeta } from '../../../shared/presentation/page-meta';
import { parseSort } from '../../../shared/presentation/sort';
import { CurrentOwner } from '../../../shared/presentation/decorators/current-owner.decorator';
import { CreateTeamCommand } from '../application/commands/create-team/create-team.command';
import type { TeamSortField } from '../application/ports/team.read-model';
import { GetTeamQuery } from '../application/queries/get-team/get-team.query';
import { ListTeamsQuery } from '../application/queries/list-teams/list-teams.query';
import type { TeamDetails } from '../application/views/team.view';
import { CreateTeamDto } from './dto/create-team.dto';
import { ListTeamsQueryDto } from './dto/list-teams-query.dto';
import { TeamResponseDto } from './dto/team-response.dto';
import { toTeamResponse } from './team.presenter';

/** `/api/v1/teams`: private (global auth guard), always scoped to the signed-in owner. */
@ApiTags('Teams')
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
  /**
   * The owner's active teams, one page at a time, with search and sort (AC-02.2.x to
   * AC-02.4.x). Foreign and deleted teams are never listed nor counted.
   */
  @Get()
  @ApiPageEnvelope(TeamResponseDto)
  async list(
    @CurrentOwner() { ownerId }: Owner,
    @Query() query: ListTeamsQueryDto,
  ): Promise<{ data: TeamResponseDto[]; meta: PageMeta }> {
    const page = { limit: query.limit, offset: query.offset };
    const { items, total } = await this.queries.execute<
      ListTeamsQuery,
      Page<TeamDetails>
    >(
      new ListTeamsQuery(ownerId, {
        page,
        search: query.search,
        sort: parseSort(query.sort as TeamSortField),
      }),
    );
    return {
      data: items.map(toTeamResponse),
      meta: toPageMeta(page, items.length, total),
    };
  }

  @Post()
  @HttpCode(201)
  @ApiCreatedEnvelope(TeamResponseDto)
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
