import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { ServerResponse } from 'node:http';
import { ApiHeader, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import type { ExpectedVersion } from '../../../shared/domain/expected-version';
import { IfMatch } from '../../../shared/presentation/decorators/if-match.decorator';
import type { Page } from '../../../shared/application/page';
import type { Owner } from '../../../shared/domain/owner';
import { ApiErrorResponses } from '../../../shared/presentation/openapi/api-error';
import { EtagInterceptor } from '../../../shared/presentation/interceptors/etag.interceptor';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
  ApiPageEnvelope,
} from '../../../shared/presentation/openapi/api-envelope';
import { ParseUuidPipe } from '../../../shared/presentation/pipes/parse-uuid.pipe';
import type { PageMeta } from '../../../shared/presentation/openapi/api-envelope';
import { toPageMeta } from '../../../shared/presentation/page-meta';
import { parseSort } from '../../../shared/presentation/sort';
import { CurrentOwner } from '../../../shared/presentation/decorators/current-owner.decorator';
import { CreateTeamCommand } from '../application/commands/create-team/create-team.command';
import { DeleteTeamCommand } from '../application/commands/delete-team/delete-team.command';
import { ReplaceTeamCommand } from '../application/commands/replace-team/replace-team.command';
import type { TeamSortField } from '../application/ports/team.read-model';
import { GetTeamQuery } from '../application/queries/get-team/get-team.query';
import { ListTeamsQuery } from '../application/queries/list-teams/list-teams.query';
import type { TeamDetails } from '../application/views/team.view';
import { CreateTeamDto } from './dto/create-team.dto';
import { ListTeamsQueryDto } from './dto/list-teams-query.dto';
import { ReplaceTeamDto } from './dto/replace-team.dto';
import { TeamResponseDto } from './dto/team-response.dto';
import { toTeamResponse } from './team.presenter';

/** `/api/v1/teams`: private (global auth guard), always scoped to the signed-in owner. */
@ApiTags('Teams')
// Every route needs a bearer token and is rate limited.
@ApiErrorResponses([401, 429])
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
  @ApiErrorResponses([400])
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

  /**
   * One of my active teams with its version tag (AC-02.5.1). Unknown, foreign and deleted ids
   * all get the same 404 TEAM_NOT_FOUND (AC-02.5.2 to AC-02.5.4); a malformed id is a 400 naming
   * `id` (AC-02.5.5), after authentication (AC-01.5.5).
   */
  @Get(':id')
  @ApiOkEnvelope(TeamResponseDto)
  @ApiErrorResponses({
    400: 'VALIDATION_FAILED: `id` is not a UUID.',
    404: 'TEAM_NOT_FOUND: unknown, deleted, or owned by another user (never revealed which).',
  })
  @UseInterceptors(EtagInterceptor)
  async findOne(
    @CurrentOwner() { ownerId }: Owner,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<TeamResponseDto> {
    return toTeamResponse(
      await this.queries.execute<GetTeamQuery, TeamDetails>(
        new GetTeamQuery(ownerId, id),
      ),
    );
  }

  @Post()
  @HttpCode(201)
  @ApiCreatedEnvelope(TeamResponseDto)
  @ApiErrorResponses({
    400: 'VALIDATION_FAILED: an invalid or unknown field; `details` names it.',
    409: 'TEAM_NAME_ALREADY_EXISTS: you already have an active team with this name (any letter case).',
    413: 'PAYLOAD_TOO_LARGE: the JSON body is over 100 kB.',
  })
  @UseInterceptors(EtagInterceptor)
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
    return toTeamResponse(team); // ETag: EtagInterceptor
  }

  /**
   * Full replacement (AC-02.6.x). Order: body validation 400 → 404 → If-Match 412 (a malformed
   * tag cannot match) → no-op → 409. Answers the team read back with its new ETag.
   */
  @Put(':id')
  @ApiOkEnvelope(TeamResponseDto)
  @ApiErrorResponses({
    400: 'VALIDATION_FAILED: an invalid or unknown field, or `id` not a UUID.',
    404: 'TEAM_NOT_FOUND: unknown, deleted, or owned by another user (never revealed which).',
    409: 'TEAM_NAME_ALREADY_EXISTS: you already have an active team with this name (any letter case).',
    412: 'PRECONDITION_FAILED: If-Match is stale or malformed; `details.currentVersion`.',
    413: 'PAYLOAD_TOO_LARGE: the JSON body is over 100 kB.',
  })
  @ApiHeader({
    name: 'If-Match',
    required: false,
    description:
      'The ETag you read (W/"<version>"); a stale or malformed tag → 412.',
  })
  @UseInterceptors(EtagInterceptor)
  async replace(
    @CurrentOwner() { ownerId }: Owner,
    @Param('id', ParseUuidPipe) id: string,
    @Body() body: ReplaceTeamDto,
    @IfMatch() expected: ExpectedVersion,
  ): Promise<TeamResponseDto> {
    await this.commands.execute<ReplaceTeamCommand, { id: string }>(
      new ReplaceTeamCommand(
        ownerId,
        id,
        body.name,
        body.colorHex,
        body.description,
        expected,
      ),
    );
    return toTeamResponse(
      await this.queries.execute<GetTeamQuery, TeamDetails>(
        new GetTeamQuery(ownerId, id),
      ),
    );
  }

  /**
   * Soft-deletes the team (AC-02.7.1): 204, then it is gone from get and list. Unknown, foreign
   * and deleted ids → 404 whatever the If-Match (AC-02.9.8); a stale tag → 412 (AC-02.9.3).
   */
  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'The team was deleted.' })
  @ApiErrorResponses({
    400: 'VALIDATION_FAILED: `id` is not a UUID.',
    404: 'TEAM_NOT_FOUND: unknown, deleted, or owned by another user (never revealed which).',
    412: 'PRECONDITION_FAILED: If-Match is stale or malformed; `details.currentVersion`.',
  })
  @ApiHeader({
    name: 'If-Match',
    required: false,
    description:
      'The ETag you read (W/"<version>"); a stale or malformed tag → 412.',
  })
  async remove(
    @CurrentOwner() { ownerId }: Owner,
    @Param('id', ParseUuidPipe) id: string,
    @IfMatch() expected: ExpectedVersion,
  ): Promise<void> {
    await this.commands.execute<DeleteTeamCommand, void>(
      new DeleteTeamCommand(ownerId, id, expected),
    );
  }
}
