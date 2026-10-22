import { Module, OnModuleInit } from '@nestjs/common';
import { Clock } from '../../shared/domain/clock';
import { SystemClock } from '../../shared/infrastructure/system-clock';
import { DomainErrorMappings } from '../../shared/presentation/filters/domain-error-mappings';
import { TeamReadModel } from './application/ports/team.read-model';
import { CreateTeamUseCase } from './application/use-cases/create-team.use-case';
import { DeleteTeamUseCase } from './application/use-cases/delete-team.use-case';
import { GetTeamUseCase } from './application/use-cases/get-team.use-case';
import { ListTeamsUseCase } from './application/use-cases/list-teams.use-case';
import { UpdateTeamUseCase } from './application/use-cases/update-team.use-case';
import { TeamRepository } from './domain/repositories/team.repository';
import { PrismaTeamReadModel } from './infrastructure/persistence/team.prisma-read';
import { PrismaTeamRepository } from './infrastructure/persistence/team.prisma-repository';
import { TeamsController } from './presentation/http/teams.controller';
import { TEAM_ERROR_MAPPINGS } from './presentation/http/team-error.mapping';
import { TeamLookup } from './team-lookup.service';

@Module({
  controllers: [TeamsController],
  providers: [
    CreateTeamUseCase,
    UpdateTeamUseCase,
    DeleteTeamUseCase,
    GetTeamUseCase,
    ListTeamsUseCase,
    TeamLookup,
    { provide: TeamRepository, useClass: PrismaTeamRepository },
    { provide: TeamReadModel, useClass: PrismaTeamReadModel },
    { provide: Clock, useClass: SystemClock },
  ],
  exports: [TeamLookup],
})
export class TeamsModule implements OnModuleInit {
  constructor(private readonly errorMappings: DomainErrorMappings) {}

  onModuleInit(): void {
    this.errorMappings.register(TEAM_ERROR_MAPPINGS);
  }
}
