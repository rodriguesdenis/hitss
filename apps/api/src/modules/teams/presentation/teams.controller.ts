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
import type { Owner } from '../../../shared/domain/owner';
import { ParseUuidPipe } from '../../../shared/presentation/pipes/parse-uuid.pipe';
import type { PageMeta } from '../../../shared/presentation/openapi/api-envelope';
import { toPageMeta } from '../../../shared/presentation/page-meta';
import { parseSort } from '../../../shared/presentation/sort';
import { CurrentOwner } from '../../../shared/presentation/decorators/current-owner.decorator';
import type {
  TeamSortField,
  TeamView,
} from '../application/interfaces/team-read-model.interface';
import { CreateTeamUseCase } from '../application/use-cases/create-team.use-case';
import { DeleteTeamUseCase } from '../application/use-cases/delete-team.use-case';
import { GetTeamUseCase } from '../application/use-cases/get-team.use-case';
import { ListTeamsUseCase } from '../application/use-cases/list-teams.use-case';
import { UpdateTeamUseCase } from '../application/use-cases/update-team.use-case';
import { CreateTeamDto } from './dto/create-team.dto';
import { ListTeamsQueryDto } from './dto/list-teams-query.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import {
  ApiTeams,
  ApiListTeams,
  ApiGetTeam,
  ApiCreateTeam,
  ApiReplaceTeam,
  ApiDeleteTeam,
} from './docs/teams.docs';
import { TeamResponseDto } from './dto/team-response.dto';

@ApiTeams()
@Controller('teams')
export class TeamsController {
  constructor(
    private readonly createTeam: CreateTeamUseCase,
    private readonly updateTeam: UpdateTeamUseCase,
    private readonly deleteTeam: DeleteTeamUseCase,
    private readonly getTeam: GetTeamUseCase,
    private readonly listTeams: ListTeamsUseCase,
  ) {}

  @Get()
  @ApiListTeams()
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
      data: items.map((team) => TeamResponseDto.from(team)),
      meta: toPageMeta(page, items.length, total),
    };
  }

  @Get(':id')
  @ApiGetTeam()
  async findOne(
    @CurrentOwner() { ownerId }: Owner,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<TeamResponseDto> {
    return TeamResponseDto.from(await this.getTeam.execute({ ownerId, id }));
  }

  @Post()
  @HttpCode(201)
  @ApiCreateTeam()
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
    return TeamResponseDto.from(team);
  }

  @Put(':id')
  @ApiReplaceTeam()
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
    return TeamResponseDto.from(await this.getTeam.execute({ ownerId, id }));
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiDeleteTeam()
  async remove(
    @CurrentOwner() { ownerId }: Owner,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<void> {
    await this.deleteTeam.execute({ ownerId, id });
  }
}
