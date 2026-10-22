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
} from '@nestjs/common';
import type { ServerResponse } from 'node:http';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import type { Owner } from '../../../../shared/domain/owner';
import { ApiErrorResponses } from '../../../../shared/presentation/openapi/api-error';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
  ApiPageEnvelope,
} from '../../../../shared/presentation/openapi/api-envelope';
import { ParseUuidPipe } from '../../../../shared/presentation/pipes/parse-uuid.pipe';
import type { PageMeta } from '../../../../shared/presentation/openapi/api-envelope';
import { toPageMeta } from '../../../../shared/presentation/page-meta';
import { parseSort } from '../../../../shared/presentation/sort';
import { CurrentOwner } from '../../../../shared/presentation/decorators/current-owner.decorator';
import type {
  TeamSortField,
  TeamView,
} from '../../application/ports/team.read-model';
import { CreateTeamUseCase } from '../../application/use-cases/create-team.use-case';
import { DeleteTeamUseCase } from '../../application/use-cases/delete-team.use-case';
import { GetTeamUseCase } from '../../application/use-cases/get-team.use-case';
import { ListTeamsUseCase } from '../../application/use-cases/list-teams.use-case';
import { UpdateTeamUseCase } from '../../application/use-cases/update-team.use-case';
import { CreateTeamDto } from './dto/create-team.dto';
import { ListTeamsQueryDto } from './dto/list-teams-query.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamResponseDto } from './dto/team-response.dto';
import { toTeamResponse } from './presenters/team.presenter';

/** `/api/v1/teams`: private (global auth guard), always scoped to the signed-in owner. */
@ApiTags('Teams')
// Every route needs a bearer token and is rate limited.
@ApiErrorResponses([401, 429])
@Controller('teams')
export class TeamsController {
  constructor(
    private readonly createTeam: CreateTeamUseCase,
    private readonly updateTeam: UpdateTeamUseCase,
    private readonly deleteTeam: DeleteTeamUseCase,
    private readonly getTeam: GetTeamUseCase,
    private readonly listTeams: ListTeamsUseCase,
  ) {}

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
    const { items, total } = await this.listTeams.execute({
      ownerId,
      page,
      search: query.search,
      sort: parseSort(query.sort as TeamSortField),
    });
    return {
      data: items.map(toTeamResponse),
      meta: toPageMeta(page, items.length, total),
    };
  }

  /**
   * One of my active teams with its task count and version (AC-02.5.1). Unknown, foreign and deleted ids
   * all get the same 404 TEAM_NOT_FOUND (AC-02.5.2 to AC-02.5.4); a malformed id is a 400 naming
   * `id` (AC-02.5.5), after authentication (AC-01.5.5).
   */
  @Get(':id')
  @ApiOkEnvelope(TeamResponseDto)
  @ApiErrorResponses({
    400: 'VALIDATION_FAILED: `id` is not a UUID.',
    404: 'TEAM_NOT_FOUND: unknown, deleted, or owned by another user (never revealed which).',
  })
  async findOne(
    @CurrentOwner() { ownerId }: Owner,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<TeamResponseDto> {
    return toTeamResponse(await this.getTeam.execute({ ownerId, id }));
  }

  /** 201 with the created team read back (same shape as every single-team response) and its `Location` (AC-02.1.1). */
  @Post()
  @HttpCode(201)
  @ApiCreatedEnvelope(TeamResponseDto)
  @ApiErrorResponses({
    400: 'VALIDATION_FAILED: an invalid or unknown field; `details` names it.',
    409: 'TEAM_NAME_ALREADY_EXISTS: you already have an active team with this name (any letter case).',
    413: 'PAYLOAD_TOO_LARGE: the JSON body is over 100 kB.',
  })
  async create(
    @CurrentOwner() { ownerId }: Owner,
    @Body() body: CreateTeamDto,
    @Res({ passthrough: true }) response: ServerResponse,
  ): Promise<TeamResponseDto> {
    const id = await this.createTeam.execute({
      ownerId,
      name: body.name,
      colorHex: body.colorHex,
      description: body.description,
    });
    const team: TeamView = await this.getTeam.execute({ ownerId, id });
    response.setHeader('Location', `/api/v1/teams/${team.id}`);
    return toTeamResponse(team);
  }

  /**
   * Full replacement (AC-02.6.x), last write wins (ADR-0020). Order: body validation 400 → 404 →
   * no-op → 409. Answers the team read back.
   */
  @Put(':id')
  @ApiOkEnvelope(TeamResponseDto)
  @ApiErrorResponses({
    400: 'VALIDATION_FAILED: an invalid or unknown field, or `id` not a UUID.',
    404: 'TEAM_NOT_FOUND: unknown, deleted, or owned by another user (never revealed which).',
    409: 'TEAM_NAME_ALREADY_EXISTS: you already have an active team with this name (any letter case).',
    413: 'PAYLOAD_TOO_LARGE: the JSON body is over 100 kB.',
  })
  async replace(
    @CurrentOwner() { ownerId }: Owner,
    @Param('id', ParseUuidPipe) id: string,
    @Body() body: UpdateTeamDto,
  ): Promise<TeamResponseDto> {
    await this.updateTeam.execute({
      ownerId,
      id,
      name: body.name,
      colorHex: body.colorHex,
      description: body.description,
    });
    return toTeamResponse(await this.getTeam.execute({ ownerId, id }));
  }

  /**
   * Soft-deletes the team (AC-02.7.1): 204, then it is gone from get and list. Unknown, foreign
   * and deleted ids → 404 (AC-02.7.3). Last write wins (ADR-0020).
   */
  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'The team was deleted.' })
  @ApiErrorResponses({
    400: 'VALIDATION_FAILED: `id` is not a UUID.',
    404: 'TEAM_NOT_FOUND: unknown, deleted, or owned by another user (never revealed which).',
  })
  async remove(
    @CurrentOwner() { ownerId }: Owner,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<void> {
    await this.deleteTeam.execute({ ownerId, id });
  }
}
